import { Router } from 'express';
import mssql from 'mssql';
import { pool, clearCache } from '../db';
import { createToken, login, requireAuth, hashPassword } from '../auth';

const router = Router();

// ── POST /api/auth/login ─────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string')
    return res.status(400).json({ error: 'Email and password are required' });
  try {
    const user = await login(email, password);
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });
    res.json({ token: createToken(user), user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Login unavailable' });
  }
});

// ── POST /api/auth/register — Public Employee Self-Registration ──
router.post('/register', async (req, res) => {
  const { email, name, password, company = 'Vision India', dept = 'Operations', center_code = '' } = req.body ?? {};

  if (!email?.trim() || !name?.trim() || !password?.trim()) {
    return res.status(400).json({ error: 'Name, email and password are required' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanName = name.trim();
  const centerCode = center_code?.trim()?.toUpperCase() || null;

  try {
    // Check if email already registered
    const existing = await pool.request()
      .input('email', mssql.NVarChar(100), cleanEmail)
      .query(`SELECT id FROM users WHERE email = @email`);

    if (existing.recordset.length > 0) {
      return res.status(409).json({ error: 'This email is already registered. Please sign in instead.' });
    }

    const passwordHash = hashPassword(password.trim());

    // Insert user into SQL Server
    const result = await pool.request()
      .input('email',       mssql.NVarChar(100), cleanEmail)
      .input('name',        mssql.NVarChar(100), cleanName)
      .input('role',        mssql.NVarChar(20),  'employee')
      .input('company',     mssql.NVarChar(100), company)
      .input('dept',        mssql.NVarChar(100), dept)
      .input('hash',        mssql.NVarChar(200), passwordHash)
      .input('center_code', mssql.NVarChar(10),  centerCode)
      .query(`
        INSERT INTO users (email, name, role, company, dept, password_hash, center_code, is_active)
        OUTPUT inserted.id, inserted.email, inserted.name, inserted.role, inserted.company, inserted.dept
        VALUES (@email, @name, @role, @company, @dept, @hash, @center_code, 1)
      `);

    const user = result.recordset[0];

    // If center code provided, link in user_centers table
    if (centerCode) {
      await pool.request()
        .input('user_id', mssql.Int, user.id)
        .input('code',    mssql.NVarChar(10), centerCode)
        .query(`
          IF EXISTS (SELECT 1 FROM centers WHERE code = @code)
            INSERT INTO user_centers (user_id, home_center_code) VALUES (@user_id, @code);
        `);
    }

    clearCache('sa:users');
    const token = createToken(user);
    res.status(201).json({ token, user, message: 'Account created successfully!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.get('/me', requireAuth(), (req, res) => res.json(req.user));

export default router;
