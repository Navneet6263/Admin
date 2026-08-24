import { Router, Request, Response } from 'express';
import mssql from 'mssql';
import { pool, getCached, setCache, clearCache, VALID_STATUSES, type RequestStatus } from '../db';

const router = Router();

// ── GET /api/super-admin/requests ────────────────────────────────────────────
router.get('/requests', async (req: Request, res: Response) => {
  const company  = (req.query.company  as string) || 'all';
  const status   = (req.query.status   as string) || 'all';
  const cacheKey = `sa:requests:${company}:${status}`;
  const cached   = getCached<unknown[]>(cacheKey);
  if (cached) return res.json(cached);

  try {
    const result = await pool.request()
      .input('company', mssql.NVarChar, company)
      .input('status',  mssql.NVarChar, status)
      .query(`
        SELECT TOP 500
          r.id, r.ref_id, r.user_id, r.company, r.team,
          r.type, r.subject, r.description, r.amount,
          r.priority, r.status, r.created_at, r.updated_at,
          u.name AS employeeName, u.dept AS employeeDept
        FROM requests r
        JOIN users u ON r.user_id = u.id
        WHERE (@company = 'all' OR r.company = @company)
          AND (@status  = 'all' OR r.status  = @status)
        ORDER BY r.updated_at DESC
      `);
    setCache(cacheKey, result.recordset);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Query failed' });
  }
});

// ── POST /api/super-admin/requests/:id/override ──────────────────────────────
router.post('/requests/:id/override', async (req: Request, res: Response) => {
  const { next_status, note = '' } = req.body ?? {};

  if (!next_status || !VALID_STATUSES.includes(next_status as RequestStatus))
    return res.status(400).json({ error: 'Invalid next_status' });

  const tx = pool.transaction();
  try {
    await tx.begin();

    const updated = await tx.request()
      .input('id',     mssql.Int,      +req.params.id)
      .input('status', mssql.NVarChar, next_status)
      .query(`UPDATE requests SET status=@status,updated_at=GETDATE()
        OUTPUT inserted.user_id,inserted.ref_id WHERE id=@id`);
    const { user_id: userId, ref_id: refId } = updated.recordset[0] ?? {};
    if (!userId) {
      await tx.rollback();
      return res.status(404).json({ error: 'Request not found' });
    }

    await tx.request()
      .input('request_id', mssql.Int,     +req.params.id)
      .input('actor_id',   mssql.Int,     req.user!.id)
      .input('action',     mssql.NVarChar, next_status === 'approved' ? 'approved' : next_status === 'rejected' ? 'rejected' : 'commented')
      .input('note',       mssql.NVarChar, note || `Super Admin override → ${next_status}`)
      .query(`INSERT INTO approvals (request_id,actor_id,action,note) VALUES (@request_id,@actor_id,@action,@note)`);

    if (userId) {
      await tx.request()
        .input('user_id', mssql.Int,     userId)
        .input('message', mssql.NVarChar, `Your request ${refId} status updated to ${next_status} by Super Admin.`)
        .query(`INSERT INTO notifications (user_id,message) VALUES (@user_id,@message)`);
    }

    await tx.commit();
    // Bust all caches
    VALID_STATUSES.forEach(s => clearCache(`admin:requests:${s}`, `sa:requests:all:${s}`));
    clearCache('admin:stats', `employee:${userId}:requests`, 'verifier:queue');
    res.json({ success: true });
  } catch (err) {
    await tx.rollback();
    console.error(err);
    res.status(500).json({ error: 'Override failed' });
  }
});

// ── GET /api/super-admin/stats ───────────────────────────────────────────────
router.get('/stats', async (_req: Request, res: Response) => {
  const cached = getCached<unknown>('sa:stats');
  if (cached) return res.json(cached);

  try {
    const result = await pool.request().query(`
      SELECT
        r.company,
        SUM(CASE WHEN r.status = 'pending'               THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN r.status = 'approved'              THEN 1 ELSE 0 END) AS approved,
        SUM(CASE WHEN r.status = 'rejected'              THEN 1 ELSE 0 END) AS rejected,
        SUM(CASE WHEN r.status = 'awaiting_verification' THEN 1 ELSE 0 END) AS awaiting_verification,
        SUM(ISNULL(r.amount, 0))                                             AS total_spend,
        COUNT(*)                                                             AS total
      FROM requests r
      GROUP BY r.company
    `);
    setCache('sa:stats', result.recordset);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Stats failed' });
  }
});

// ── GET /api/super-admin/inventory ───────────────────────────────────────────
router.get('/inventory', async (_req: Request, res: Response) => {
  const cached = getCached<unknown[]>('sa:inventory');
  if (cached) return res.json(cached);

  try {
    const result = await pool.request().query(`
      SELECT sku, name, category, unit, price, qty, threshold, updated_at
      FROM inventory
      ORDER BY category, name
    `);
    setCache('sa:inventory', result.recordset);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Query failed' });
  }
});

// ── PATCH /api/super-admin/inventory/:sku ────────────────────────────────────
router.patch('/inventory/:sku', async (req: Request, res: Response) => {
  const { qty, note = 'Manual stock edit' } = req.body ?? {};
  if (typeof qty !== 'number' || qty < 0)
    return res.status(400).json({ error: 'qty must be a non-negative number' });

  const tx = pool.transaction();
  try {
    await tx.begin();

    const prev = await tx.request()
      .input('sku', mssql.NVarChar, req.params.sku)
      .query(`SELECT qty FROM inventory WHERE sku = @sku`);
    if (!prev.recordset[0]) { await tx.rollback(); return res.status(404).json({ error: 'SKU not found' }); }

    const prevQty = prev.recordset[0].qty as number;
    const diff    = qty - prevQty;
    const dir     = diff >= 0 ? 'in' : 'out';

    await tx.request()
      .input('sku', mssql.NVarChar, req.params.sku)
      .input('qty', mssql.Int,      qty)
      .query(`UPDATE inventory SET qty = @qty, updated_at = GETDATE() WHERE sku = @sku`);

    if (diff !== 0) {
      await tx.request()
        .input('sku',     mssql.NVarChar, req.params.sku)
        .input('dir',     mssql.NVarChar, dir)
        .input('qty',     mssql.Int,      Math.abs(diff))
        .input('bal',     mssql.Int,      qty)
        .input('actor',   mssql.NVarChar, `${req.user!.name} (#${req.user!.id})`)
        .input('note',    mssql.NVarChar, note)
        .query(`
          INSERT INTO stock_movements (sku,direction,qty,balance_after,source,actor,note)
          VALUES (@sku,@dir,@qty,@bal,'adjustment',@actor,@note)
        `);
    }

    await tx.commit();
    clearCache('sa:inventory');
    res.json({ success: true, qty });
  } catch (err) {
    await tx.rollback();
    console.error(err);
    res.status(500).json({ error: 'Update failed' });
  }
});

// ── GET /api/super-admin/inventory/movements ─────────────────────────────────
router.get('/inventory/movements', async (req: Request, res: Response) => {
  const sku = req.query.sku as string | undefined;
  try {
    const result = await pool.request()
      .input('sku', mssql.NVarChar, sku || null)
      .query(`
        SELECT TOP 200
          m.id, m.sku, i.name, i.category,
          m.direction, m.qty, m.balance_after,
          m.source, m.ref_id, m.actor, m.note, m.created_at
        FROM stock_movements m
        JOIN inventory i ON m.sku = i.sku
        WHERE (@sku IS NULL OR m.sku = @sku)
        ORDER BY m.created_at DESC
      `);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Query failed' });
  }
});

export default router;
