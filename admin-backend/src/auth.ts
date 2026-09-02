import crypto from 'node:crypto';
import { CookieOptions, NextFunction, Request, Response } from 'express';
import mssql from 'mssql';
import { pool } from './db';

export type Role =
  | 'employee'
  | 'hq_admin'
  | 'center_admin'
  | 'finance'
  | 'finance_head'
  | 'super_admin';

export type AuthUser = {
  id: number;
  email: string;
  name: string;
  role: Role;
  company: string;
  dept: string;
  employee_code?: string | null;
  center_code?: string | null;
};

declare global { namespace Express { interface Request { user?: AuthUser } } }

const secret = process.env.AUTH_SECRET;
if (process.env.NODE_ENV === 'production'
  && (!secret || secret.length < 32 || secret === 'replace-with-a-long-random-value')) {
  throw new Error('AUTH_SECRET must contain at least 32 characters in production');
}
const key = secret || 'local-development-only-change-me';
const sessionCookie = process.env.NODE_ENV === 'production'
  ? '__Host-requesthub_session'
  : 'requesthub_session';
const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/',
  maxAge: 8 * 60 * 60 * 1000,
};

/** Kept as a single permission-normalization hook for route services. */
export function effectiveRole(role: Role): Role {
  return role;
}

function cookieToken(req: Request) {
  const raw = req.headers.cookie?.split(';').map((part) => part.trim())
    .find((part) => part.startsWith(`${sessionCookie}=`))?.slice(sessionCookie.length + 1);
  if (!raw) return undefined;
  try { return decodeURIComponent(raw); } catch { return undefined; }
}

function sessionToken(req: Request) {
  return cookieToken(req) || req.headers.authorization?.replace(/^Bearer\s+/i, '');
}

const sessionHash = (token: string) =>
  crypto.createHmac('sha256', key).update(token).digest('hex');

export async function createSession(userId: number) {
  const token = crypto.randomBytes(32).toString('base64url');
  await pool.request()
    .input('hash', mssql.Char(64), sessionHash(token))
    .input('uid', mssql.Int, userId)
    .query(`INSERT INTO auth_sessions(token_hash,user_id,expires_at)
      VALUES(@hash,@uid,DATEADD(HOUR,8,SYSUTCDATETIME()));
      DELETE FROM auth_sessions WHERE expires_at<SYSUTCDATETIME()
        OR (revoked_at IS NOT NULL AND revoked_at<DATEADD(DAY,-1,SYSUTCDATETIME()))`);
  return token;
}

export async function revokeSession(req: Request) {
  const token = sessionToken(req);
  if (!token) return;
  await pool.request().input('hash', mssql.Char(64), sessionHash(token))
    .query(`UPDATE auth_sessions SET revoked_at=SYSUTCDATETIME()
      WHERE token_hash=@hash AND revoked_at IS NULL`);
}

async function readSession(token?: string): Promise<AuthUser | null> {
  if (!token || !/^[A-Za-z0-9_-]{40,100}$/.test(token)) return null;
  const result = await pool.request().input('hash', mssql.Char(64), sessionHash(token))
    .query(`SELECT u.id,u.email,u.name,u.role,u.company,u.dept,u.employee_code,
        CASE WHEN u.role IN ('employee','center_admin') THEN u.center_code END center_code
      FROM auth_sessions s JOIN users u ON u.id=s.user_id
      WHERE s.token_hash=@hash AND s.revoked_at IS NULL
        AND s.expires_at>SYSUTCDATETIME() AND u.is_active=1`);
  return (result.recordset[0] as AuthUser | undefined) || null;
}

export function setSessionCookie(res: Response, token: string) {
  res.cookie(sessionCookie, token, cookieOptions);
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(sessionCookie, { ...cookieOptions, maxAge: undefined });
}

function roleAllowed(userRole: Role, allowed: Role[]): boolean {
  if (userRole === 'super_admin') return true;
  return allowed.includes(userRole);
}

export function requireAuth(...roles: Role[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await readSession(sessionToken(req));
      if (!user) return res.status(401).json({ error: 'Authentication required' });
      if (roles.length && !roleAllowed(user.role, roles)) {
        return res.status(403).json({ error: 'Insufficient permission' });
      }
      req.user = user;
      next();
    } catch (error) {
      console.error('Session verification failed:', error);
      return res.status(503).json({ error: 'Authentication service unavailable' });
    }
  };
}

export function requireAssignedCenter(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role === 'center_admin' && !req.user.center_code) {
    return res.status(403).json({ error: 'A center assignment is required for this account' });
  }
  next();
}

export async function login(email: string, password: string): Promise<AuthUser | null> {
  const result = await pool.request().input('email', mssql.NVarChar(254), email.trim().toLowerCase())
    .query(`SELECT id,email,name,role,company,dept,employee_code,
      CASE WHEN role IN ('employee','center_admin') THEN center_code END center_code,password_hash
      FROM users WHERE email=@email AND is_active=1`);
  const row = result.recordset[0];
  const stored = row?.password_hash || dummyPasswordHash;
  if (!verifyPassword(password, stored) || !row) return null;
  const { password_hash: _hash, ...user } = row;
  return user as AuthUser;
}

export function passwordError(password: unknown): string | null {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128)
    return 'Password must be between 12 and 128 characters';
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)
    || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password))
    return 'Password must include uppercase, lowercase, number and special character';
  return null;
}

export async function ensureBootstrapSuperAdmin() {
  const result = await pool.request().query(
    `SELECT COUNT(*) AS total FROM users WHERE role='super_admin' AND is_active=1`,
  );
  if (Number(result.recordset[0]?.total) > 0) return;

  const email = process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_SUPER_ADMIN_PASSWORD;
  const name = process.env.BOOTSTRAP_SUPER_ADMIN_NAME?.trim() || 'Request Hub Super Admin';
  if (!email || !password) {
    throw new Error('No active Super Admin exists. Configure BOOTSTRAP_SUPER_ADMIN_EMAIL and BOOTSTRAP_SUPER_ADMIN_PASSWORD.');
  }
  const invalidPassword = passwordError(password);
  if (invalidPassword) throw new Error(`BOOTSTRAP_SUPER_ADMIN_PASSWORD: ${invalidPassword}`);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 100 || name.length > 100) {
    throw new Error('Bootstrap Super Admin name or email is invalid');
  }
  await pool.request()
    .input('email', mssql.NVarChar(100), email)
    .input('name', mssql.NVarChar(100), name)
    .input('hash', mssql.NVarChar(256), hashPassword(password))
    .query(`INSERT INTO users(email,name,role,company,dept,password_hash,is_active)
      VALUES(@email,@name,'super_admin','VT','Executive',@hash,1)`);
  console.log(`Bootstrap Super Admin created: ${email}`);
}

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;
}

const dummyPasswordHash = hashPassword(crypto.randomBytes(24).toString('base64url'));

function verifyPassword(password: string, stored: string) {
  const [salt, expected] = (stored || '').split(':');
  if (!/^[a-f0-9]{32}$/i.test(salt || '') || !/^[a-f0-9]{128}$/i.test(expected || '')) return false;
  const actual = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
}
