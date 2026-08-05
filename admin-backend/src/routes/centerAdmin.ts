import { Router, Request, Response } from 'express';
import mssql from 'mssql';
import { pool, clearCache, getCached, setCache } from '../db';
import { requireAuth } from '../auth';
import { chargeCenter } from './routingEngine';

const router = Router();
router.use(requireAuth('center_admin', 'super_admin'));
router.use(['/requests/:id/approve','/requests/:id/reject'], (_req, res) =>
  res.status(410).json({ error: 'Legacy action retired; use /api/workflow' }));

// ── GET /api/center-admin/requests?status=pending ────────────
router.get('/requests', async (req: Request, res: Response) => {
  const centerCode = req.user?.center_code || String(req.query.center_code || '');
  if (!centerCode) return res.status(400).json({ error: 'A center assignment is required' });
  const status     = (req.query.status as string) || 'pending';

  const key    = `ca:${centerCode}:${status}`;
  const cached = getCached<unknown[]>(key);
  if (cached) return res.json(cached);

  try {
    const result = await pool.request()
      .input('cc',     mssql.NVarChar(10), centerCode)
      .input('status', mssql.NVarChar(30), status)
      .query(`
        SELECT TOP 200
          r.id, r.ref_id, r.type, r.subject, r.amount,
          r.priority, r.status, r.created_at, r.updated_at,
          r.home_center_code,
          r.fulfil_center_code,
          u.name AS employeeName, u.email, ISNULL(u.dept, r.team) AS employeeDept
        FROM requests r
        LEFT JOIN users u ON r.user_id = u.id
        WHERE (@status = 'all' OR r.status = @status)
          AND r.home_center_code = @cc
        ORDER BY
          CASE r.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
          r.created_at DESC
      `);
    setCache(key, result.recordset);
    res.json(result.recordset);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Query failed' }); }
});

// ── GET /api/center-admin/budget ─────────────────────────────
router.get('/budget', async (req: Request, res: Response) => {
  const centerCode = req.user?.center_code || String(req.query.center_code || '');
  if (!centerCode) return res.status(400).json({ error: 'A center assignment is required' });

  try {
    const m = new Date().getMonth() + 1;
    const y = new Date().getFullYear();
    const result = await pool.request()
      .input('cc', mssql.NVarChar(10), centerCode)
      .input('m',  mssql.TinyInt, m)
      .input('y',  mssql.SmallInt, y)
      .query(`
        SELECT ISNULL(cb.allocated, 0) AS allocated,
               ISNULL(cb.committed, 0) AS committed,
               ISNULL(cb.spent, 0) AS spent,
               c.name AS center_name, c.city
        FROM centers c
        LEFT JOIN center_budgets cb ON c.code = cb.center_code AND cb.month = @m AND cb.year = @y
        WHERE c.code = @cc
      `);

    const row = result.recordset[0];
    if (!row) return res.status(404).json({ error: 'Center not found' });
    res.json(row);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Budget query failed' }); }
});

// ── GET /api/center-admin/stats ───────────────────────────────
router.get('/stats', async (req: Request, res: Response) => {
  const centerCode = req.user?.center_code || String(req.query.center_code || '');
  if (!centerCode) return res.status(400).json({ error: 'A center assignment is required' });

  try {
    const result = await pool.request()
      .input('cc', mssql.NVarChar(10), centerCode)
      .query(`
        SELECT
          SUM(CASE WHEN status='pending'               THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN status='approved'              THEN 1 ELSE 0 END) AS approved,
          SUM(CASE WHEN status='rejected'              THEN 1 ELSE 0 END) AS rejected,
          SUM(CASE WHEN status='awaiting_verification' THEN 1 ELSE 0 END) AS awaiting_verification,
          COUNT(*) AS total,
          ISNULL(AVG(DATEDIFF(HOUR, created_at, ISNULL(updated_at, GETDATE()))), 0) AS avg_response_hrs
        FROM requests
        WHERE home_center_code = @cc
      `);
    res.json(result.recordset[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Stats failed' }); }
});

// ── POST /api/center-admin/requests/:id/approve ───────────────
router.post('/requests/:id/approve', async (req: Request, res: Response) => {
  const { remarks = '' } = req.body;
  const actorId = req.user?.id;
  const id = +req.params.id;
  const tx = pool.transaction();

  try {
    await tx.begin();
    const reqRow = await tx.request()
      .input('id', mssql.Int, id)
      .query(`SELECT user_id, ref_id, amount, home_center_code FROM requests WHERE id=@id`);
    const { user_id, ref_id, amount, home_center_code } = reqRow.recordset[0] ?? {};

    await tx.request()
      .input('id', mssql.Int, id)
      .query(`UPDATE requests SET status='awaiting_verification', updated_at=GETDATE() WHERE id=@id`);

    await tx.request()
      .input('rid', mssql.Int, id)
      .input('actor', mssql.Int, actorId)
      .input('note', mssql.NVarChar(1000), remarks || null)
      .query(`INSERT INTO approvals(request_id,actor_id,action,note) VALUES(@rid,@actor,'approved',@note)`);

    if (amount && home_center_code) await chargeCenter(home_center_code, amount, tx);

    await tx.request()
      .input('uid', mssql.Int, user_id)
      .input('msg', mssql.NVarChar(500), `Your request ${ref_id} was approved.`)
      .query(`INSERT INTO notifications(user_id,message) VALUES(@uid,@msg)`);

    await tx.commit();
    clearCache(`ca:${home_center_code}:pending`, 'cmd:health', 'cmd:burn');
    res.json({ success: true });
  } catch (err) { await tx.rollback(); console.error(err); res.status(500).json({ error: 'Approve failed' }); }
});

// ── POST /api/center-admin/requests/:id/reject ────────────────
router.post('/requests/:id/reject', async (req: Request, res: Response) => {
  const { remarks = '' } = req.body;
  const actorId = req.user?.id;
  const id = +req.params.id;

  try {
    await pool.request().input('id', mssql.Int, id)
      .query(`UPDATE requests SET status='rejected', updated_at=GETDATE() WHERE id=@id`);
    await pool.request()
      .input('rid', mssql.Int, id).input('actor', mssql.Int, actorId)
      .input('note', mssql.NVarChar(1000), remarks || null)
      .query(`INSERT INTO approvals(request_id,actor_id,action,note) VALUES(@rid,@actor,'rejected',@note)`);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Reject failed' }); }
});

export default router;
