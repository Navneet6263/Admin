import crypto from 'node:crypto';
import mssql from 'mssql';
import { pool, clearCache } from '../db';
import { hashPassword, secretHash } from '../auth';

/** API keys look like amsso_<8 hex prefix>_<43 char secret>; only a keyed hash is stored. */
const KEY_PATTERN = /^amsso_([a-f0-9]{8})_([A-Za-z0-9_-]{43})$/;
export const TICKET_TTL_SECONDS = 60;
const EMPLOYEE_CODE = /^[A-Z0-9_./-]{2,40}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class SsoError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export function newApiKey() {
  const prefix = crypto.randomBytes(4).toString('hex');
  const secret = crypto.randomBytes(32).toString('base64url');
  return { prefix, key: `amsso_${prefix}_${secret}`, hash: secretHash(`${prefix}.${secret}`) };
}

export function publicAppUrl() {
  const configured = process.env.APP_PUBLIC_URL?.trim() || (process.env.CORS_ORIGIN || '').split(',')[0]?.trim();
  return (configured || 'http://localhost:3000').replace(/\/+$/, '');
}

export async function logSsoEvent(event: string, detail: { clientId?: number | null; userId?: number | null;
  employeeCode?: string | null; note?: string | null; ip?: string | null }) {
  try {
    await pool.request().input('client', mssql.Int, detail.clientId ?? null).input('user', mssql.Int, detail.userId ?? null)
      .input('emp', mssql.NVarChar(40), detail.employeeCode?.slice(0, 40) ?? null).input('event', mssql.VarChar(30), event)
      .input('note', mssql.NVarChar(300), detail.note?.slice(0, 300) ?? null).input('ip', mssql.NVarChar(64), detail.ip?.slice(0, 64) ?? null)
      .query(`INSERT INTO sso_events(client_id,user_id,employee_code,event,detail,ip) VALUES(@client,@user,@emp,@event,@note,@ip)`);
  } catch (error) { console.error('SSO audit write failed:', error); }
}

/** Resolves an API key to an active client (constant-time hash comparison). */
export async function clientForKey(rawKey: unknown) {
  const match = typeof rawKey === 'string' ? KEY_PATTERN.exec(rawKey.trim()) : null;
  if (!match) return null;
  const [, prefix, secret] = match;
  const result = await pool.request().input('prefix', mssql.Char(8), prefix)
    .query(`SELECT id,name,key_hash,is_active FROM sso_clients WHERE key_prefix=@prefix`);
  const client = result.recordset[0];
  if (!client) return null;
  const expected = Buffer.from(String(client.key_hash), 'hex');
  const actual = Buffer.from(secretHash(`${prefix}.${secret}`), 'hex');
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual) || !client.is_active) return null;
  void pool.request().input('id', mssql.Int, client.id).query('UPDATE sso_clients SET last_used_at=SYSUTCDATETIME() WHERE id=@id')
    .catch(() => undefined);
  return { id: Number(client.id), name: String(client.name) };
}

export type SsoProfile = {
  employeeCode: string; name: string; company: string; department: string | null;
  designation: string | null; mobile: string | null; email: string | null;
  /** Optional center/branch from the HRMS (our center code or center name). */
  center: string | null;
};

/** Validates the HRMS payload. Only employee ID, name and company are mandatory. */
export function readProfile(body: Record<string, unknown>): SsoProfile {
  const text = (value: unknown, max: number) => {
    const result = String(value ?? '').trim().replace(/\s+/g, ' ');
    if (result.length > max) throw new SsoError(422, 'FIELD_TOO_LONG', `A field exceeds ${max} characters`);
    return result || null;
  };
  const employeeCode = String(body.employee_code ?? '').trim().toUpperCase();
  if (!EMPLOYEE_CODE.test(employeeCode))
    throw new SsoError(422, 'INVALID_EMPLOYEE_CODE', 'employee_code is required (2-40 letters, numbers, - _ . /)');
  const name = text(body.name, 100);
  if (!name) throw new SsoError(422, 'NAME_REQUIRED', 'name is required');
  const company = text(body.company, 100);
  if (!company) throw new SsoError(422, 'COMPANY_REQUIRED', 'company is required');
  const email = text(body.email, 100)?.toLowerCase() ?? null;
  if (email && !EMAIL.test(email)) throw new SsoError(422, 'INVALID_EMAIL', 'email is not valid');
  const mobile = text(body.mobile, 20)?.replace(/[^\d+]/g, '') || null;
  if (mobile && !/^\+?\d{7,15}$/.test(mobile)) throw new SsoError(422, 'INVALID_MOBILE', 'mobile is not valid');
  return { employeeCode, name, company, department: text(body.department, 80), designation: text(body.designation, 100), mobile, email,
    center: text(body.center_code ?? body.center, 100) };
}

