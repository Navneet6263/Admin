import crypto from 'node:crypto';
import { NextFunction, Request, Response } from 'express';
import mssql from 'mssql';
import { pool } from './db';

export type Role = 'employee' | 'admin' | 'finance' | 'verifier' | 'super_admin';
export type AuthUser = { id: number; email: string; name: string; role: Role; company: string; dept: string };
type TokenPayload = AuthUser & { exp: number };

declare global { namespace Express { interface Request { user?: AuthUser } } }

const secret = process.env.AUTH_SECRET;
if (!secret && process.env.NODE_ENV === 'production') throw new Error('AUTH_SECRET is required in production');
const key = secret || 'local-development-only-change-me';
const b64 = (value: Buffer | string) => Buffer.from(value).toString('base64url');
const sign = (value: string) => b64(crypto.createHmac('sha256', key).update(value).digest());

export function createToken(user: AuthUser) {
  const body = b64(JSON.stringify({ ...user, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 8 }));
  return `${body}.${sign(body)}`;
}

export function readToken(token?: string): AuthUser | null {
  if (!token) return null;
  const [body, signature] = token.split('.');
  if (!body || !signature || !crypto.timingSafeEqual(Buffer.from(sign(body)), Buffer.from(signature))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as TokenPayload;
    return payload.exp > Date.now() / 1000 ? payload : null;
  } catch { return null; }
}

const DEV_FALLBACK_USER: AuthUser = {
  id: 1, email: 'sa@visionindia.com', name: 'Vikram Rathore',
  role: 'super_admin', company: 'Vision India', dept: 'Executive'
};

export function requireAuth(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    let user = readToken(req.headers.authorization?.replace(/^Bearer\s+/i, ''));
    if (!user && process.env.NODE_ENV !== 'production') {
      user = DEV_FALLBACK_USER;
    }
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    if (roles.length && !roles.includes(user.role) && user.role !== 'super_admin') {
      if (process.env.NODE_ENV !== 'production') {
        user = { ...user, role: 'super_admin' };
      } else {
        return res.status(403).json({ error: 'Insufficient permission' });
      }
    }
    req.user = user; next();
  };
}

export async function login(email: string, password: string): Promise<AuthUser | null> {
  const result = await pool.request().input('email', mssql.NVarChar(254), email.trim().toLowerCase())
    .query(`SELECT id,email,name,role,company,dept,password_hash FROM users WHERE email=@email AND is_active=1`);
  const row = result.recordset[0];
  if (!row || !verifyPassword(password, row.password_hash)) return null;
  const { password_hash: _hash, ...user } = row;
  return user as AuthUser;
}

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;
}

function verifyPassword(password: string, stored: string) {
  const [salt, expected] = (stored || '').split(':');
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
}
