import { Router, type Request, type Response, type NextFunction } from 'express';
import mssql from 'mssql';
import { pool } from '../db';
import { createSession, setSessionCookie } from '../auth';
import { clientForKey, consumeTicket, issueLoginLink, logSsoEvent, readProfile, SsoError } from '../services/sso';

/**
 * SSO entry points.
 *  - POST /v1/login-link : server-to-server from the HRMS (X-API-Key). Returns a one-time login URL.
 *  - POST /exchange      : called by our /sso page with that ticket; starts the browser session.
 */
const router = Router();

const windows = new Map<string, { count: number; resetAt: number }>();
function limit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const current = windows.get(key);
  const entry = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
  entry.count += 1;
  windows.set(key, entry);
  if (windows.size > 5000) for (const [k, v] of windows) if (v.resetAt <= now) windows.delete(k);
  return entry.count <= max;
}
const ipOf = (req: Request) => req.ip || req.socket.remoteAddress || null;

async function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const ip = ipOf(req);
  if (!limit(`ip:${ip}`, 300, 60_000)) return res.status(429).json({ error: 'RATE_LIMITED', message: 'Too many requests' });
  const raw = req.get('X-API-Key') || req.get('Authorization')?.replace(/^Bearer\s+/i, '');
  try {
    const client = await clientForKey(raw);
    if (!client) {
      await logSsoEvent('invalid_key', { ip, note: raw ? `prefix ${String(raw).slice(0, 14)}` : 'missing key' });
      return res.status(401).json({ error: 'INVALID_API_KEY', message: 'Missing, invalid or disabled API key' });
    }
    if (!limit(`client:${client.id}`, 600, 60_000)) return res.status(429).json({ error: 'RATE_LIMITED', message: 'Too many requests' });
    res.locals.ssoClient = client;
    next();
  } catch (error) {
    console.error(error);
    res.status(503).json({ error: 'UNAVAILABLE', message: 'SSO service unavailable' });
  }
}

router.post('/v1/login-link', apiKeyAuth, async (req, res) => {
  const client = res.locals.ssoClient as { id: number };
  try {
    const profile = readProfile(req.body ?? {});
    res.json(await issueLoginLink(client.id, profile, ipOf(req)));
  } catch (error) {
    if (error instanceof SsoError) {
      await logSsoEvent('rejected', { clientId: client.id, employeeCode: String(req.body?.employee_code ?? ''), note: error.code, ip: ipOf(req) });
      return res.status(error.status).json({ error: error.code, message: error.message });
    }
    console.error(error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Login link could not be created' });
  }
});

router.post('/exchange', async (req, res) => {
  const ip = ipOf(req);
  if (!limit(`exchange:${ip}`, 30, 60_000)) return res.status(429).json({ error: 'RATE_LIMITED', message: 'Too many attempts. Please wait a minute.' });
  try {
    const ticket = await consumeTicket(req.body?.ticket);
    if (!ticket) {
      await logSsoEvent('ticket_rejected', { ip, note: 'expired, used or unknown' });
      return res.status(410).json({ error: 'LINK_EXPIRED', message: 'This login link has expired or was already used. Please open Admin Portal from Green HR again.' });
    }
    const user = (await pool.request().input('id', mssql.Int, ticket.user_id)
      .query(`SELECT id,role,is_active FROM users WHERE id=@id`)).recordset[0];
    if (ticket.outcome === 'admin_account' || (user && user.role !== 'employee')) {
      await logSsoEvent('blocked_admin', { clientId: ticket.client_id, userId: ticket.user_id, ip });
      return res.status(409).json({ error: 'ADMIN_ACCOUNT',
        message: 'You already have an administrator account. Please sign in with your admin login (email and password) on the admin portal.' });
    }
    if (ticket.outcome === 'inactive' || !user?.is_active) {
      await logSsoEvent('blocked_inactive', { clientId: ticket.client_id, userId: ticket.user_id, ip });
      return res.status(403).json({ error: 'ACCOUNT_DISABLED', message: 'Your account has been disabled. Please contact your administrator.' });
    }
    setSessionCookie(res, await createSession(user.id));
    await logSsoEvent('login', { clientId: ticket.client_id, userId: user.id, ip });
    res.json({ success: true, role: user.role });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Sign-in failed. Please try again.' });
  }
});

export default router;
