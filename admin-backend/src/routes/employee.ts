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
          r.id, r.ref_id, r.user_id, r.company, r.team, r.type, r.subject, r.description,
          r.amount, r.priority, r.status, r.details,
          u.name AS employeeName, u.dept AS employeeDept,
          r.created_at, r.updated_at
        FROM requests r
        LEFT JOIN users u ON r.user_id = u.id
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
      .input('user_id',     mssql.Int,                user_id)
      .input('company',     mssql.NVarChar(100),      company)
      .input('team',        mssql.NVarChar(100),      team)
      .input('type',        mssql.NVarChar(30),       type)
      .input('subject',     mssql.NVarChar(mssql.MAX), subject.trim())
      .input('description', mssql.NVarChar(mssql.MAX), description.trim())
      .input('amount',      mssql.Decimal(14, 2),     amount != null && !isNaN(Number(amount)) ? Number(amount) : null)
      .input('priority',    mssql.NVarChar(20),       priority)
      .input('details',     mssql.NVarChar(mssql.MAX), details ? JSON.stringify(details) : null)
      .query(`
        INSERT INTO requests (user_id,company,team,type,subject,description,amount,priority,details)
        OUTPUT inserted.id, inserted.ref_id, inserted.user_id, inserted.company, inserted.team, inserted.type, inserted.subject, inserted.description, inserted.amount, inserted.priority, inserted.status, inserted.details, inserted.created_at, inserted.updated_at
        VALUES (@user_id,@company,@team,@type,@subject,@description,@amount,@priority,@details)
      `);

    const insertedRow = result.recordset[0];
    if (insertedRow?.id) {
      try {
        await pool.request()
          .input('request_id', mssql.Int,           insertedRow.id)
          .input('actor_id',   mssql.Int,           user_id)
          .input('action',     mssql.NVarChar(30),  'raised')
          .input('note',       mssql.NVarChar(200), 'Request raised by employee')
          .query(`INSERT INTO approvals (request_id, actor_id, action, note) VALUES (@request_id, @actor_id, @action, @note)`);
      } catch (auditErr) {
        console.warn('Audit log insert warning:', auditErr);
      }
    }

    clearCache(`employee:${user_id}:requests`, 'admin:stats', 'admin:requests:pending');
    res.status(201).json(insertedRow);
  } catch (err) {
    console.error('Request creation error:', err);
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

// ── PATCH /api/employee/requests/:id/cancel ──────────────────────────────────
router.patch('/requests/:id/cancel', async (req: Request, res: Response) => {
  const reqId = parseInt(req.params.id);
  const { user_id, note = 'Withdrawn by requester' } = req.body ?? {};
  if (isNaN(reqId)) return res.status(400).json({ error: 'Invalid request ID' });

  try {
    await pool.request()
      .input('id', mssql.Int, reqId)
      .query(`UPDATE requests SET status='rejected', updated_at=GETDATE() WHERE id=@id AND status IN ('pending','queued','info_requested')`);

    if (user_id) {
      await pool.request()
        .input('request_id', mssql.Int, reqId)
        .input('actor_id',   mssql.Int, user_id)
        .input('action',     mssql.NVarChar, 'withdrawn')
        .input('note',       mssql.NVarChar, note)
        .query(`INSERT INTO approvals (request_id, actor_id, action, note) VALUES (@request_id, @actor_id, @action, @note)`);

      clearCache(`employee:${user_id}:requests`, 'admin:stats', 'admin:requests:pending');
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Cancel failed' });
  }
});

export default router;
