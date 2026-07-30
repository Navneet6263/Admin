import { Router, Request, Response } from 'express';
import mssql from 'mssql';
import { pool, getCached, setCache, clearCache, VALID_TYPES } from '../db';

const router = Router();

// ── GET /api/employee/requests/:userId ───────────────────────────────────────
router.get('/requests/:userId', async (req: Request, res: Response) => {
  const userId = parseInt(req.params.userId);
  if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });

  const cacheKey = `employee:${userId}:requests`;
  const cached = getCached<unknown[]>(cacheKey);
  if (cached) return res.json(cached);

  try {
    const result = await pool.request()
      .input('user_id', mssql.Int, userId)
      .query(`
        SELECT
          r.id, r.ref_id, r.type, r.subject, r.description,
          r.amount, r.priority, r.status, r.details,
          r.created_at, r.updated_at
        FROM requests r
        WHERE r.user_id = @user_id
        ORDER BY r.created_at DESC
      `);
    setCache(cacheKey, result.recordset);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Query failed' });
  }
});

// ── POST /api/employee/requests ──────────────────────────────────────────────
router.post('/requests', async (req: Request, res: Response) => {
  const { user_id, type, subject, description = '', amount, priority = 'normal', details } = req.body;

  if (!user_id || !type || !VALID_TYPES.includes(type))
    return res.status(400).json({ error: 'user_id and valid type are required' });
  if (!subject?.trim())
    return res.status(400).json({ error: 'subject is required' });

  // Fetch user's company + team
  let company = 'VT', team = '';
  try {
    const u = await pool.request()
      .input('id', mssql.Int, user_id)
      .query(`SELECT company, dept FROM users WHERE id = @id`);
    if (!u.recordset[0]) return res.status(404).json({ error: 'User not found' });
    company = u.recordset[0].company;
    team    = u.recordset[0].dept;
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'User lookup failed' });
  }

  try {
    const result = await pool.request()
      .input('user_id',     mssql.Int,        user_id)
      .input('company',     mssql.NVarChar,   company)
      .input('team',        mssql.NVarChar,   team)
      .input('type',        mssql.NVarChar,   type)
      .input('subject',     mssql.NVarChar,   subject.trim())
      .input('description', mssql.NVarChar,   description.trim())
      .input('amount',      mssql.Decimal,    amount ?? null)
      .input('priority',    mssql.NVarChar,   priority)
      .input('details',     mssql.NVarChar,   details ? JSON.stringify(details) : null)
      .query(`
        INSERT INTO requests (user_id,company,team,type,subject,description,amount,priority,details)
        OUTPUT inserted.id, inserted.ref_id, inserted.status, inserted.created_at
        VALUES (@user_id,@company,@team,@type,@subject,@description,@amount,@priority,@details)
      `);

    clearCache(`employee:${user_id}:requests`, 'admin:stats', 'admin:requests:pending');
    res.status(201).json(result.recordset[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Creation failed' });
  }
});

// ── GET /api/employee/notifications/:userId ──────────────────────────────────
router.get('/notifications/:userId', async (req: Request, res: Response) => {
  const userId = parseInt(req.params.userId);
  if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });

  try {
    const result = await pool.request()
      .input('user_id', mssql.Int, userId)
      .query(`
        SELECT TOP 30 id, message, is_read AS [read], created_at
        FROM notifications
        WHERE user_id = @user_id
        ORDER BY created_at DESC
      `);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Query failed' });
  }
});

// ── PATCH /api/employee/notifications/:id/read ───────────────────────────────
router.patch('/notifications/:id/read', async (req: Request, res: Response) => {
  try {
    await pool.request()
      .input('id', mssql.Int, +req.params.id)
      .query(`UPDATE notifications SET is_read = 1 WHERE id = @id`);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Update failed' });
  }
});

export default router;
