import { Router, Request, Response } from 'express';
import mssql from 'mssql';
import { pool, getCached, setCache, clearCache, type RequestStatus } from '../db';

const router = Router();

// ── GET /api/admin/requests?status=pending ───────────────────────────────────
router.get('/requests', async (req: Request, res: Response) => {
  const status = (req.query.status as string) || 'pending';
  const cacheKey = `admin:requests:${status}`;
  const cached = getCached<unknown[]>(cacheKey);
  if (cached) return res.json(cached);

  try {
    const result = await pool.request()
      .input('status', mssql.NVarChar, status)
      .query(`
        SELECT TOP 200
          r.id, r.ref_id, r.user_id, r.company, r.team,
          r.type, r.subject, r.description, r.amount,
          r.priority, r.status, r.details,
          r.created_at, r.updated_at,
          u.name AS employeeName, u.email, u.dept AS employeeDept
        FROM requests r
        JOIN users u ON r.user_id = u.id
        WHERE r.status = @status
        ORDER BY
          CASE r.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
          r.created_at DESC
      `);
    setCache(cacheKey, result.recordset);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Query failed' });
  }
});

// ── GET /api/admin/stats ─────────────────────────────────────────────────────
router.get('/stats', async (_req: Request, res: Response) => {
  const cached = getCached<unknown>('admin:stats');
  if (cached) return res.json(cached);

  try {
    const result = await pool.request().query(`
      SELECT
        SUM(CASE WHEN status = 'pending'               THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status = 'queued'                THEN 1 ELSE 0 END) AS queued,
        SUM(CASE WHEN status = 'awaiting_verification' THEN 1 ELSE 0 END) AS awaiting_verification,
        SUM(CASE WHEN status = 'approved'              THEN 1 ELSE 0 END) AS approved,
        SUM(CASE WHEN status = 'rejected'              THEN 1 ELSE 0 END) AS rejected,
        SUM(CASE WHEN status = 'info_requested'        THEN 1 ELSE 0 END) AS info_requested,
        COUNT(*) AS total
      FROM requests
    `);
    setCache('admin:stats', result.recordset[0]);
    res.json(result.recordset[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Stats query failed' });
  }
});

// ── Shared action handler ────────────────────────────────────────────────────
async function applyAction(
  id: number,
  actorId: number,
  nextStatus: RequestStatus,
  action: string,
  note: string,
  res: Response,
) {
  const tx = pool.transaction();
  try {
    await tx.begin();

    await tx.request()
      .input('id', mssql.Int, id)
      .input('status', mssql.NVarChar, nextStatus)
      .query(`UPDATE requests SET status = @status, updated_at = GETDATE() WHERE id = @id`);

    const userRes = await tx.request()
      .input('id', mssql.Int, id)
      .query(`SELECT user_id, ref_id, type, details FROM requests WHERE id = @id`);

    const { user_id: userId, ref_id: refId, type, details } = userRes.recordset[0] ?? {};

    if (action === 'approved' && type === 'stationery' && details) {
      const picks = JSON.parse(details).items as Array<{ sku?: string; qty?: number }> | undefined;
      for (const pick of picks ?? []) {
        if (!pick.sku || !Number.isInteger(pick.qty) || pick.qty < 1) continue;
        const stock = await tx.request().input('sku', mssql.NVarChar(30), pick.sku).query('SELECT qty FROM inventory WITH (UPDLOCK, ROWLOCK) WHERE sku=@sku');
        const onHand = stock.recordset[0]?.qty;
        if (onHand === undefined || onHand < pick.qty) throw new Error(`Insufficient stock for ${pick.sku}`);
        const balance = onHand - pick.qty;
        await tx.request().input('sku', mssql.NVarChar(30), pick.sku).input('qty', mssql.Int, balance).query('UPDATE inventory SET qty=@qty,updated_at=GETDATE() WHERE sku=@sku');
        await tx.request().input('sku', mssql.NVarChar(30), pick.sku).input('qty', mssql.Int, pick.qty).input('balance', mssql.Int, balance).input('ref', mssql.NVarChar(20), refId).input('actor', mssql.NVarChar(120), `Admin #${actorId}`).query("INSERT INTO stock_movements(sku,direction,qty,balance_after,source,ref_id,actor,note) VALUES(@sku,'out',@qty,@balance,'request',@ref,@actor,'Issued against approved request')");
      }
    }

    await tx.request()
      .input('request_id', mssql.Int, id)
      .input('actor_id', mssql.Int, actorId)
      .input('action', mssql.NVarChar, action)
      .input('note', mssql.NVarChar, note || null)
      .query(`INSERT INTO approvals (request_id,actor_id,action,note) VALUES (@request_id,@actor_id,@action,@note)`);

    if (userId && refId) {
      const msg = `Your request ${refId} has been ${action.replace('_', ' ')}.`;
      await tx.request()
        .input('user_id', mssql.Int, userId)
        .input('message', mssql.NVarChar, msg)
        .query(`INSERT INTO notifications (user_id,message) VALUES (@user_id,@message)`);
    }

    await tx.commit();

    // Bust all status caches + stats
    clearCache(
      'admin:requests:pending', 'admin:requests:queued',
      'admin:requests:awaiting_verification', 'admin:requests:approved',
      'admin:requests:rejected', 'admin:stats',
      `employee:${userId}:requests`,
    );
    res.json({ success: true });
  } catch (err) {
    await tx.rollback();
    console.error(err);
    res.status(500).json({ error: 'Action failed' });
  }
}

// ── POST /api/admin/requests/:id/approve ────────────────────────────────────
router.post('/requests/:id/approve', async (req: Request, res: Response) => {
  const { remarks = '', admin_id = 7 } = req.body;
  await applyAction(+req.params.id, admin_id, 'awaiting_verification', 'approved', remarks, res);
});

// ── POST /api/admin/requests/:id/reject ─────────────────────────────────────
router.post('/requests/:id/reject', async (req: Request, res: Response) => {
  const { remarks = '', admin_id = 7 } = req.body;
  await applyAction(+req.params.id, admin_id, 'rejected', 'rejected', remarks, res);
});

// ── POST /api/admin/requests/:id/queue ──────────────────────────────────────
router.post('/requests/:id/queue', async (req: Request, res: Response) => {
  const { remarks = '', admin_id = 7 } = req.body;
  await applyAction(+req.params.id, admin_id, 'queued', 'queued', remarks, res);
});

// ── POST /api/admin/requests/:id/info ───────────────────────────────────────
router.post('/requests/:id/info', async (req: Request, res: Response) => {
  const { remarks = '', admin_id = 7 } = req.body;
  await applyAction(+req.params.id, admin_id, 'info_requested', 'info_requested', remarks, res);
});

// ── GET /api/admin/requests/:id/audit ───────────────────────────────────────
router.get('/requests/:id/audit', async (req: Request, res: Response) => {
  try {
    const result = await pool.request()
      .input('id', mssql.Int, +req.params.id)
      .query(`
        SELECT a.action, a.note, a.created_at, u.name AS actor
        FROM approvals a
        JOIN users u ON a.actor_id = u.id
        WHERE a.request_id = @id
        ORDER BY a.created_at ASC
      `);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Query failed' });
  }
});

export default router;
