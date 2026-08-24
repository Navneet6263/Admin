import { Router, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import mssql from 'mssql';
import { pool, getCached, setCache, clearCache, VALID_TYPES, withDbRetry } from '../db';
import { createEmployeeRequest } from '../services/requestCreation';
import { notifyWorkflowCreated } from '../services/workflow';

const router = Router();

// ── GET /api/employee/requests/:userId ───────────────────────────────────────
router.get('/requests/:userId', async (req: Request, res: Response) => {
  const userId = parseInt(req.params.userId);
  if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });
  if (userId !== req.user?.id) return res.status(403).json({ error: 'You can only view your own requests' });

  const cacheKey = `employee:${userId}:requests`;
  const cached = getCached<unknown[]>(cacheKey);
  if (cached) return res.json(cached);

  try {
    const result = await withDbRetry(() => pool.request()
      .input('user_id', mssql.Int, userId)
      .query(`
        SELECT
          r.id, r.ref_id, r.user_id, r.company, r.team, r.type, r.subject, r.description,
          CASE WHEN r.type='stationery' THEN NULL ELSE r.amount END amount,
          r.priority, r.status, CASE WHEN r.type='stationery' THEN NULL ELSE r.details END details,
          u.name AS employeeName, u.dept AS employeeDept,
          r.created_at, r.updated_at
        FROM requests r
        LEFT JOIN users u ON r.user_id = u.id
        WHERE r.user_id = @user_id
        ORDER BY r.created_at DESC
      `));
    setCache(cacheKey, result.recordset);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Query failed' });
  }
});

// ── POST /api/employee/requests ──────────────────────────────────────────────
router.post('/requests', async (req: Request, res: Response) => {
  const { type, subject, description = '', amount, priority = 'normal', details,
    request_center_code, client_request_id } = req.body;
  const user_id = req.user!.id;

  if (!user_id || !type || !VALID_TYPES.includes(type))
    return res.status(400).json({ error: 'user_id and valid type are required' });
  if (!subject?.trim())
    return res.status(400).json({ error: 'subject is required' });
  if (client_request_id && !/^[a-zA-Z0-9._-]{8,64}$/.test(String(client_request_id)))
    return res.status(400).json({ error: 'Invalid submission key' });

  try {
    const insertedRow = await createEmployeeRequest({ userId: user_id, type, subject,
      description, amount: amount != null && !isNaN(Number(amount)) ? Number(amount) : null,
      priority, details, requestCenter: request_center_code, clientRequestId: client_request_id || randomUUID() });
    clearCache(`employee:${user_id}:requests`, 'admin:stats', 'admin:requests:pending');
    res.status(insertedRow.deduplicated ? 200 : 201).json(insertedRow);
    if (!insertedRow.deduplicated) void notifyWorkflowCreated({ ref: insertedRow.ref_id,
      homeCenter: insertedRow.homeCenter, requestCenter: insertedRow.requestCenter,
      approvalRole: insertedRow.approvalRole, approvalUserId: insertedRow.approvalUserId, category: type,
    }).catch((error) => console.error('Request notification error:', error));
  } catch (err) {
    console.error('Request creation error:', err);
    const message = err instanceof Error ? err.message : '';
    const expected = ['User not found or inactive', 'Employee has no home center assigned', 'Invalid request center',
      'Stationery items are required', 'Valid stationery items are required', 'Select a valid food booking date and time',
      'Food service time must be between 10:00 AM and 8:00 PM', 'Today food booking is available from 10:00 AM to 8:00 PM']
      .concat('Complete the Vision India ID-card preview before submitting')
      .find((item) => message.includes(item));
    res.status(expected ? 400 : 500).json({ error: expected || 'Creation failed' });
  }
});

// ── GET /api/employee/notifications/:userId ──────────────────────────────────
router.get('/notifications/:userId', async (req: Request, res: Response) => {
  const userId = parseInt(req.params.userId);
  if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });
  if (userId !== req.user?.id) return res.status(403).json({ error: 'You can only view your own notifications' });

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
    const result = await pool.request()
      .input('id', mssql.Int, +req.params.id)
      .input('uid', mssql.Int, req.user!.id)
      .query(`UPDATE notifications SET is_read = 1 OUTPUT inserted.id
        WHERE id = @id AND user_id=@uid`);
    if (!result.recordset[0]) return res.status(404).json({ error: 'Notification not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Update failed' });
  }
});

// ── PATCH /api/employee/requests/:id/cancel ──────────────────────────────────
router.patch('/requests/:id/cancel', async (req: Request, res: Response) => {
  const reqId = parseInt(req.params.id);
  const user_id = req.user!.id;
  const { note = 'Withdrawn by requester' } = req.body ?? {};
  if (isNaN(reqId)) return res.status(400).json({ error: 'Invalid request ID' });

  const tx = pool.transaction();
  try {
    await tx.begin();
    const cancelled = await tx.request()
      .input('id', mssql.Int, reqId)
      .input('uid', mssql.Int, user_id)
      .query(`UPDATE requests SET status='rejected',workflow_status='withdrawn',updated_at=GETDATE()
        OUTPUT inserted.id WHERE id=@id AND user_id=@uid
        AND status IN ('pending','queued','info_requested')`);
    if (!cancelled.recordset[0]) {
      await tx.rollback();
      return res.status(409).json({ error: 'Request cannot be withdrawn' });
    }
    await tx.request()
      .input('request_id', mssql.Int, reqId)
      .input('actor_id',   mssql.Int, user_id)
      .input('action',     mssql.NVarChar, 'withdrawn')
      .input('note',       mssql.NVarChar, note)
      .query(`INSERT INTO approvals (request_id, actor_id, action, note)
        VALUES (@request_id, @actor_id, @action, @note)`);
    await tx.commit();
    clearCache(`employee:${user_id}:requests`, 'admin:stats', 'admin:requests:pending');
    res.json({ success: true });
  } catch (err) {
    try { await tx.rollback(); } catch { /* transaction already closed */ }
    console.error(err);
    res.status(500).json({ error: 'Cancel failed' });
  }
});

export default router;
