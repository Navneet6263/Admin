import { Router, Request, Response } from 'express';
import mssql from 'mssql';
import { pool, getCached, setCache, clearCache } from '../db';

const router = Router();

// ── GET /api/verifier/queue ───────────────────────────────────────────────────
router.get('/queue', async (_req: Request, res: Response) => {
  const cached = getCached<unknown[]>('verifier:queue');
  if (cached) return res.json(cached);

  try {
    const result = await pool.request().query(`
      SELECT TOP 100
        r.id, r.ref_id, r.user_id, r.company, r.team,
        r.type, r.subject, r.description, r.amount,
        r.priority, r.status, r.details,
        r.created_at, r.updated_at,
        u.name AS employeeName, u.dept AS employeeDept
      FROM requests r
      JOIN users u ON r.user_id = u.id
      WHERE r.status = 'awaiting_verification'
      ORDER BY r.created_at ASC
    `);
    setCache('verifier:queue', result.recordset);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Query failed' });
  }
});

// ── POST /api/verifier/requests/:id/verify ───────────────────────────────────
router.post('/requests/:id/verify', async (req: Request, res: Response) => {
  const { note = '', verifier_id = 9 } = req.body;
  const tx = pool.transaction();
  try {
    await tx.begin();

    await tx.request()
      .input('id', mssql.Int, +req.params.id)
      .query(`UPDATE requests SET status = 'approved', updated_at = GETDATE() WHERE id = @id`);

    const userRes = await tx.request()
      .input('id', mssql.Int, +req.params.id)
      .query(`SELECT user_id, ref_id FROM requests WHERE id = @id`);
    const { user_id: userId, ref_id: refId } = userRes.recordset[0] ?? {};

    await tx.request()
      .input('request_id', mssql.Int, +req.params.id)
      .input('actor_id',   mssql.Int, verifier_id)
      .input('note',       mssql.NVarChar, note || null)
      .query(`INSERT INTO approvals (request_id,actor_id,action,note) VALUES (@request_id,@actor_id,'verified',@note)`);

    if (userId) {
      await tx.request()
        .input('user_id', mssql.Int, userId)
        .input('message', mssql.NVarChar, `Your request ${refId} has been verified and closed.`)
        .query(`INSERT INTO notifications (user_id,message) VALUES (@user_id,@message)`);
    }

    await tx.commit();
    clearCache('verifier:queue', 'admin:stats', `employee:${userId}:requests`);
    res.json({ success: true });
  } catch (err) {
    await tx.rollback();
    console.error(err);
    res.status(500).json({ error: 'Verify failed' });
  }
});

// ── POST /api/verifier/requests/:id/send-back ────────────────────────────────
router.post('/requests/:id/send-back', async (req: Request, res: Response) => {
  const { note = '', verifier_id = 9 } = req.body;
  const tx = pool.transaction();
  try {
    await tx.begin();

    await tx.request()
      .input('id', mssql.Int, +req.params.id)
      .query(`UPDATE requests SET status = 'pending', updated_at = GETDATE() WHERE id = @id`);

    await tx.request()
      .input('request_id', mssql.Int, +req.params.id)
      .input('actor_id',   mssql.Int, verifier_id)
      .input('note',       mssql.NVarChar, note || null)
      .query(`INSERT INTO approvals (request_id,actor_id,action,note) VALUES (@request_id,@actor_id,'sent_back',@note)`);

    await tx.commit();
    clearCache('verifier:queue', 'admin:requests:pending', 'admin:stats');
    res.json({ success: true });
  } catch (err) {
    await tx.rollback();
    console.error(err);
    res.status(500).json({ error: 'Send-back failed' });
  }
});

export default router;
