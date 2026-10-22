import { Router } from 'express';
import mssql from 'mssql';
import { pool } from '../db';
import { newApiKey, publicAppUrl } from '../services/sso';

/** Super Admin: SSO clients (HRMS integrations), their API keys and company → center mapping. */
const router = Router();

router.get('/', async (_req, res) => {
  try {
    const result = await pool.request().query(`
      SELECT c.id,c.name,c.key_prefix,c.is_active,c.created_at,c.rotated_at,c.last_used_at,u.name created_by_name,
        (SELECT COUNT(*) FROM users WHERE sso_client_id=c.id) user_count
      FROM sso_clients c JOIN users u ON u.id=c.created_by ORDER BY c.id;
      SELECT m.client_id,m.company,m.center_code,ce.name center_name FROM sso_company_map m
        LEFT JOIN centers ce ON ce.code=m.center_code ORDER BY m.company;`);
    const sets = result.recordsets as mssql.IRecordSet<Record<string, unknown>>[];
    res.json({ app_url: publicAppUrl(), clients: sets[0].map((client) => ({ ...client,
      companies: sets[1].filter((row) => row.client_id === client.id) })) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'SSO settings unavailable' });
  }
});

router.post('/', async (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name || name.length > 100) return res.status(400).json({ error: 'Enter a name for this integration (e.g. Green HR)' });
  const key = newApiKey();
  try {
    const result = await pool.request().input('name', mssql.NVarChar(100), name)
      .input('prefix', mssql.Char(8), key.prefix).input('hash', mssql.Char(64), key.hash).input('actor', mssql.Int, req.user!.id)
      .query(`INSERT INTO sso_clients(name,key_prefix,key_hash,created_by) OUTPUT inserted.id VALUES(@name,@prefix,@hash,@actor);
        INSERT INTO admin_audit_events(actor_id,event_type,note) VALUES(@actor,'sso_client_created',CONCAT('SSO client created: ',@name))`);
    res.status(201).json({ id: result.recordset[0].id, api_key: key.key });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Integration could not be created' });
  }
});

/** Issues a new key; the old one stops working immediately. */
router.post('/:id/rotate', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid integration' });
  const key = newApiKey();
  try {
    const result = await pool.request().input('id', mssql.Int, id).input('prefix', mssql.Char(8), key.prefix)
      .input('hash', mssql.Char(64), key.hash).input('actor', mssql.Int, req.user!.id)
      .query(`UPDATE sso_clients SET key_prefix=@prefix,key_hash=@hash,rotated_at=SYSUTCDATETIME() OUTPUT inserted.id WHERE id=@id;
        IF @@ROWCOUNT>0 INSERT INTO admin_audit_events(actor_id,event_type,note) VALUES(@actor,'sso_key_rotated',CONCAT('SSO key rotated for client #',@id))`);
    if (!result.recordset[0]) return res.status(404).json({ error: 'Integration not found' });
    res.json({ id, api_key: key.key });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Key could not be rotated' });
  }
});

router.patch('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const has = (field: string) => Object.prototype.hasOwnProperty.call(req.body ?? {}, field);
  const name = has('name') ? String(req.body.name || '').trim() : null;
  if (!Number.isInteger(id) || (name !== null && (!name || name.length > 100))
    || (has('is_active') && typeof req.body.is_active !== 'boolean')) return res.status(400).json({ error: 'Invalid update' });
  try {
    const result = await pool.request().input('id', mssql.Int, id).input('name', mssql.NVarChar(100), name)
      .input('active', mssql.Bit, has('is_active') ? req.body.is_active : null)
      .query(`UPDATE sso_clients SET name=COALESCE(@name,name),is_active=COALESCE(@active,is_active) OUTPUT inserted.id WHERE id=@id`);
    if (!result.recordset[0]) return res.status(404).json({ error: 'Integration not found' });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Integration could not be updated' });
  }
});

/** Replaces the company → default center mapping for one client. */
router.put('/:id/companies', async (req, res) => {
  const id = Number(req.params.id);
  const rows = Array.isArray(req.body?.companies) ? req.body.companies : null;
  if (!Number.isInteger(id) || !rows || rows.length > 200) return res.status(400).json({ error: 'Invalid company mapping' });
  const clean = rows.map((row: Record<string, unknown>) => ({ company: String(row.company || '').trim(),
    center: String(row.center_code || '').trim().toUpperCase() || null }));
  if (clean.some((row: { company: string }) => !row.company)
    || new Set(clean.map((row: { company: string }) => row.company)).size !== clean.length)
    return res.status(400).json({ error: 'Select each company once' });
  const tx = pool.transaction();
  try {
    await tx.begin();
    const exists = await new mssql.Request(tx).input('id', mssql.Int, id).query('SELECT 1 ok FROM sso_clients WHERE id=@id');
    if (!exists.recordset[0]) { await tx.rollback(); return res.status(404).json({ error: 'Integration not found' }); }
    for (const row of clean) {
      const check = await new mssql.Request(tx).input('company', mssql.NVarChar(100), row.company).input('cc', mssql.NVarChar(10), row.center)
        .query(`SELECT (SELECT COUNT(*) FROM companies WHERE name=@company) company_ok,
          CASE WHEN @cc IS NULL THEN 1 ELSE (SELECT COUNT(*) FROM centers WHERE code=@cc AND is_active=1) END center_ok`);
      if (!check.recordset[0].company_ok || !check.recordset[0].center_ok) {
        await tx.rollback();
        return res.status(400).json({ error: `Invalid company or center: ${row.company}${row.center ? ` → ${row.center}` : ''}` });
      }
    }
    // The mapping is configuration owned by this endpoint: it is replaced as a whole on every save.
    await new mssql.Request(tx).input('id', mssql.Int, id).query('DELETE FROM sso_company_map WHERE client_id=@id');
    for (const row of clean) await new mssql.Request(tx).input('id', mssql.Int, id)
      .input('company', mssql.NVarChar(100), row.company).input('cc', mssql.NVarChar(10), row.center)
      .query('INSERT INTO sso_company_map(client_id,company,center_code) VALUES(@id,@company,@cc)');
    await new mssql.Request(tx).input('actor', mssql.Int, req.user!.id).input('note', mssql.NVarChar(2000),
      `SSO companies for client #${id}: ${clean.map((row: { company: string; center: string | null }) => `${row.company}→${row.center ?? 'auto'}`).join(', ')}`)
      .query(`INSERT INTO admin_audit_events(actor_id,event_type,note) VALUES(@actor,'sso_mapping_updated',@note)`);
    await tx.commit();
    res.json({ success: true });
  } catch (error) {
    try { await tx.rollback(); } catch { /* already closed */ }
    console.error(error);
    res.status(500).json({ error: 'Company mapping could not be saved' });
  }
});

router.get('/events', async (req, res) => {
  const limit = Math.min(500, Math.max(10, Number(req.query.limit) || 100));
  try {
    const result = await pool.request().input('limit', mssql.Int, limit)
      .query(`SELECT TOP (@limit) e.id,e.event,e.employee_code,e.detail,e.ip,e.created_at,c.name client_name,u.name user_name
        FROM sso_events e LEFT JOIN sso_clients c ON c.id=e.client_id LEFT JOIN users u ON u.id=e.user_id
        ORDER BY e.created_at DESC,e.id DESC`);
    res.json(result.recordset);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'SSO activity unavailable' });
  }
});

export default router;
