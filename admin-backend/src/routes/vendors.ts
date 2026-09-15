import { Router } from 'express';
import mssql from 'mssql';
import { requireAuth } from '../auth';
import { pool } from '../db';
import { emailValid, VendorError } from '../services/vendorPolicy';

const router = Router();
router.get('/', async (req, res) => {
  const page = Math.max(1, Math.floor(Number(req.query.page) || 1));
  const search = String(req.query.search || '').slice(0, 120);
  const activeOnly = req.user!.role === 'center_admin' || req.query.active === '1';
  try {
    const result = await pool.request().input('offset', mssql.Int, (page - 1) * 25)
      .input('search', mssql.NVarChar(254), `%${search}%`).input('active', mssql.Bit, activeOnly)
      .query(`SELECT id,name,contact_name,email,phone,service,is_active FROM vendors
        WHERE (@active=0 OR is_active=1) AND (name LIKE @search OR email LIKE @search)
        ORDER BY name,id OFFSET @offset ROWS FETCH NEXT 25 ROWS ONLY;
        SELECT COUNT(*) total FROM vendors WHERE (@active=0 OR is_active=1) AND (name LIKE @search OR email LIKE @search)`);
    const sets = result.recordsets as mssql.IRecordSet<any>[];
    res.json({ items: sets[0], total: sets[1][0].total, page });
  } catch (error) { console.error('Vendor list unavailable'); res.status(503).json({ error: 'Vendors unavailable' }); }
});

router.use(requireAuth('hq_admin', 'super_admin'));
router.post('/', save);
router.put('/:id', save);
async function save(req: any, res: any) {
  const b = req.body || {};
  const name = typeof b.name === 'string' ? b.name.trim() : '';
  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
  const contact = typeof b.contact_name === 'string' ? b.contact_name.trim() : '';
  const phone = typeof b.phone === 'string' ? b.phone.trim() : '';
  const id = req.params.id ? Number(req.params.id) : null;
  if (!name || name.length > 120 || !emailValid(email) || contact.length > 120 || phone.length > 30
    || /[\r\n]/.test(name + contact) || !['id_card', 'visiting_card', 'both'].includes(b.service)
    || typeof b.is_active !== 'boolean' || (id !== null && (!Number.isInteger(id) || id < 1)))
    return res.status(400).json({ error: 'Enter a valid vendor name, email, service and status' });
  const tx = pool.transaction();
  try {
    await tx.begin();
    const saved = await tx.request().input('id', mssql.Int, id).input('name', mssql.NVarChar(120), name)
      .input('email', mssql.NVarChar(254), email).input('contact', mssql.NVarChar(120), contact)
      .input('phone', mssql.NVarChar(30), phone).input('service', mssql.VarChar(20), b.service)
      .input('active', mssql.Bit, b.is_active).input('actor', mssql.Int, req.user.id).query(id === null
        ? `INSERT INTO vendors(name,email,contact_name,phone,service,is_active,created_by)
            OUTPUT inserted.id VALUES(@name,@email,@contact,@phone,@service,@active,@actor)`
        : `UPDATE vendors SET name=@name,email=@email,contact_name=@contact,phone=@phone,service=@service,
            is_active=@active,updated_at=SYSUTCDATETIME() OUTPUT inserted.id WHERE id=@id`);
    if (!saved.recordset[0]) throw new VendorError(404, 'Vendor not found');
    await tx.request().input('id', mssql.Int, saved.recordset[0].id).input('actor', mssql.Int, req.user.id)
      .input('action', mssql.VarChar(20), id === null ? 'created' : 'updated')
      .input('details', mssql.NVarChar(1000), JSON.stringify({ name, email, contact, phone, service: b.service, active: b.is_active }))
      .query('INSERT INTO vendor_audit(vendor_id,actor_id,action,details) VALUES(@id,@actor,@action,@details)');
    await tx.commit();
    res.status(id === null ? 201 : 200).json(saved.recordset[0]);
  } catch (error: any) {
    await tx.rollback().catch(() => {});
    const duplicate = [2601, 2627].includes(error?.number);
    res.status(error instanceof VendorError ? error.status : duplicate ? 409 : 500)
      .json({ error: error instanceof VendorError ? error.message : duplicate ? 'A vendor with this email already exists' : 'Vendor could not be saved' });
  }
}
export default router;
