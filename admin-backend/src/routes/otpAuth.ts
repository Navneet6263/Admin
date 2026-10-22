import crypto from 'node:crypto';
import { Router, type Request } from 'express';
import mssql from 'mssql';
import { pool, clearCache } from '../db';
import { createSession, requireAuth, secretHash, setSessionCookie } from '../auth';
import { sendOtpMail } from '../services/mailer';

/**
 * Employee sign-in with Employee ID + emailed OTP (for SSO employees opening the portal directly),
 * and verified email update for SSO accounts that arrived without one.
 */
const router = Router();
const OTP_TTL_MINUTES = 5;
const MAX_ATTEMPTS = 5;
const RESEND_SECONDS = 45;
const EMPLOYEE_CODE = /^[A-Z0-9_./-]{2,40}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const windows = new Map<string, { count: number; resetAt: number }>();
function allow(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const current = windows.get(key);
  const entry = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
  entry.count += 1;
  windows.set(key, entry);
  if (windows.size > 5000) for (const [k, v] of windows) if (v.resetAt <= now) windows.delete(k);
  return entry.count <= max;
}
const ipOf = (req: Request) => req.ip || req.socket.remoteAddress || 'unknown';
const otpHash = (otpId: number, code: string) => secretHash(`otp:${otpId}:${code}`);
export const maskEmail = (email: string) => {
  const [user, domain] = email.split('@');
  return `${user.slice(0, 2)}${'*'.repeat(Math.max(2, user.length - 2))}@${domain}`;
};

/** Creates an OTP row, emails the code, and enforces a resend cooldown. */
async function issueOtp(userId: number, purpose: 'login' | 'email', target: string) {
  const recent = await pool.request().input('uid', mssql.Int, userId).input('purpose', mssql.VarChar(12), purpose)
    .input('cooldown', mssql.Int, RESEND_SECONDS)
    .query(`SELECT TOP 1 1 recent FROM login_otps WHERE user_id=@uid AND purpose=@purpose AND used_at IS NULL
      AND created_at>DATEADD(SECOND,-@cooldown,SYSUTCDATETIME())`);
  if (recent.recordset[0]) return { cooldown: true };
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  const tx = pool.transaction();
  await tx.begin();
  try {
    // Older unused codes for the same purpose stop working once a new one is issued.
    await new mssql.Request(tx).input('uid', mssql.Int, userId).input('purpose', mssql.VarChar(12), purpose)
      .query(`UPDATE login_otps SET used_at=SYSUTCDATETIME() WHERE user_id=@uid AND purpose=@purpose AND used_at IS NULL`);
    const inserted = await new mssql.Request(tx).input('uid', mssql.Int, userId).input('purpose', mssql.VarChar(12), purpose)
      .input('target', mssql.NVarChar(100), target).input('ttl', mssql.Int, OTP_TTL_MINUTES)
      .query(`INSERT INTO login_otps(user_id,purpose,target,code_hash,expires_at) OUTPUT inserted.id
        VALUES(@uid,@purpose,@target,REPLICATE('0',64),DATEADD(MINUTE,@ttl,SYSUTCDATETIME()))`);
    const id = inserted.recordset[0].id as number;
    await new mssql.Request(tx).input('id', mssql.Int, id).input('hash', mssql.Char(64), otpHash(id, code))
      .query('UPDATE login_otps SET code_hash=@hash WHERE id=@id');
    await tx.commit();
  } catch (error) {
    try { await tx.rollback(); } catch { /* already closed */ }
    throw error;
  }
  await sendOtpMail(target, code, purpose);
  return { cooldown: false };
}

/** Checks the latest live OTP; counts failures and burns the code after too many. */
async function verifyOtp(userId: number, purpose: 'login' | 'email', code: unknown) {
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) return { ok: false as const, reason: 'Enter the 6-digit code' };
  const tx = pool.transaction();
  await tx.begin();
  try {
    const row = (await new mssql.Request(tx).input('uid', mssql.Int, userId).input('purpose', mssql.VarChar(12), purpose)
      .query(`SELECT TOP 1 id,code_hash,attempts,target FROM login_otps WITH(UPDLOCK,ROWLOCK)
        WHERE user_id=@uid AND purpose=@purpose AND used_at IS NULL AND expires_at>SYSUTCDATETIME()
        ORDER BY created_at DESC`)).recordset[0];
    if (!row) { await tx.rollback(); return { ok: false as const, reason: 'Code expired. Please request a new one.' }; }
    const expected = Buffer.from(String(row.code_hash), 'hex');
    const actual = Buffer.from(otpHash(row.id, code), 'hex');
    const match = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
    if (!match) {
      const attempts = Number(row.attempts) + 1;
      await new mssql.Request(tx).input('id', mssql.Int, row.id).input('attempts', mssql.TinyInt, attempts)
        .input('burn', mssql.Bit, attempts >= MAX_ATTEMPTS ? 1 : 0)
        .query(`UPDATE login_otps SET attempts=@attempts,used_at=CASE WHEN @burn=1 THEN SYSUTCDATETIME() END WHERE id=@id`);
      await tx.commit();
      return { ok: false as const, reason: attempts >= MAX_ATTEMPTS ? 'Too many wrong attempts. Please request a new code.'
        : `Incorrect code. ${MAX_ATTEMPTS - attempts} attempt(s) left.` };
    }
    await new mssql.Request(tx).input('id', mssql.Int, row.id).query('UPDATE login_otps SET used_at=SYSUTCDATETIME() WHERE id=@id');
    await tx.commit();
    return { ok: true as const, target: String(row.target) };
  } catch (error) {
    try { await tx.rollback(); } catch { /* already closed */ }
    throw error;
  }
}

