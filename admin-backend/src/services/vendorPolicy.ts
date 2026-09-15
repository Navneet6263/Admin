import { createHash } from 'crypto';
import type { AuthUser } from '../auth';
import mssql from 'mssql';

export class VendorError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
export const emailValid = (value: unknown): value is string => typeof value === 'string'
  && value.length <= 254 && /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(value);
export const vendorScope = `(@role IN('hq_admin','super_admin') OR (@role='center_admin' AND
  (r.approval_center_code=@cc OR EXISTS(SELECT 1 FROM admin_center_access a
    WHERE a.user_id=@uid AND a.center_code=r.approval_center_code AND a.is_active=1))))`;
export const latestDelivery = `OUTER APPLY (SELECT TOP 1 d.id delivery_id,d.status delivery_status,
  d.vendor_name,d.vendor_email,d.created_at delivery_created_at,d.sent_at,d.error_code,u.name sent_by
  FROM vendor_delivery_items i JOIN vendor_deliveries d ON d.id=i.delivery_id
  JOIN users u ON u.id=d.actor_id WHERE i.request_id=r.id
  ORDER BY d.created_at DESC,d.id DESC) last_send`;
export function scopeInputs(request: mssql.Request, user: AuthUser) {
  return request.input('role', mssql.NVarChar(30), user.role)
    .input('uid', mssql.Int, user.id).input('cc', mssql.NVarChar(10), user.center_code || null);
}
export function cardRevision(row: any) {
  return digest(JSON.stringify([row.id, row.status, row.type, row.details, row.company, row.approval_center_code]));
}
export async function readVendorCard(source: mssql.ConnectionPool | mssql.Transaction, user: AuthUser, id: number, lock = false) {
  const result = await scopeInputs(source.request(), user).input('id', mssql.Int, id).query(`
    SELECT r.id,r.ref_id,r.type,r.status,r.details,r.company,r.approval_center_code,
      COALESCE(c.name,r.company) company_name,last_send.*
    FROM requests r ${lock ? 'WITH(UPDLOCK,HOLDLOCK)' : ''}
    LEFT JOIN companies c ON c.code=r.company ${latestDelivery}
    WHERE r.id=@id AND r.type IN('id_card','visiting_card') AND r.status='approved' AND ${vendorScope}`);
  const row = result.recordset[0];
  if (!row) throw new VendorError(404, 'Approved card not found or not permitted');
  const revision = cardRevision(row);
  const details = typeof row.details === 'string' ? JSON.parse(row.details) : row.details;
  if (!details?.brand) throw new VendorError(409, 'This request has no printable card template');
  const quantity = row.type === 'id_card' ? 1 : Number(details.qty);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100000)
    throw new VendorError(409, 'Card quantity is invalid. Correct the request before sending');
  return { ...row, details, revision, quantity };
}
export function validatePdf(value: unknown) {
  if (typeof value !== 'string' || value.length > 12_000_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value))
    throw new VendorError(400, 'Invalid PDF attachment');
  const bytes = Buffer.from(value, 'base64');
  if (bytes.length < 100 || !bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))
    || !bytes.subarray(-30).toString().includes('%%EOF')
    || /\/(JavaScript|JS|Launch|EmbeddedFile|OpenAction)\b/.test(bytes.toString('latin1')))
    throw new VendorError(400, 'Only generated print PDFs are accepted');
  return bytes;
}
