import { Router } from 'express';
import mssql from 'mssql';
import { requireAuth } from '../auth';
import { pool } from '../db';
import { readVendorCard, VendorError } from '../services/vendorPolicy';

const router = Router();
router.post('/:id/reconcile', requireAuth('hq_admin', 'super_admin'), async (req, res) => {
  const id = Number(req.params.id), b = req.body || {};
  if (!Number.isInteger(id) || id < 1 || b.checkedProvider !== true || !['sent', 'failed'].includes(b.outcome)
    || typeof b.note !== 'string' || b.note.trim().length < 10 || b.note.length > 500)
    return res.status(400).json({ error: 'Check provider logs and enter the confirmed outcome with a note (10–500 characters)' });
  const tx = pool.transaction();
  try {
    await tx.begin();
    const card = await readVendorCard(tx, req.user!, id, true);
    if (!card.delivery_id || card.delivery_id !== b.deliveryId) throw new VendorError(409, 'Dispatch changed. Refresh its status.');
    const updated = await tx.request().input('id', mssql.UniqueIdentifier, card.delivery_id)
      .input('status', mssql.VarChar(20), b.outcome).query(`
        UPDATE vendor_deliveries SET status=@status,error_code='MANUALLY_CONFIRMED'
        OUTPUT inserted.id WHERE id=@id AND (status='unknown' OR
          (status='sending' AND created_at<DATEADD(MINUTE,-5,SYSUTCDATETIME())))`);
    if (!updated.recordset[0]) throw new VendorError(409, 'Only uncertain deliveries or sends older than five minutes can be reconciled');
    await tx.request().input('id', mssql.UniqueIdentifier, card.delivery_id).input('actor', mssql.Int, req.user!.id)
      .input('note', mssql.NVarChar(1000), `Vendor delivery manually confirmed ${b.outcome} after checking provider logs. ${b.note.trim()}. Dispatch ${card.delivery_id}`)
      .query(`INSERT INTO approvals(request_id,actor_id,action,note)
        SELECT request_id,@actor,'commented',@note FROM vendor_delivery_items WHERE delivery_id=@id`);
    await tx.commit(); res.json({ success: true });
  } catch (error) {
    await tx.rollback().catch(() => {});
    res.status(error instanceof VendorError ? error.status : 500)
      .json({ error: error instanceof VendorError ? error.message : 'Dispatch status could not be reconciled' });
  }
});
export default router;
