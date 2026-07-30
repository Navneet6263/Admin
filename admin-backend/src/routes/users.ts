import { Router, Request, Response } from 'express';
import mssql from 'mssql';
import { pool, getCached, setCache, clearCache } from '../db';
import { hashPassword, Role } from '../auth';

const router = Router();

// ── GET /api/super-admin/users ───────────────────────────────────────────────
router.get('/', async (_req: Request, res: Response) => {
  const cached = getCached<unknown[]>('sa:users');
  if (cached) return res.json(cached);

  try {
    const result = await pool.request().query(`
      SELECT id, email, name, role, company, dept, is_active, created_at
      FROM users
      ORDER BY id DESC
    `);
    setCache('sa:users', result.recordset);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// ── POST /api/super-admin/users — Create Team Member / Role Account ──────────
router.post('/', async (req: Request, res: Response) => {
  const { email, name, role, company = 'VT', dept = '', password } = req.body;

  if (!email?.trim() || !name?.trim() || !password?.trim()) {
    return res.status(400).json({ error: 'Email, name, and password are required' });
  }

  const validRoles: Role[] = ['employee', 'admin', 'finance', 'verifier', 'super_admin'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid user role' });
  }

  try {
    const passwordHash = hashPassword(password.trim());
    const result = await pool.request()
      .input('email', mssql.NVarChar(100), email.trim().toLowerCase())
      .input('name', mssql.NVarChar(100), name.trim())
      .input('role', mssql.NVarChar(20), role)
      .input('company', mssql.NVarChar(8), company)
      .input('dept', mssql.NVarChar(80), dept.trim())
      .input('hash', mssql.NVarChar(256), passwordHash)
      .query(`
        INSERT INTO users (email, name, role, company, dept, password_hash, is_active)
        OUTPUT inserted.id, inserted.email, inserted.name, inserted.role, inserted.company, inserted.dept, inserted.is_active, inserted.created_at
        VALUES (@email, @name, @role, @company, @dept, @hash, 1)
      `);

    clearCache('sa:users');
    res.status(201).json(result.recordset[0]);
  } catch (err: unknown) {
    console.error(err);
    if (err instanceof Error && err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }
    res.status(500).json({ error: 'Failed to create user' });
  }
});

export default router;
