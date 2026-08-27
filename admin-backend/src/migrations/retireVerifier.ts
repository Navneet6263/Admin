import mssql from "mssql";

const TEST_CENTER = "UAT_RAMTEC";

export async function retireVerifierRole(pool: mssql.ConnectionPool) {
  await pool.request().input("testCenter", mssql.NVarChar(10), TEST_CENTER).query(`
    SET XACT_ABORT ON;
    BEGIN TRANSACTION;

    DECLARE @roleConstraint sysname;
    SELECT TOP 1 @roleConstraint=cc.name FROM sys.check_constraints cc
      JOIN sys.columns c ON c.object_id=cc.parent_object_id AND c.column_id=cc.parent_column_id
      WHERE cc.parent_object_id=OBJECT_ID('users') AND c.name='role';
    IF @roleConstraint IS NOT NULL EXEC('ALTER TABLE users DROP CONSTRAINT ['+@roleConstraint+']');

    UPDATE s SET revoked_at=SYSUTCDATETIME()
      FROM auth_sessions s JOIN users u ON u.id=s.user_id
      WHERE u.role='verifier' AND s.revoked_at IS NULL;
    DELETE uc FROM user_centers uc JOIN users u ON u.id=uc.user_id
      WHERE u.role NOT IN ('employee','center_admin');
    DELETE accessRow FROM admin_center_access accessRow
      JOIN users u ON u.id=accessRow.user_id WHERE u.role<>'center_admin';
    DELETE FROM approval_policies WHERE role='verifier';
    UPDATE request_assignments SET role='retired',center_code=NULL,can_act=0,is_active=0
      WHERE role='verifier';
    UPDATE users SET role='retired',center_code=NULL,is_active=0 WHERE role='verifier';

    DECLARE @testUsers TABLE(id INT PRIMARY KEY);
    INSERT INTO @testUsers(id) SELECT id FROM users
      WHERE LOWER(email) IN ('uta.verifier@gmail.com','uat.verifier@gmail.com');
    IF NOT EXISTS(SELECT 1 FROM requests r JOIN @testUsers t ON t.id=r.user_id)
      AND NOT EXISTS(SELECT 1 FROM requests r JOIN @testUsers t ON t.id=r.fulfilled_by)
      AND NOT EXISTS(SELECT 1 FROM approvals a JOIN @testUsers t ON t.id=a.actor_id)
      AND NOT EXISTS(SELECT 1 FROM payments p JOIN @testUsers t
        ON t.id=p.updated_by OR t.id=p.verified_by)
      AND NOT EXISTS(SELECT 1 FROM centers c JOIN @testUsers t ON t.id=c.hq_admin_id)
      AND NOT EXISTS(SELECT 1 FROM user_centers uc JOIN @testUsers t ON t.id=uc.assigned_by)
      AND NOT EXISTS(SELECT 1 FROM approval_policies p JOIN @testUsers t ON t.id=p.created_by)
      AND NOT EXISTS(SELECT 1 FROM admin_center_access a JOIN @testUsers t ON t.id=a.granted_by)
      AND NOT EXISTS(SELECT 1 FROM admin_audit_events e JOIN @testUsers t
        ON t.id=e.actor_id OR t.id=e.target_user_id)
    BEGIN
      DELETE s FROM auth_sessions s JOIN @testUsers t ON t.id=s.user_id;
      DELETE n FROM notifications n JOIN @testUsers t ON t.id=n.user_id;
      DELETE uc FROM user_centers uc JOIN @testUsers t ON t.id=uc.user_id;
      DELETE p FROM approval_policies p JOIN @testUsers t ON t.id=p.user_id;
      DELETE a FROM request_assignments a JOIN @testUsers t ON t.id=a.user_id;
      DELETE a FROM admin_center_access a JOIN @testUsers t ON t.id=a.user_id;
      DELETE u FROM users u JOIN @testUsers t ON t.id=u.id;
    END

    IF EXISTS(SELECT 1 FROM centers WHERE code=@testCenter)
    BEGIN
      IF NOT EXISTS(SELECT 1 FROM users WHERE center_code=@testCenter)
        AND NOT EXISTS(SELECT 1 FROM user_centers WHERE home_center_code=@testCenter)
        AND NOT EXISTS(SELECT 1 FROM requests WHERE home_center_code=@testCenter
          OR fulfil_center_code=@testCenter OR request_center_code=@testCenter
          OR approval_center_code=@testCenter OR charge_center_code=@testCenter
          OR inventory_center_code=@testCenter)
        AND NOT EXISTS(SELECT 1 FROM request_assignments WHERE center_code=@testCenter)
        AND NOT EXISTS(SELECT 1 FROM approval_policies WHERE center_code=@testCenter)
        AND NOT EXISTS(SELECT 1 FROM admin_center_access WHERE center_code=@testCenter)
        AND NOT EXISTS(SELECT 1 FROM stock_movements WHERE center_code=@testCenter)
        AND NOT EXISTS(SELECT 1 FROM center_inventory
          WHERE center_code=@testCenter AND (qty<>0 OR reserved_qty<>0))
        AND NOT EXISTS(SELECT 1 FROM center_budgets
          WHERE center_code=@testCenter AND (committed<>0 OR spent<>0))
      BEGIN
        DELETE FROM center_inventory WHERE center_code=@testCenter;
        DELETE FROM center_budgets WHERE center_code=@testCenter;
        DELETE FROM centers WHERE code=@testCenter;
      END
      ELSE UPDATE centers SET is_active=0 WHERE code=@testCenter;
    END

    ALTER TABLE users ADD CONSTRAINT CK_users_role_current CHECK(role IN
      ('employee','hq_admin','center_admin','finance','finance_head','super_admin','retired'));

    COMMIT TRANSACTION;
  `);
}
