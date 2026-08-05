-- ============================================================
-- HQ Admin + Center Admin role split
-- Run in SSMS on admin_db (after setup.sql / center_migration.sql)
-- ============================================================
USE admin_db;
GO

-- Drop existing role CHECK constraint(s) on users.role
DECLARE @sql NVARCHAR(MAX) = N'';
SELECT @sql += N'ALTER TABLE users DROP CONSTRAINT ' + QUOTENAME(cc.name) + N';'
FROM sys.check_constraints cc
JOIN sys.columns c ON c.object_id = cc.parent_object_id AND c.column_id = cc.parent_column_id
WHERE cc.parent_object_id = OBJECT_ID(N'users') AND c.name = N'role';
IF LEN(@sql) > 0 EXEC sp_executesql @sql;
GO

-- Allow center_admin + hq_admin (keep legacy admin for safety until migrated)
ALTER TABLE users ADD CONSTRAINT CK_users_role CHECK (
  role IN (
    'employee',
    'admin',
    'hq_admin',
    'center_admin',
    'finance',
    'finance_head',
    'verifier',
    'super_admin'
  )
);
GO

-- Migrate existing HQ-style admins
UPDATE users SET role = 'hq_admin' WHERE role = 'admin';
GO