async function employeeByCode(code: string) {
  const result = await pool.request().input('emp', mssql.NVarChar(40), code)
    .query(`SELECT id,email,email_placeholder,is_active,role FROM users WHERE employee_code=@emp`);
  return result.recordset[0] as { id: number; email: string; email_placeholder: boolean; is_active: boolean; role: string } | undefined;
}

router.post('/otp/request', async (req, res) => {
  const code = String(req.body?.employee_code || '').trim().toUpperCase();
  if (!EMPLOYEE_CODE.test(code)) return res.status(400).json({ error: 'Enter your Employee ID' });
  if (!allow(`otp-req:${ipOf(req)}`, 20, 15 * 60_000) || !allow(`otp-req:${code}`, 5, 15 * 60_000))
    return res.status(429).json({ error: 'Too many code requests. Please try again in a few minutes.' });
  try {
    const user = await employeeByCode(code);
    if (!user || !user.is_active || user.role !== 'employee')
      return res.status(404).json({ error: 'Employee ID not found. Please open Admin Portal from Green HR once, or contact your administrator.' });
    if (user.email_placeholder)
      return res.status(409).json({ error: 'No email is registered for this Employee ID yet. Please open Admin Portal from Green HR and add your email first.' });
    const result = await issueOtp(user.id, 'login', user.email);
    res.json({ sent: true, destination: maskEmail(user.email), cooldown: result.cooldown, expires_in_minutes: OTP_TTL_MINUTES });
  } catch (error) {
    console.error(error);
    res.status(503).json({ error: 'The code could not be sent right now. Please try again shortly.' });
  }
});

router.post('/otp/verify', async (req, res) => {
  const code = String(req.body?.employee_code || '').trim().toUpperCase();
  if (!EMPLOYEE_CODE.test(code)) return res.status(400).json({ error: 'Enter your Employee ID' });
  if (!allow(`otp-verify:${ipOf(req)}`, 30, 15 * 60_000)) return res.status(429).json({ error: 'Too many attempts. Please wait a few minutes.' });
  try {
    const user = await employeeByCode(code);
    if (!user || !user.is_active || user.role !== 'employee') return res.status(401).json({ error: 'Incorrect or expired code' });
    const result = await verifyOtp(user.id, 'login', req.body?.otp);
    if (!result.ok) return res.status(401).json({ error: result.reason });
    setSessionCookie(res, await createSession(user.id));
    res.json({ success: true, role: user.role });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Sign-in failed. Please try again.' });
  }
});

/** Logged-in user asks to set/replace their email: a code goes to the new address. */
router.post('/email/request', requireAuth(), async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 100 || email.endsWith('.invalid')) return res.status(400).json({ error: 'Enter a valid email address' });
  if (!allow(`email-req:${req.user!.id}`, 5, 15 * 60_000)) return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  try {
    const taken = await pool.request().input('email', mssql.NVarChar(100), email).input('uid', mssql.Int, req.user!.id)
      .query('SELECT 1 taken FROM users WHERE email=@email AND id<>@uid');
    if (taken.recordset[0]) return res.status(409).json({ error: 'This email is already used by another account' });
    const result = await issueOtp(req.user!.id, 'email', email);
    res.json({ sent: true, destination: maskEmail(email), cooldown: result.cooldown });
  } catch (error) {
    console.error(error);
    res.status(503).json({ error: 'The code could not be sent right now. Please try again shortly.' });
  }
});

router.post('/email/verify', requireAuth(), async (req, res) => {
  try {
    const result = await verifyOtp(req.user!.id, 'email', req.body?.otp);
    if (!result.ok) return res.status(400).json({ error: result.reason });
    await pool.request().input('uid', mssql.Int, req.user!.id).input('email', mssql.NVarChar(100), result.target)
      .query('UPDATE users SET email=@email,email_placeholder=0 WHERE id=@uid');
    clearCache('sa:users');
    res.json({ success: true, email: result.target });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/UNIQUE|duplicate/i.test(message)) return res.status(409).json({ error: 'This email is already used by another account' });
    console.error(error);
    res.status(500).json({ error: 'Email could not be updated' });
  }
});

export default router;
