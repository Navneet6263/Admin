import { Router, Request, Response } from 'express';
import mssql from 'mssql';
import { pool, getCached, setCache, clearCache } from '../db';
import { effectiveRole, hashPassword, passwordError, Role } from '../auth';

const router = Router();

// ── GET /api/super-admin/users ────────────────────────────────
router.get('/', async (_req: Request, res: Response) => {
  const cached = getCached<unknown[]>('sa:users');
  if (cached) return res.json(cached);
  try {
    const result = await pool.request().query(`
      SELECT u.id, u.email, u.name, u.role, u.company, u.dept,
             u.is_active, u.created_at,
             CASE WHEN u.role IN ('employee','center_admin') THEN u.center_code END center_code,
             CASE WHEN u.role IN ('employee','center_admin') THEN c.name END center_name,
             CASE WHEN u.role IN ('employee','center_admin') THEN c.city END center_city
      FROM users u
      LEFT JOIN centers c ON c.code = u.center_code AND u.role IN ('employee','center_admin')
      WHERE u.role<>'retired'
      ORDER BY u.id DESC
    `);
    setCache('sa:users', result.recordset);
    res.json(result.recordset);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to fetch users' }); }
});

// ── POST /api/super-admin/users — Create User ─────────────────
router.post('/', async (req: Request, res: Response) => {
  const { email, name, role, company = 'VT', dept = '', password, center_code = '' } = req.body;
  if (!email?.trim() || !name?.trim() || typeof password !== 'string' || !password.trim())
    return res.status(400).json({ error: 'Email, name, and password are required' });
  if (email.length > 100 || name.length > 100 || String(company).length > 100
    || String(dept).length > 80 || String(center_code).length > 10)
    return res.status(400).json({ error: 'One or more fields exceed the allowed length' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    return res.status(400).json({ error: 'Enter a valid email address' });
  const invalidPassword = passwordError(password);
  if (invalidPassword) return res.status(400).json({ error: invalidPassword });

  const validRoles: Role[] = [
    'employee', 'hq_admin', 'center_admin', 'finance', 'finance_head', 'super_admin',
  ];
  if (!validRoles.includes(role)) return res.status(400).json({ error: 'Invalid user role' });
  const centerRole = role === 'center_admin' || role === 'employee';
  const normalizedCenter = String(center_code || '').trim().toUpperCase();
  if (!centerRole && normalizedCenter) {
    return res.status(400).json({ error: 'Center assignment is only available for Employees and Center Admins' });
  }
  const actorRole = effectiveRole(req.user!.role);
  if (actorRole === 'hq_admin' && ['hq_admin', 'super_admin'].includes(role)) {
    return res.status(403).json({ error: 'Only Super Admin can create HQ or Super Admin accounts' });
  }
  if (centerRole && !normalizedCenter) {
    return res.status(400).json({ error: 'center_code is required for Employees and Center Admins' });
  }

  try {
    const passwordHash = hashPassword(password);
    const result = await pool.request()
      .input('email',   mssql.NVarChar(100), email.trim().toLowerCase())
      .input('name',    mssql.NVarChar(100), name.trim())
      .input('role',    mssql.NVarChar(20),  role)
      .input('company', mssql.NVarChar(100), company)
      .input('dept',    mssql.NVarChar(80),  dept.trim())
      .input('cc',      mssql.NVarChar(10),  centerRole ? normalizedCenter : null)
      .input('hash',    mssql.NVarChar(256), passwordHash)
      .query(`
        IF @cc IS NOT NULL AND NOT EXISTS(SELECT 1 FROM centers WHERE code=@cc AND is_active=1)
          THROW 50003,'Selected center is not active',1;
        INSERT INTO users (email, name, role, company, dept, center_code, password_hash, is_active)
        OUTPUT inserted.id, inserted.email, inserted.name, inserted.role,
               inserted.company, inserted.dept, inserted.center_code, inserted.is_active, inserted.created_at
        VALUES (@email, @name, @role, @company, @dept, @cc, @hash, 1)
      `);
    clearCache('sa:users');
    res.status(201).json(result.recordset[0]);
  } catch (err: unknown) {
    console.error(err);
    if (err instanceof Error && err.message.includes('Selected center is not active'))
      return res.status(400).json({ error: 'Selected center is not active' });
    if (err instanceof Error && err.message.includes('UNIQUE'))
      return res.status(409).json({ error: 'User with this email already exists' });
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// ── POST /api/super-admin/users/:id/assign-center ────────────
router.post('/:id/assign-center', async (req: Request, res: Response) => {
  const { center_code } = req.body;
  const userId = +req.params.id;
  const actorId = req.user!.id;
  if (!center_code) return res.status(400).json({ error: 'center_code required' });

  const tx = pool.transaction();
  try {
    await tx.begin();
    const target = await tx.request().input('uid', mssql.Int, userId)
      .query(`SELECT role,center_code FROM users WITH(UPDLOCK,ROWLOCK) WHERE id=@uid`);
    if (!target.recordset[0]) { await tx.rollback(); return res.status(404).json({ error: 'User not found' }); }
    if (!['employee','center_admin'].includes(target.recordset[0].role)) {
      await tx.rollback();
      return res.status(400).json({ error: 'Center assignment is only available for Employees and Center Admins' });
    }
    const center = await tx.request().input('cc', mssql.NVarChar(10), center_code)
      .query(`SELECT code,name,city FROM centers WHERE code=@cc AND is_active=1`);
    if (!center.recordset[0]) {
      await tx.rollback();
      return res.status(400).json({ error: 'Selected center is not active' });
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

    await tx.request()
      .input('actor', mssql.Int, actorId)
      .input('target', mssql.Int, userId)
      .input('note', mssql.NVarChar(1000),
        `Center changed from ${target.recordset[0].center_code || 'unassigned'} to ${center_code}`)
      .query(`INSERT INTO admin_audit_events(actor_id,target_user_id,event_type,note)
        VALUES(@actor,@target,'center_assigned',@note)`);

    await tx.commit();
    clearCache('sa:users');
    res.json({ success: true, center_code, center_name: center.recordset[0].name,
      center_city: center.recordset[0].city });
  } catch (err) {
    try { await tx.rollback(); } catch { /* transaction already closed */ }
    console.error(err); res.status(500).json({ error: 'Center assignment failed' });
  }
});

// ── GET /api/super-admin/users/unassigned ────────────────────
router.get('/unassigned', async (_req: Request, res: Response) => {
  try {
    const result = await pool.request().query(`
      SELECT u.id, u.name, u.email, u.role, u.dept
      FROM users u
      WHERE u.role IN ('employee','center_admin')
        AND (u.center_code IS NULL OR u.center_code = '')
      ORDER BY u.name
    `);
    res.json(result.recordset);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Query failed' }); }
});

export default router;
