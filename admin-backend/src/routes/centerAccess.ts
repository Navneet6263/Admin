import { Router } from "express";
import mssql from "mssql";
import { pool, clearCache } from "../db";

const router = Router();

router.get("/:id/center-access", async (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId)) return res.status(400).json({ error: "Invalid user ID" });
  try {
    const result = await pool.request().input("uid", mssql.Int, userId).query(`
      SELECT u.id,u.role,u.center_code home_center_code,c.name home_center_name
        FROM users u LEFT JOIN centers c ON c.code=u.center_code WHERE u.id=@uid;
      SELECT a.center_code,c.name,c.city,a.created_at,grantor.name granted_by_name
        FROM admin_center_access a JOIN centers c ON c.code=a.center_code
        JOIN users grantor ON grantor.id=a.granted_by
        WHERE a.user_id=@uid AND a.is_active=1 ORDER BY c.name`);
    const sets = result.recordsets as mssql.IRecordSet<Record<string, unknown>>[];
    const target = sets[0][0];
    if (!target) return res.status(404).json({ error: "User not found" });
    if (target.role !== "center_admin")
      return res.status(400).json({ error: "Additional center access is only for Center Admins" });
    res.json({ user_id: userId, home_center_code: target.home_center_code,
      home_center_name: target.home_center_name, additional_centers: sets[1] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Center access could not be loaded" });
  }
});

router.post("/:id/center-access", async (req, res) => {
  const userId = Number(req.params.id);
  const centerCode = String(req.body?.center_code || "").trim().toUpperCase();
  if (!Number.isInteger(userId) || !/^[A-Z0-9_-]{2,10}$/.test(centerCode))
    return res.status(400).json({ error: "A valid user and center are required" });
  try {
    await pool.request()
      .input("uid", mssql.Int, userId)
      .input("cc", mssql.NVarChar(10), centerCode)
      .input("actor", mssql.Int, req.user!.id)
      .query(`SET XACT_ABORT ON; BEGIN TRANSACTION;
        DECLARE @home NVARCHAR(10),@role NVARCHAR(30);
        SELECT @home=center_code,@role=role FROM users WITH(UPDLOCK,ROWLOCK) WHERE id=@uid AND is_active=1;
        IF @role IS NULL THROW 51040,'User not found or inactive',1;
        IF @role<>'center_admin' THROW 51041,'Additional access is only for Center Admins',1;
        IF @home=@cc THROW 51042,'This is already the Home Center',1;
        IF NOT EXISTS(SELECT 1 FROM centers WHERE code=@cc AND is_active=1)
          THROW 51043,'Selected center is not active',1;
        IF EXISTS(SELECT 1 FROM admin_center_access WHERE user_id=@uid AND center_code=@cc)
          UPDATE admin_center_access SET is_active=1,granted_by=@actor,updated_at=SYSUTCDATETIME()
            WHERE user_id=@uid AND center_code=@cc;
        ELSE INSERT INTO admin_center_access(user_id,center_code,granted_by) VALUES(@uid,@cc,@actor);
        INSERT INTO admin_audit_events(actor_id,target_user_id,event_type,note)
          VALUES(@actor,@uid,'center_access_granted',CONCAT('Additional center access granted: ',@cc));
        COMMIT TRANSACTION`);
    clearCache("sa:users");
    res.json({ success: true, center_code: centerCode });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Center access grant failed";
    res.status(/User not found|only for Center|Home Center|not active/i.test(message) ? 400 : 500)
      .json({ error: message });
  }
});

router.delete("/:id/center-access/:centerCode", async (req, res) => {
  const userId = Number(req.params.id);
  const centerCode = String(req.params.centerCode || "").trim().toUpperCase();
  try {
    const result = await pool.request()
      .input("uid", mssql.Int, userId).input("cc", mssql.NVarChar(10), centerCode)
      .input("actor", mssql.Int, req.user!.id).query(`SET XACT_ABORT ON; BEGIN TRANSACTION;
        UPDATE admin_center_access SET is_active=0,updated_at=SYSUTCDATETIME()
          WHERE user_id=@uid AND center_code=@cc AND is_active=1;
        IF @@ROWCOUNT=0 THROW 51044,'Center access was not active',1;
        INSERT INTO admin_audit_events(actor_id,target_user_id,event_type,note)
          VALUES(@actor,@uid,'center_access_revoked',CONCAT('Additional center access revoked: ',@cc));
        COMMIT TRANSACTION`);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Center access revoke failed";
    res.status(message.includes("not active") ? 409 : 500).json({ error: message });
  }
});

export default router;
