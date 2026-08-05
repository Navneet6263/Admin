import { Router, Request, Response } from 'express';
import mssql from 'mssql';
import { pool, getCached, setCache } from '../db';
import { requireAuth } from '../auth';

const router = Router();
router.use(requireAuth('super_admin', 'admin'));

// ── GET /api/dashboard/command-center ────────────────────────
// Returns health score for every center (Green / Amber / Red)
router.get('/command-center', async (_req: Request, res: Response) => {
  const cached = getCached<unknown>('cmd:health');
  if (cached) return res.json(cached);

  try {
    const m = new Date().getMonth() + 1;
    const y = new Date().getFullYear();

    const result = await pool.request()
      .input('m', mssql.TinyInt, m)
      .input('y', mssql.SmallInt, y)
      .query(`
        SELECT
          c.code, c.name, c.city, c.is_active,
          ISNULL(cb.allocated, 0)  AS allocated,
          ISNULL(cb.committed, 0)  AS committed,
          ISNULL(cb.spent, 0)      AS spent,
          ISNULL(stats.pending, 0) AS pending_requests,
          ISNULL(stats.total, 0)   AS total_requests,
          ISNULL(stats.avg_hrs, 0) AS avg_response_hrs,
          u.name AS admin_name
        FROM centers c
        LEFT JOIN center_budgets cb
          ON cb.center_code = c.code AND cb.month = @m AND cb.year = @y
        LEFT JOIN users u ON u.id = c.hq_admin_id
        LEFT JOIN (
          SELECT home_center_code,
            SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending,
            COUNT(*) AS total,
            AVG(DATEDIFF(HOUR, created_at, ISNULL(updated_at, GETDATE()))) AS avg_hrs
          FROM requests
          GROUP BY home_center_code
        ) stats ON stats.home_center_code = c.code
        WHERE c.is_active = 1
        ORDER BY c.code
      `);

    // Compute health score per center
    const data = result.recordset.map((row: any) => {
      const burnPct = row.allocated > 0 ? (row.spent / row.allocated) * 100 : 0;
      let health: 'green' | 'amber' | 'red' = 'green';
      if (burnPct > 90 || row.avg_response_hrs > 24) health = 'red';
      else if (burnPct > 70 || row.avg_response_hrs > 12) health = 'amber';
      return { ...row, burn_pct: Math.round(burnPct), health };
    });

    setCache('cmd:health', data, 60); // 60s cache
    res.json(data);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Command center query failed' }); }
});

// ── GET /api/dashboard/burn-rate ─────────────────────────────
// Predicted month-end spend per center
router.get('/burn-rate', async (_req: Request, res: Response) => {
  const cached = getCached<unknown>('cmd:burn');
  if (cached) return res.json(cached);

  try {
    const now = new Date();
    const m   = now.getMonth() + 1;
    const y   = now.getFullYear();
    const daysInMonth  = new Date(y, m, 0).getDate();
    const daysPassed   = now.getDate();

    const result = await pool.request()
      .input('m', mssql.TinyInt, m)
      .input('y', mssql.SmallInt, y)
      .query(`
        SELECT cb.center_code, c.name, c.city,
               cb.allocated, cb.spent, cb.committed
        FROM center_budgets cb
        JOIN centers c ON c.code = cb.center_code
        WHERE cb.month = @m AND cb.year = @y
      `);

    const data = result.recordset.map((row: any) => {
      const dailyBurn      = daysPassed > 0 ? row.spent / daysPassed : 0;
      const projectedSpend = dailyBurn * daysInMonth;
      const daysLeft       = daysInMonth - daysPassed;
      const remainingBudget = row.allocated - row.spent;
      const daysUntilEmpty = dailyBurn > 0 ? Math.floor(remainingBudget / dailyBurn) : 999;
      const overrun        = projectedSpend > row.allocated;

      return {
        center_code:      row.center_code,
        name:             row.name,
        city:             row.city,
        allocated:        row.allocated,
        spent:            row.spent,
        projected_spend:  Math.round(projectedSpend),
        days_left:        daysLeft,
        days_until_empty: daysUntilEmpty,
        overrun,
        overrun_amount:   overrun ? Math.round(projectedSpend - row.allocated) : 0,
      };
    });

    setCache('cmd:burn', data, 120);
    res.json(data);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Burn rate query failed' }); }
});

// ── GET /api/dashboard/peer-comparison ───────────────────────
// Center rankings: response time, approval rate, request volume
router.get('/peer-comparison', async (_req: Request, res: Response) => {
  try {
    const result = await pool.request().query(`
      SELECT
        c.code, c.name, c.city,
        COUNT(r.id)                                                   AS total_requests,
        SUM(CASE WHEN r.status='approved' THEN 1 ELSE 0 END)         AS approved,
        SUM(CASE WHEN r.status='rejected' THEN 1 ELSE 0 END)         AS rejected,
        SUM(CASE WHEN r.status='pending'  THEN 1 ELSE 0 END)         AS pending,
        AVG(DATEDIFF(HOUR, r.created_at, ISNULL(r.updated_at, GETDATE()))) AS avg_response_hrs,
        ISNULL(SUM(r.amount), 0)                                     AS total_spent
      FROM centers c
      LEFT JOIN requests r ON r.home_center_code = c.code
      WHERE c.is_active = 1
      GROUP BY c.code, c.name, c.city
      ORDER BY avg_response_hrs ASC
    `);
    res.json(result.recordset);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Peer comparison failed' }); }
});

// ── GET /api/dashboard/activity-feed ─────────────────────────
// Last 20 actions across all centers
router.get('/activity-feed', async (_req: Request, res: Response) => {
  try {
    const result = await pool.request().query(`
      SELECT TOP 20
        a.action, a.note, a.created_at,
        u_actor.name  AS actor,
        u_emp.name    AS employee,
        r.ref_id, r.type, r.amount,
        r.home_center_code,
        c.name AS center_name
      FROM approvals a
      JOIN requests r      ON r.id = a.request_id
      JOIN users u_actor   ON u_actor.id = a.actor_id
      JOIN users u_emp     ON u_emp.id   = r.user_id
      LEFT JOIN centers c  ON c.code = r.home_center_code
      ORDER BY a.created_at DESC
    `);
    res.json(result.recordset);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Activity feed failed' }); }
});

export default router;
