import { Router, Request, Response } from 'express';
import mssql from 'mssql';
import { pool, getCached, setCache, clearCache } from '../db';
import { effectiveRole, hashPassword, Role } from '../auth';

const router = Router();

// ── GET /api/super-admin/users ────────────────────────────────
router.get('/', async (_req: Request, res: Response) => {
  const cached = getCached<unknown[]>('sa:users');
  if (cached) return res.json(cached);
  try {
    const result = await pool.request().query(`
      SELECT u.id, u.email, u.name, u.role, u.company, u.dept,
             u.is_active, u.created_at, u.center_code,
             c.name AS center_name, c.city AS center_city
      FROM users u
      LEFT JOIN centers c ON c.code = u.center_code
      ORDER BY u.id DESC
    `);
    setCache('sa:users', result.recordset);
    res.json(result.recordset);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to fetch users' }); }
});

// ── POST /api/super-admin/users — Create User ─────────────────
router.post('/', async (req: Request, res: Response) => {
  const { email, name, role, company = 'VT', dept = '', password, center_code = '' } = req.body;
  if (!email?.trim() || !name?.trim() || !password?.trim())
    return res.status(400).json({ error: 'Email, name, and password are required' });

  const validRoles: Role[] = [
    'employee', 'admin', 'hq_admin', 'center_admin', 'finance', 'finance_head', 'verifier', 'super_admin',
  ];
  if (!validRoles.includes(role)) return res.status(400).json({ error: 'Invalid user role' });
  const actorRole = effectiveRole(req.user!.role);
  if (actorRole === 'hq_admin' && ['admin', 'hq_admin', 'super_admin'].includes(role)) {
    return res.status(403).json({ error: 'Only Super Admin can create HQ or Super Admin accounts' });
  }
  if ((role === 'center_admin' || role === 'employee') && !String(center_code || '').trim()) {
    return res.status(400).json({ error: 'center_code is required for this admin role' });
  }

  try {
    const passwordHash = hashPassword(password.trim());
    const result = await pool.request()
      .input('email',   mssql.NVarChar(100), email.trim().toLowerCase())
      .input('name',    mssql.NVarChar(100), name.trim())
      .input('role',    mssql.NVarChar(20),  role)
      .input('company', mssql.NVarChar(100), company)
      .input('dept',    mssql.NVarChar(80),  dept.trim())
      .input('cc',      mssql.NVarChar(10),  center_code || null)
      .input('hash',    mssql.NVarChar(256), passwordHash)
      .query(`
        INSERT INTO users (email, name, role, company, dept, center_code, password_hash, is_active)
        OUTPUT inserted.id, inserted.email, inserted.name, inserted.role,
               inserted.company, inserted.dept, inserted.center_code, inserted.is_active, inserted.created_at
        VALUES (@email, @name, @role, @company, @dept, @cc, @hash, 1)
      `);
    clearCache('sa:users');
    res.status(201).json(result.recordset[0]);
  } catch (err: unknown) {
    console.error(err);
    if (err instanceof Error && err.message.includes('UNIQUE'))
      return res.status(409).json({ error: 'User with this email already exists' });
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// ── POST /api/super-admin/users/:id/assign-center ────────────
router.post('/:id/assign-center', async (req: Request, res: Response) => {
  const { center_code } = req.body;
  const userId = +req.params.id;
  const actorId = (req.user as any)?.id ?? 1;
  if (!center_code) return res.status(400).json({ error: 'center_code required' });

  const tx = pool.transaction();
  try {
    await tx.begin();
    const target = await tx.request().input('uid', mssql.Int, userId)
      .query(`SELECT role FROM users WHERE id=@uid`);
    if (!target.recordset[0]) { await tx.rollback(); return res.status(404).json({ error: 'User not found' }); }
    if (['hq_admin','admin','super_admin'].includes(target.recordset[0].role)) {
      await tx.rollback();
      return res.status(400).json({ error: 'HQ and Super Admin use global center access' });
    }

    // Update denormalized column on users
    await tx.request()
      .input('cc',  mssql.NVarChar(10), center_code)
      .input('uid', mssql.Int, userId)
      .query(`UPDATE users SET center_code = @cc WHERE id = @uid`);

    // Upsert user_centers
    await tx.request()
      .input('uid',    mssql.Int, userId)
      .input('cc',     mssql.NVarChar(10), center_code)
      .input('actor',  mssql.Int, actorId)
      .query(`
        IF EXISTS (SELECT 1 FROM user_centers WHERE user_id = @uid)
          UPDATE user_centers SET home_center_code=@cc, assigned_by=@actor, assigned_at=GETDATE() WHERE user_id=@uid
        ELSE
          INSERT INTO user_centers (user_id, home_center_code, assigned_by) VALUES (@uid, @cc, @actor)
      `);

    await tx.commit();
    clearCache('sa:users');
    res.json({ success: true, center_code });
  } catch (err) { await tx.rollback(); console.error(err); res.status(500).json({ error: 'Center assignment failed' }); }
});

// ── GET /api/super-admin/users/unassigned ────────────────────
router.get('/unassigned', async (_req: Request, res: Response) => {
  try {
    const result = await pool.request().query(`
      SELECT u.id, u.name, u.email, u.role, u.dept
      FROM users u
      WHERE u.center_code IS NULL OR u.center_code = ''
      ORDER BY u.name
    `);
    res.json(result.recordset);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Query failed' }); }
});

export default router;
