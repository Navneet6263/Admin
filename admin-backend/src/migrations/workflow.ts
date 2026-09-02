import mssql from "mssql";
import { ensureInventoryCatalog } from "./inventoryCatalog";
import { ensureFulfillmentSchema } from "./fulfillment";
import { retireVerifierRole } from "./retireVerifier";

const statements = [
  `UPDATE users SET role='hq_admin' WHERE role='admin';
  IF OBJECT_ID('request_assignments','U') IS NOT NULL UPDATE request_assignments SET role='hq_admin' WHERE role='admin';
  IF OBJECT_ID('approval_policies','U') IS NOT NULL UPDATE approval_policies SET role='hq_admin' WHERE role='admin';
  IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID('users') AND name='CK_users_role_current') BEGIN
    DECLARE @roleConstraint sysname;
    SELECT TOP 1 @roleConstraint=cc.name FROM sys.check_constraints cc
      JOIN sys.columns c ON c.object_id=cc.parent_object_id AND c.column_id=cc.parent_column_id
      WHERE cc.parent_object_id=OBJECT_ID('users') AND c.name='role';
    IF @roleConstraint IS NOT NULL EXEC('ALTER TABLE users DROP CONSTRAINT ['+@roleConstraint+']');
    ALTER TABLE users ADD CONSTRAINT CK_users_role_current CHECK(role IN
      ('employee','hq_admin','center_admin','finance','finance_head','verifier','super_admin','retired'));
  END`,
  `IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID('requests') AND definition LIKE '%withdrawn%') BEGIN
    DECLARE @requestStatusConstraint sysname;
    SELECT TOP 1 @requestStatusConstraint=cc.name FROM sys.check_constraints cc
      WHERE cc.parent_object_id=OBJECT_ID('requests')
        AND (cc.definition LIKE '%status%' OR (cc.definition LIKE '%pending%' AND cc.definition LIKE '%approved%'));
    IF @requestStatusConstraint IS NOT NULL EXEC('ALTER TABLE requests DROP CONSTRAINT ['+@requestStatusConstraint+']');
    ALTER TABLE requests ADD CONSTRAINT CK_requests_status_enterprise CHECK(status IN
      ('pending','queued','awaiting_verification','approved','rejected','info_requested','withdrawn'));
  END`,
  `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('requests') AND name='request_center_code') BEGIN
    ALTER TABLE requests ADD request_center_code NVARCHAR(10) NULL, approval_center_code NVARCHAR(10) NULL,
      charge_center_code NVARCHAR(10) NULL, inventory_center_code NVARCHAR(10) NULL,
      workflow_status NVARCHAR(30) NOT NULL CONSTRAINT DF_requests_workflow DEFAULT 'awaiting_approval',
      payment_status NVARCHAR(30) NOT NULL CONSTRAINT DF_requests_payment DEFAULT 'not_required',
      actual_amount DECIMAL(14,2) NULL, payment_due_at DATETIME2 NULL;
  END`,
  `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('requests') AND name='client_request_id')
    ALTER TABLE requests ADD client_request_id NVARCHAR(64) NULL`,
  `IF OBJECT_ID('approval_policies','U') IS NULL CREATE TABLE approval_policies (
    id INT IDENTITY PRIMARY KEY, role NVARCHAR(30) NOT NULL, user_id INT NULL REFERENCES users(id),
    center_code NVARCHAR(10) NULL REFERENCES centers(code), category NVARCHAR(30) NULL,
    max_amount DECIMAL(14,2) NULL, can_view BIT NOT NULL DEFAULT 1, can_approve BIT NOT NULL DEFAULT 0,
    can_update_payment BIT NOT NULL DEFAULT 0, can_verify_payment BIT NOT NULL DEFAULT 0,
    can_view_analytics BIT NOT NULL DEFAULT 0, is_active BIT NOT NULL DEFAULT 1,
    created_by INT NULL REFERENCES users(id), created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  )`,
  `IF OBJECT_ID('auth_sessions','U') IS NULL CREATE TABLE auth_sessions (
    token_hash CHAR(64) PRIMARY KEY, user_id INT NOT NULL REFERENCES users(id),
    expires_at DATETIME2 NOT NULL, revoked_at DATETIME2 NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  )`,
  `IF OBJECT_ID('request_assignments','U') IS NULL CREATE TABLE request_assignments (
    id BIGINT IDENTITY PRIMARY KEY, request_id INT NOT NULL REFERENCES requests(id),
    center_code NVARCHAR(10) NULL REFERENCES centers(code), role NVARCHAR(30) NOT NULL,
    user_id INT NULL REFERENCES users(id), assignment_type NVARCHAR(20) NOT NULL,
    can_act BIT NOT NULL DEFAULT 0, is_active BIT NOT NULL DEFAULT 1,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  )`,
  `IF OBJECT_ID('admin_audit_events','U') IS NULL CREATE TABLE admin_audit_events (
    id BIGINT IDENTITY PRIMARY KEY,actor_id INT NOT NULL REFERENCES users(id),
    target_user_id INT NULL REFERENCES users(id),event_type NVARCHAR(50) NOT NULL,
    note NVARCHAR(1000) NULL,created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  )`,
  `IF OBJECT_ID('admin_center_access','U') IS NULL CREATE TABLE admin_center_access (
    id BIGINT IDENTITY PRIMARY KEY,user_id INT NOT NULL REFERENCES users(id),
    center_code NVARCHAR(10) NOT NULL REFERENCES centers(code),granted_by INT NOT NULL REFERENCES users(id),
    is_active BIT NOT NULL DEFAULT 1,created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_admin_center_access UNIQUE(user_id,center_code)
  )`,
  `IF OBJECT_ID('payments','U') IS NULL CREATE TABLE payments (
    id BIGINT IDENTITY PRIMARY KEY, request_id INT NOT NULL UNIQUE REFERENCES requests(id),
    estimated_amount DECIMAL(14,2) NULL, actual_amount DECIMAL(14,2) NULL,
    vendor_name NVARCHAR(200) NULL, invoice_number NVARCHAR(100) NULL, invoice_url NVARCHAR(1000) NULL,
    payment_method NVARCHAR(30) NULL, transaction_ref NVARCHAR(150) NULL,
    status NVARCHAR(30) NOT NULL DEFAULT 'awaiting_update', notes NVARCHAR(1000) NULL,
    due_at DATETIME2 NULL, updated_by INT NULL REFERENCES users(id), verified_by INT NULL REFERENCES users(id),
    paid_at DATETIME2 NULL, verified_at DATETIME2 NULL, created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  )`,
  `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('payments') AND name='expense_booked')
    ALTER TABLE payments ADD expense_booked BIT NOT NULL CONSTRAINT DF_payments_expense_booked DEFAULT 0`,
  `IF OBJECT_ID('center_inventory','U') IS NULL CREATE TABLE center_inventory (
    id BIGINT IDENTITY PRIMARY KEY, center_code NVARCHAR(10) NOT NULL REFERENCES centers(code),
    sku NVARCHAR(30) NOT NULL REFERENCES inventory(sku), qty INT NOT NULL DEFAULT 0,
    reserved_qty INT NOT NULL DEFAULT 0, updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_center_inventory UNIQUE(center_code,sku),
    CONSTRAINT CK_center_inventory_qty CHECK(qty>=0 AND reserved_qty>=0 AND reserved_qty<=qty)
  )`,
  `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('stock_movements') AND name='center_code')
    ALTER TABLE stock_movements ADD center_code NVARCHAR(10) NULL REFERENCES centers(code)`,
  `INSERT INTO center_inventory(center_code,sku,qty)
    SELECT c.code,i.sku,i.qty FROM centers c CROSS JOIN inventory i
    WHERE c.is_active=1 AND NOT EXISTS(SELECT 1 FROM center_inventory ci WHERE ci.center_code=c.code AND ci.sku=i.sku)`,
  `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('notifications') AND name='kind') BEGIN
    ALTER TABLE notifications ADD kind NVARCHAR(30) NOT NULL CONSTRAINT DF_notifications_kind DEFAULT 'general',
      action_url NVARCHAR(300) NULL, due_at DATETIME2 NULL, read_at DATETIME2 NULL, dedupe_key NVARCHAR(150) NULL;
  END`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_requests_routing')
    CREATE INDEX IX_requests_routing ON requests(approval_center_code,workflow_status,created_at DESC)
      INCLUDE(user_id,type,amount,charge_center_code,payment_status)`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='UX_requests_employee_submission')
    CREATE UNIQUE INDEX UX_requests_employee_submission ON requests(user_id,client_request_id)
      WHERE client_request_id IS NOT NULL`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_requests_spend_period')
    CREATE INDEX IX_requests_spend_period ON requests(created_at,charge_center_code)
      INCLUDE(type,company,status,amount,actual_amount)`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_requests_employee_history')
    CREATE INDEX IX_requests_employee_history ON requests(user_id,created_at DESC,id DESC)
      INCLUDE(ref_id,type,status,workflow_status,payment_status,priority,amount)`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_assignments_queue')
    CREATE INDEX IX_assignments_queue ON request_assignments(role,center_code,is_active,can_act) INCLUDE(request_id,user_id)`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_admin_audit_target')
    CREATE INDEX IX_admin_audit_target ON admin_audit_events(target_user_id,created_at DESC)
      INCLUDE(actor_id,event_type,note)`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_admin_center_access_user')
    CREATE INDEX IX_admin_center_access_user ON admin_center_access(user_id,is_active,center_code)
      INCLUDE(granted_by,updated_at)`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_auth_sessions_user_expiry')
    CREATE INDEX IX_auth_sessions_user_expiry ON auth_sessions(user_id,expires_at) INCLUDE(revoked_at)`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_payments_status_due')
    CREATE INDEX IX_payments_status_due ON payments(status,due_at) INCLUDE(request_id,actual_amount)`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_payments_paid_at')
    CREATE INDEX IX_payments_paid_at ON payments(paid_at) INCLUDE(actual_amount,estimated_amount) WHERE status='paid'`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_approvals_action_created')
    CREATE INDEX IX_approvals_action_created ON approvals(action,created_at DESC) INCLUDE(request_id,actor_id)`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_approvals_request_history')
    CREATE INDEX IX_approvals_request_history ON approvals(request_id,created_at,id) INCLUDE(actor_id,action,note)`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_center_inventory_stock')
    CREATE INDEX IX_center_inventory_stock ON center_inventory(center_code,sku) INCLUDE(qty,reserved_qty)`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='UX_notifications_dedupe')
    CREATE UNIQUE INDEX UX_notifications_dedupe ON notifications(dedupe_key) WHERE dedupe_key IS NOT NULL`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_notifications_user_feed')
    CREATE INDEX IX_notifications_user_feed ON notifications(user_id,created_at DESC,id DESC)
      INCLUDE(is_read,kind,due_at)`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_requests_global_feed')
    CREATE INDEX IX_requests_global_feed ON requests(updated_at DESC,id DESC)
      INCLUDE(company,status,approval_center_code,user_id,type,amount,priority)`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_requests_company_status_feed')
    CREATE INDEX IX_requests_company_status_feed ON requests(company,status,updated_at DESC,id DESC)
      INCLUDE(approval_center_code,user_id,type,amount,priority)`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_requests_home_center_dashboard')
    CREATE INDEX IX_requests_home_center_dashboard ON requests(home_center_code)
      INCLUDE(status,created_at,updated_at,amount)`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_stock_movements_feed')
    CREATE INDEX IX_stock_movements_feed ON stock_movements(created_at DESC,id DESC)
      INCLUDE(sku,direction,qty,balance_after,source,ref_id)`,
  `IF NOT EXISTS(SELECT 1 FROM approval_policies WHERE role='center_admin')
      INSERT INTO approval_policies(role,max_amount,can_view,can_approve,can_update_payment,can_verify_payment,can_view_analytics)
      VALUES('center_admin',50000,1,1,1,0,0);
    IF NOT EXISTS(SELECT 1 FROM approval_policies WHERE role='hq_admin')
      INSERT INTO approval_policies(role,max_amount,can_view,can_approve,can_update_payment,can_verify_payment,can_view_analytics)
      VALUES('hq_admin',1000000,1,1,1,0,1);
    IF NOT EXISTS(SELECT 1 FROM approval_policies WHERE role='finance')
      INSERT INTO approval_policies(role,max_amount,can_view,can_approve,can_update_payment,can_verify_payment,can_view_analytics)
      VALUES('finance',200000,1,0,1,1,0);
    IF NOT EXISTS(SELECT 1 FROM approval_policies WHERE role='finance_head')
      INSERT INTO approval_policies(role,max_amount,can_view,can_approve,can_update_payment,can_verify_payment,can_view_analytics)
      VALUES('finance_head',NULL,1,0,1,1,1);
    IF NOT EXISTS(SELECT 1 FROM approval_policies WHERE role='super_admin')
      INSERT INTO approval_policies(role,max_amount,can_view,can_approve,can_update_payment,can_verify_payment,can_view_analytics)
      VALUES('super_admin',NULL,1,1,1,1,1)`,
  `UPDATE r SET home_center_code=COALESCE(r.home_center_code,u.center_code),
      request_center_code=COALESCE(r.request_center_code,r.home_center_code,u.center_code),
      approval_center_code=COALESCE(r.approval_center_code,r.home_center_code,u.center_code),
      charge_center_code=COALESCE(r.charge_center_code,r.home_center_code,u.center_code),
      inventory_center_code=COALESCE(r.inventory_center_code,r.home_center_code,u.center_code),
      workflow_status=CASE WHEN r.status='approved' THEN 'approved' WHEN r.status='rejected' THEN 'rejected' ELSE r.workflow_status END
    FROM requests r JOIN users u ON u.id=r.user_id WHERE r.request_center_code IS NULL`,
  `UPDATE requests SET status='withdrawn' WHERE workflow_status='withdrawn' AND status<>'withdrawn'`,
  `UPDATE requests SET status='pending',workflow_status='awaiting_approval',updated_at=GETDATE()
    WHERE workflow_status='awaiting_verification' OR status='awaiting_verification';
   UPDATE requests SET workflow_status='completed' WHERE status='approved' AND workflow_status<>'completed'`,
  `INSERT INTO approvals(request_id,actor_id,action,note,created_at)
    SELECT r.id,r.user_id,'raised','Request raised by employee',r.created_at FROM requests r
    WHERE NOT EXISTS(SELECT 1 FROM approvals a WHERE a.request_id=r.id AND a.action='raised')`,
  `UPDATE request_assignments SET can_act=0 WHERE request_id IN
      (SELECT id FROM requests WHERE workflow_status<>'awaiting_approval');
    INSERT INTO request_assignments(request_id,center_code,role,assignment_type,can_act)
      SELECT r.id,r.approval_center_code,'center_admin','owner',1 FROM requests r
      WHERE r.workflow_status='awaiting_approval' AND r.approval_center_code IS NOT NULL
      AND NOT EXISTS(SELECT 1 FROM request_assignments a WHERE a.request_id=r.id
        AND a.role='center_admin' AND a.assignment_type='owner');
    INSERT INTO request_assignments(request_id,center_code,role,assignment_type,can_act)
      SELECT r.id,NULL,'hq_admin','owner',1 FROM requests r WHERE r.workflow_status='awaiting_approval'
      AND NOT EXISTS(SELECT 1 FROM request_assignments a WHERE a.request_id=r.id
        AND a.role='hq_admin' AND a.assignment_type='owner');
    INSERT INTO request_assignments(request_id,center_code,role,assignment_type,can_act)
      SELECT r.id,NULL,'super_admin','owner',1 FROM requests r WHERE r.workflow_status='awaiting_approval'
      AND NOT EXISTS(SELECT 1 FROM request_assignments a WHERE a.request_id=r.id
        AND a.role='super_admin' AND a.assignment_type='owner');
    WITH ranked AS (SELECT id,ROW_NUMBER() OVER(PARTITION BY request_id,role ORDER BY id DESC) rn
      FROM request_assignments WHERE assignment_type='owner' AND role IN('center_admin','hq_admin','super_admin'))
      UPDATE a SET is_active=0,can_act=0 FROM request_assignments a JOIN ranked x ON x.id=a.id WHERE x.rn>1;
    UPDATE a SET is_active=1,can_act=1 FROM request_assignments a JOIN requests r ON r.id=a.request_id
      WHERE r.workflow_status='awaiting_approval' AND a.assignment_type='owner'
        AND a.role IN('center_admin','hq_admin','super_admin') AND NOT EXISTS(SELECT 1 FROM request_assignments newer
          WHERE newer.request_id=a.request_id AND newer.role=a.role AND newer.assignment_type='owner' AND newer.id>a.id);
    UPDATE a SET can_act=CASE WHEN a.role='super_admin' THEN 1 ELSE 0 END
      FROM request_assignments a JOIN requests r ON r.id=a.request_id
      WHERE r.status='queued' AND r.workflow_status='awaiting_approval'
        AND a.role IN('center_admin','hq_admin','super_admin')`,
];

export async function ensureWorkflowSchema(pool: mssql.ConnectionPool) {
  for (const sql of statements) await pool.request().query(sql);
  await ensureFulfillmentSchema(pool);
  await retireVerifierRole(pool);
  await ensureInventoryCatalog(pool);
}
