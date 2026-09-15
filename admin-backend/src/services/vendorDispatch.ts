import mssql from 'mssql';
import { pool } from '../db';
import type { AuthUser } from '../auth';
import { digest, readVendorCard, validatePdf, VendorError } from './vendorPolicy';
import { deliveryFailure, mailSettings, sendVendorMail } from './vendorMail';

export async function dispatchVendorCards(user: AuthUser, body: any, dependencies = {
  database: pool, send: sendVendorMail, settings: mailSettings,
}) {
  const { database, send, settings } = dependencies;
  if (!body || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.key)
    || !Number.isInteger(body.vendorId) || !Array.isArray(body.cards) || !body.cards.length || body.cards.length > 10)
    throw new VendorError(400, 'Select a vendor and between 1 and 10 approved cards');
  if (body.cards.some((card: any) => !card || typeof card !== 'object')) throw new VendorError(400, 'Invalid card selection');
  const ids = body.cards.map((card: any) => card.id);
  if (new Set(ids).size !== ids.length || ids.some((id: any) => !Number.isInteger(id) || id < 1)
    || body.cards.some((card: any) => card.verified !== true))
    throw new VendorError(400, 'Verify every selected card template before sending');
  const attachments = body.cards.map((card: any) => validatePdf(card.pdf));
  if (attachments.reduce((sum: number, bytes: Buffer) => sum + bytes.length, 0) > 8 * 1024 * 1024)
    throw new VendorError(413, 'Attachments exceed 8 MB. Send a smaller batch.');
  const payloadHash = digest(JSON.stringify([body.vendorId, body.vendorEmail, body.resend === true,
    body.cards.map((card: any, index: number) => [card.id, card.revision, card.lastDeliveryId, digest(attachments[index])])]));
  const existing = await database.request().input('id', mssql.UniqueIdentifier, body.key)
    .query('SELECT id,actor_id,payload_hash,status FROM vendor_deliveries WHERE id=@id');
  if (existing.recordset[0]) {
    const row = existing.recordset[0];
    if (row.actor_id !== user.id || row.payload_hash !== payloadHash) throw new VendorError(409, 'Dispatch reference already used');
    return { id: row.id, status: row.status };
  }
  settings(); // Fail without reserving requests when email configuration is missing.
  const tx = database.transaction();
  await tx.begin();
  let vendor: any;
  const cards: any[] = [];
  try {
    const found = await tx.request().input('id', mssql.Int, body.vendorId)
      .query('SELECT * FROM vendors WITH(HOLDLOCK) WHERE id=@id AND is_active=1');
    vendor = found.recordset[0];
    if (!vendor || vendor.email !== body.vendorEmail) throw new VendorError(409, 'Vendor changed or is inactive. Select the vendor again.');
    // Always lock in ascending order, including overlapping bulk requests.
    const locked = new Map<number, any>();
    for (const id of [...ids].sort((a: number, b: number) => a - b)) locked.set(id, await readVendorCard(tx, user, id, true));
    for (const input of body.cards) {
      const card = locked.get(input.id);
      if (card.revision !== input.revision || (card.delivery_id || null) !== (input.lastDeliveryId || null))
        throw new VendorError(409, 'A selected request changed. Reopen and verify its template again.');
      if (vendor.service !== 'both' && vendor.service !== card.type)
        throw new VendorError(400, 'Vendor does not support all selected card types');
      if (['sending', 'unknown'].includes(card.delivery_status))
        throw new VendorError(409, 'Previous delivery is pending or uncertain. Check mail provider logs before resending.');
      if (card.delivery_status === 'sent' && body.resend !== true)
        throw new VendorError(409, 'A selected card was already sent. Confirm intentional resend.');
      cards.push(card);
    }
    await tx.request().input('id', mssql.UniqueIdentifier, body.key).input('hash', mssql.Char(64), payloadHash)
      .input('vendor', mssql.Int, vendor.id).input('name', mssql.NVarChar(120), vendor.name)
      .input('email', mssql.NVarChar(254), vendor.email).input('actor', mssql.Int, user.id)
      .query(`INSERT INTO vendor_deliveries(id,payload_hash,vendor_id,vendor_name,vendor_email,actor_id,status)
        VALUES(@id,@hash,@vendor,@name,@email,@actor,'sending')`);
    for (let index = 0; index < cards.length; index++) {
      const card = cards[index];
      await tx.request().input('id', mssql.UniqueIdentifier, body.key).input('rid', mssql.Int, card.id)
        .input('ref', mssql.NVarChar(50), card.ref_id).input('company', mssql.NVarChar(200), card.company_name)
        .input('template', mssql.NVarChar(100), card.details.brand).input('qty', mssql.Int, card.quantity)
        .input('revision', mssql.Char(64), card.revision).input('pdf', mssql.Char(64), digest(attachments[index]))
        .input('actor', mssql.Int, user.id)
        .input('note', mssql.NVarChar(1000), `Templates verified. Sending to ${vendor.name} <${vendor.email}>. Dispatch ${body.key}`)
        .query(`INSERT INTO vendor_delivery_items(delivery_id,request_id,ref_id,company,template,quantity,revision,pdf_hash)
          VALUES(@id,@rid,@ref,@company,@template,@qty,@revision,@pdf);
          INSERT INTO approvals(request_id,actor_id,action,note) VALUES(@rid,@actor,'commented',@note)`);
    }
    await tx.commit();
  } catch (error) { await tx.rollback().catch(() => {}); throw error; }

  let status: 'sent' | 'failed' | 'unknown' = 'sent';
  let messageId: string | null = null, errorCode: string | null = null;
  try { messageId = await send(body.key, vendor, cards, attachments); }
  catch (error: any) {
    status = deliveryFailure(error);
    errorCode = String(error?.code || 'SMTP_ERROR').replace(/[^a-z0-9_]/gi, '').slice(0, 60);
    console.error(`Vendor dispatch ${body.key}: ${status} (${errorCode})`);
  }
  // If this write fails after SMTP acceptance, retain 'sending' and never retry blindly.
  const finish = database.transaction();
  await finish.begin();
  try {
    await finish.request().input('id', mssql.UniqueIdentifier, body.key).input('status', mssql.VarChar(20), status)
      .input('message', mssql.NVarChar(254), messageId).input('error', mssql.VarChar(60), errorCode)
      .input('actor', mssql.Int, user.id)
      .input('note', mssql.NVarChar(1000), `Vendor email ${status}: ${vendor.name} <${vendor.email}>. Dispatch ${body.key}`)
      .query(`UPDATE vendor_deliveries SET status=@status,message_id=@message,error_code=@error,
        sent_at=CASE WHEN @status='sent' THEN SYSUTCDATETIME() ELSE NULL END WHERE id=@id;
        INSERT INTO approvals(request_id,actor_id,action,note)
          SELECT request_id,@actor,'commented',@note FROM vendor_delivery_items WHERE delivery_id=@id`);
    await finish.commit();
  } catch (error) { await finish.rollback().catch(() => {}); throw error; }
  return { id: body.key, status };
}
