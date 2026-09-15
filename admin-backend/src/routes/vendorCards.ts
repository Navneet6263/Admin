import { Router } from 'express';
import mssql from 'mssql';
import { pool } from '../db';
import { dispatchVendorCards } from '../services/vendorDispatch';
import { latestDelivery, readVendorCard, scopeInputs, vendorScope, VendorError } from '../services/vendorPolicy';
import reconciliation from './vendorReconcile';

const router = Router();
router.use(reconciliation);
router.get('/', async (req, res) => {
  const page = Math.max(1, Math.floor(Number(req.query.page) || 1));
  try {
    const result = await scopeInputs(pool.request(), req.user!).input('offset', mssql.Int, (page - 1) * 25)
      .input('search', mssql.NVarChar(254), `%${String(req.query.search || '').slice(0, 120)}%`)
      .query(`SELECT r.id,r.ref_id,r.type,r.subject,COALESCE(c.name,r.company) company_name,last_send.*
        FROM requests r JOIN users u ON u.id=r.user_id LEFT JOIN companies c ON c.code=r.company ${latestDelivery}
        WHERE r.status='approved' AND r.type IN('id_card','visiting_card') AND ${vendorScope}
          AND (r.ref_id LIKE @search OR r.subject LIKE @search OR c.name LIKE @search OR u.name LIKE @search)
        ORDER BY r.created_at DESC,r.id DESC OFFSET @offset ROWS FETCH NEXT 25 ROWS ONLY;
        SELECT COUNT(*) total FROM requests r JOIN users u ON u.id=r.user_id LEFT JOIN companies c ON c.code=r.company
        WHERE r.status='approved' AND r.type IN('id_card','visiting_card') AND ${vendorScope}
          AND (r.ref_id LIKE @search OR r.subject LIKE @search OR c.name LIKE @search OR u.name LIKE @search)`);
    const sets = result.recordsets as mssql.IRecordSet<any>[];
    res.json({ items: sets[0], total: sets[1][0].total, page });
  } catch { res.status(503).json({ error: 'Approved cards unavailable' }); }
});
router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid request' });
  try { res.json(await readVendorCard(pool, req.user!, id)); }
  catch (error) { fail(error, res); }
});
router.post('/send', async (req, res) => {
  try { res.json(await dispatchVendorCards(req.user!, req.body)); }
  catch (error) { fail(error, res); }
});
function fail(error: unknown, res: any) {
  if (!(error instanceof VendorError)) console.error('Vendor operation failed; check database and mail configuration');
  res.status(error instanceof VendorError ? error.status : 500)
    .json({ error: error instanceof VendorError ? error.message : 'Operation could not be confirmed. Reload dispatch status before retrying.' });
}
export default router;