/**
 * Picks the employee's home center from what already exists:
 * HR-sent center (code or name) → mapping default → the company's only active center.
 */
async function resolveCenter(tx: mssql.Transaction, company: string, defaultCenter: string | null, hint: string | null) {
  const result = await new mssql.Request(tx).input('company', mssql.NVarChar(100), company)
    .input('hint', mssql.NVarChar(100), hint).input('fallback', mssql.NVarChar(10), defaultCenter)
    .query(`DECLARE @hit NVARCHAR(10)=NULL,@matched BIT=0;
      IF @hint IS NOT NULL SELECT TOP 1 @hit=code FROM centers
        WHERE is_active=1 AND (LOWER(code)=LOWER(@hint) OR LOWER(name)=LOWER(@hint))
        ORDER BY CASE WHEN company=@company THEN 0 ELSE 1 END,CASE WHEN LOWER(code)=LOWER(@hint) THEN 0 ELSE 1 END;
      IF @hit IS NOT NULL SET @matched=1;
      IF @hit IS NULL SET @hit=@fallback;
      IF @hit IS NULL AND (SELECT COUNT(*) FROM centers WHERE company=@company AND is_active=1)=1
        SELECT @hit=code FROM centers WHERE company=@company AND is_active=1;
      SELECT @hit code,@matched matched`);
  const row = result.recordset[0];
  return { code: (row?.code as string | null) ?? null, matched: Boolean(row?.matched) };
}

const placeholderEmail = (code: string) => `sso.${code.toLowerCase().replace(/[^a-z0-9]/g, '-')}@placeholder.invalid`;

/**
 * Creates or refreshes the employee from the HRMS profile and issues a one-time login ticket.
 * Accounts that are not plain employees (HQ, Super Admin, center roles) are never signed in through SSO.
 */
