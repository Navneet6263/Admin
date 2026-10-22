import { Router, type Request } from 'express';
import mssql from 'mssql';
import { pool } from '../db';
import { hashPassword, parseStaffPermissions, passwordError } from '../auth';
import { resolveCenterScope } from '../services/centerScope';

/** Center Admin's own team: staff accounts with delegated, customisable permissions. */
const router = Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const staffSql = `SELECT u.id,u.name,u.email,u.dept,u.is_active,u.created_at,cs.center_code,cs.permissions,
    creator.name created_by_name
  FROM center_staff cs JOIN users u ON u.id=cs.user_id
  JOIN users creator ON creator.id=cs.created_by`;
const toStaff = (row: Record<string, unknown>) => ({ ...row, permissions: parseStaffPermissions(row.permissions) });

async function staffInScope(req: Request, staffId: number) {
  const result = await pool.request().input('id', mssql.Int, staffId)
    .query(`${staffSql} WHERE cs.user_id=@id AND u.role='center_staff'`);
  const row = result.recordset[0];
  if (!row) return null;
  return await resolveCenterScope(req.user!, row.center_code) ? row : null;
}

router.get('/', async (req, res) => {
  try {
    const center = await resolveCenterScope(req.user!, req.query.center_code);
    if (!center) return res.status(403).json({ error: 'You do not have access to this center' });
    const result = await pool.request().input('cc', mssql.NVarChar(10), center)
      .query(`${staffSql} WHERE cs.center_code=@cc AND u.role='center_staff' ORDER BY u.is_active DESC,u.name`);
    res.json(result.recordset.map(toStaff));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Team could not be loaded' });
  }
});

router.post('/', async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const dept = String(req.body?.dept || '').trim() || 'Center Staff';
  const password = req.body?.password;
  if (!name || name.length > 100 || !emailPattern.test(email) || email.length > 100 || dept.length > 80)
    return res.status(400).json({ error: 'A valid name and email are required' });
  const invalidPassword = passwordError(password);
  if (invalidPassword) return res.status(400).json({ error: invalidPassword });
  const permissions = parseStaffPermissions(req.body?.permissions);
  try {
    const center = await resolveCenterScope(req.user!, req.body?.center_code);
    if (!center) return res.status(403).json({ error: 'You do not have access to this center' });
    const result = await pool.request()
      .input('email', mssql.NVarChar(100), email)
      .input('name', mssql.NVarChar(100), name)
      .input('dept', mssql.NVarChar(80), dept)
      .input('cc', mssql.NVarChar(10), center)
      .input('hash', mssql.NVarChar(256), hashPassword(password))
      .input('perms', mssql.NVarChar(2000), JSON.stringify(permissions))
      .input('actor', mssql.Int, req.user!.id)
      .query(`SET XACT_ABORT ON; BEGIN TRANSACTION;
        DECLARE @company NVARCHAR(100)=(SELECT company FROM centers WHERE code=@cc AND is_active=1);
        IF @company IS NULL THROW 51060,'Selected center is not active',1;
        IF EXISTS(SELECT 1 FROM users WHERE email=@email) THROW 51061,'User with this email already exists',1;
        DECLARE @ids TABLE(id INT);
        INSERT INTO users(email,name,role,company,dept,center_code,password_hash,is_active)
          OUTPUT inserted.id INTO @ids VALUES(@email,@name,'center_staff',@company,@dept,@cc,@hash,1);
        DECLARE @id INT=(SELECT id FROM @ids);
        INSERT INTO center_staff(user_id,center_code,created_by,permissions) VALUES(@id,@cc,@actor,@perms);
        INSERT INTO admin_audit_events(actor_id,target_user_id,event_type,note)
          VALUES(@actor,@id,'center_staff_created',CONCAT('Center staff created for ',@cc));
        COMMIT TRANSACTION;
        SELECT @id id;`);
    res.status(201).json({ id: result.recordset[0].id, permissions });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/already exists|UNIQUE|duplicate/i.test(message)) return res.status(409).json({ error: 'User with this email already exists' });
    if (/not active/i.test(message)) return res.status(400).json({ error: message });
    console.error(error);
    res.status(500).json({ error: 'Staff account could not be created' });
  }
});

router.patch('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid staff ID' });
  const has = (key: string) => Object.prototype.hasOwnProperty.call(req.body ?? {}, key);
  const name = has('name') ? String(req.body.name || '').trim() : null;
  if (name !== null && (!name || name.length > 100)) return res.status(400).json({ error: 'A valid name is required' });
  if (has('is_active') && typeof req.body.is_active !== 'boolean') return res.status(400).json({ error: 'Invalid status' });
  try {
    const staff = await staffInScope(req, id);
    if (!staff) return res.status(404).json({ error: 'Staff member not found' });
    const permissions = has('permissions') ? parseStaffPermissions(req.body.permissions) : null;
    await pool.request()
      .input('id', mssql.Int, id)
      .input('name', mssql.NVarChar(100), name)
      .input('active', mssql.Bit, has('is_active') ? req.body.is_active : null)
      .input('perms', mssql.NVarChar(2000), permissions ? JSON.stringify(permissions) : null)
      .input('actor', mssql.Int, req.user!.id)
      .query(`SET XACT_ABORT ON; BEGIN TRANSACTION;
        UPDATE users SET name=COALESCE(@name,name),is_active=COALESCE(@active,is_active) WHERE id=@id;
        UPDATE center_staff SET permissions=COALESCE(@perms,permissions),updated_at=SYSUTCDATETIME() WHERE user_id=@id;
        IF @active=0 UPDATE auth_sessions SET revoked_at=SYSUTCDATETIME() WHERE user_id=@id AND revoked_at IS NULL;
        INSERT INTO admin_audit_events(actor_id,target_user_id,event_type,note)
          VALUES(@actor,@id,'center_staff_updated',
            CASE WHEN @active=0 THEN 'Staff access disabled' WHEN @active=1 THEN 'Staff access enabled'
              ELSE 'Staff permissions updated' END);
        COMMIT TRANSACTION`);
    const updated = await staffInScope(req, id);
    res.json(updated ? toStaff(updated) : { id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Staff account could not be updated' });
  }
});

router.post('/:id/password', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid staff ID' });
  const invalidPassword = passwordError(req.body?.password);
  if (invalidPassword) return res.status(400).json({ error: invalidPassword });
  try {
    if (!await staffInScope(req, id)) return res.status(404).json({ error: 'Staff member not found' });
    await pool.request().input('id', mssql.Int, id)
      .input('hash', mssql.NVarChar(256), hashPassword(req.body.password))
      .input('actor', mssql.Int, req.user!.id)
      .query(`SET XACT_ABORT ON; BEGIN TRANSACTION;
        UPDATE users SET password_hash=@hash WHERE id=@id;
        UPDATE auth_sessions SET revoked_at=SYSUTCDATETIME() WHERE user_id=@id AND revoked_at IS NULL;
        INSERT INTO admin_audit_events(actor_id,target_user_id,event_type,note)
          VALUES(@actor,@id,'center_staff_password_reset','Staff password reset');
        COMMIT TRANSACTION`);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Password could not be reset' });
  }
});

export default router;