export async function issueLoginLink(clientId: number, profile: SsoProfile, ip: string | null) {
  const tx = pool.transaction();
  await tx.begin();
  let userId = 0; let outcome: 'login' | 'admin_account' | 'inactive' = 'login'; let created = false; let note: string | null = null;
  const ticket = crypto.randomBytes(32).toString('base64url');
  try {
    const q = () => new mssql.Request(tx);
    const mapping = (await q().input('client', mssql.Int, clientId).input('company', mssql.NVarChar(100), profile.company)
      .query(`SELECT m.company,ce.code default_center FROM sso_company_map m JOIN companies c ON c.name=m.company
        LEFT JOIN centers ce ON ce.code=m.center_code AND ce.is_active=1
        WHERE m.client_id=@client AND (LOWER(c.name)=LOWER(@company) OR LOWER(c.code)=LOWER(@company))`)).recordset[0];
    if (!mapping) throw new SsoError(422, 'COMPANY_NOT_MAPPED', `Company "${profile.company}" is not enabled for SSO`);
    const centerFor = async () => {
      const center = await resolveCenter(tx, mapping.company, mapping.default_center ?? null, profile.center);
      if (!center.code) throw new SsoError(422, 'CENTER_NOT_FOUND', profile.center
        ? `Center "${profile.center}" was not found and "${mapping.company}" has no single default center`
        : `"${mapping.company}" has more than one center: send center_code, or set a default center in SSO settings`);
      if (profile.center && !center.matched) note = `center "${profile.center}" not found; used ${center.code}`;
      return center.code;
    };
    const byCode = (await q().input('emp', mssql.NVarChar(40), profile.employeeCode)
      .query(`SELECT id,role,is_active,email,email_placeholder FROM users WITH(UPDLOCK,HOLDLOCK) WHERE employee_code=@emp`)).recordset[0];
    const byEmail = profile.email ? (await q().input('email', mssql.NVarChar(100), profile.email)
      .query(`SELECT id,role,is_active,employee_code FROM users WITH(UPDLOCK,HOLDLOCK) WHERE email=@email`)).recordset[0] : undefined;

    const admin = [byCode, byEmail].find((user) => user && user.role !== 'employee');
    if (admin) { userId = admin.id; outcome = 'admin_account'; }
    else {
      let target = byCode;
      if (!target && byEmail) {
        if (byEmail.employee_code && byEmail.employee_code !== profile.employeeCode)
          throw new SsoError(409, 'EMAIL_IN_USE', 'This email already belongs to another employee ID');
        target = byEmail;
      }
      // Only take the HR email when no other account owns it.
      const emailFree = profile.email && (!byEmail || byEmail.id === target?.id);
      if (profile.email && !emailFree) note = 'HR email already used by another account; kept existing email';
      if (target) {
        userId = target.id;
        // Existing employees keep the center an admin gave them.
        const current = (await q().input('id', mssql.Int, target.id).query('SELECT center_code FROM users WHERE id=@id')).recordset[0];
        const centerCode = current?.center_code ?? await centerFor();
        if (!target.is_active) outcome = 'inactive';
        await q().input('id', mssql.Int, target.id).input('emp', mssql.NVarChar(40), profile.employeeCode)
          .input('name', mssql.NVarChar(100), profile.name).input('company', mssql.NVarChar(100), mapping.company)
          .input('dept', mssql.NVarChar(80), profile.department).input('desig', mssql.NVarChar(100), profile.designation)
          .input('mobile', mssql.NVarChar(20), profile.mobile).input('email', mssql.NVarChar(100), emailFree ? profile.email : null)
          .input('cc', mssql.NVarChar(10), centerCode).input('client', mssql.Int, clientId)
          .query(`UPDATE users SET employee_code=@emp,name=@name,company=@company,dept=COALESCE(@dept,dept),
              designation=COALESCE(@desig,designation),mobile=COALESCE(@mobile,mobile),
              email=COALESCE(@email,email),email_placeholder=CASE WHEN @email IS NOT NULL THEN 0 ELSE email_placeholder END,
              center_code=COALESCE(center_code,@cc),sso_client_id=@client,last_sso_at=SYSUTCDATETIME()
            WHERE id=@id`);
      } else {
        const centerCode = await centerFor();
        const inserted = await q().input('emp', mssql.NVarChar(40), profile.employeeCode)
          .input('name', mssql.NVarChar(100), profile.name).input('company', mssql.NVarChar(100), mapping.company)
          .input('dept', mssql.NVarChar(80), profile.department || 'General').input('desig', mssql.NVarChar(100), profile.designation)
          .input('mobile', mssql.NVarChar(20), profile.mobile)
          .input('email', mssql.NVarChar(100), profile.email || placeholderEmail(profile.employeeCode))
          .input('placeholder', mssql.Bit, profile.email ? 0 : 1).input('cc', mssql.NVarChar(10), centerCode)
          .input('hash', mssql.NVarChar(256), hashPassword(crypto.randomBytes(24).toString('base64url')))
          .input('client', mssql.Int, clientId)
          .query(`INSERT INTO users(email,name,role,company,dept,employee_code,center_code,password_hash,is_active,
              auth_source,email_placeholder,mobile,designation,sso_client_id,last_sso_at)
            OUTPUT inserted.id
            VALUES(@email,@name,'employee',@company,@dept,@emp,@cc,@hash,1,'sso',@placeholder,@mobile,@desig,@client,SYSUTCDATETIME())`);
        userId = inserted.recordset[0].id; created = true;
      }
      await q().input('uid', mssql.Int, userId)
        .query(`INSERT INTO user_centers(user_id,home_center_code)
          SELECT id,center_code FROM users WHERE id=@uid AND center_code IS NOT NULL
            AND NOT EXISTS(SELECT 1 FROM user_centers WHERE user_id=@uid)`);
    }
    await q().input('hash', mssql.Char(64), secretHash(ticket)).input('client', mssql.Int, clientId)
      .input('user', mssql.Int, userId).input('outcome', mssql.VarChar(20), outcome)
      .input('ttl', mssql.Int, TICKET_TTL_SECONDS)
      .query(`INSERT INTO sso_tickets(ticket_hash,client_id,user_id,outcome,expires_at)
        VALUES(@hash,@client,@user,@outcome,DATEADD(SECOND,@ttl,SYSUTCDATETIME()));
        DELETE FROM sso_tickets WHERE expires_at<DATEADD(DAY,-1,SYSUTCDATETIME())`);
    await tx.commit();
  } catch (error) {
    try { await tx.rollback(); } catch { /* already closed */ }
    throw error;
  }
  clearCache('sa:users');
  await logSsoEvent(created ? 'user_created' : 'link_issued', { clientId, userId, employeeCode: profile.employeeCode,
    note: [outcome !== 'login' ? `outcome=${outcome}` : null, note].filter(Boolean).join('; ') || null, ip });
  return { login_url: `${publicAppUrl()}/sso?ticket=${ticket}`, expires_in: TICKET_TTL_SECONDS,
    account: outcome === 'login' ? (created ? 'created' : 'existing') : outcome };
}

/** Consumes a ticket exactly once. */
export async function consumeTicket(ticket: unknown) {
  if (typeof ticket !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(ticket)) return null;
  const result = await pool.request().input('hash', mssql.Char(64), secretHash(ticket))
    .query(`UPDATE sso_tickets SET used_at=SYSUTCDATETIME()
      OUTPUT inserted.client_id,inserted.user_id,inserted.outcome
      WHERE ticket_hash=@hash AND used_at IS NULL AND expires_at>SYSUTCDATETIME()`);
  return result.recordset[0] as { client_id: number; user_id: number; outcome: string } | undefined ?? null;
}
