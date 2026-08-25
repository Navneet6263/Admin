import "dotenv/config";
import mssql from "mssql";

const flag = (key, fallback) => {
  const value = process.env[key]?.trim().toLowerCase();
  return value ? ["1", "true", "yes"].includes(value) : fallback;
};
const pool = await mssql.connect({
  user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER, database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT) || 1433,
  options: { encrypt: flag("DB_ENCRYPT", true),
    trustServerCertificate: flag("DB_TRUST_SERVER_CERTIFICATE", true) },
});

const checks = [
  ["withdrawn request status constraint", `SELECT COUNT(*) failures FROM (SELECT 1 ok) x
    WHERE NOT EXISTS(SELECT 1 FROM sys.check_constraints
      WHERE parent_object_id=OBJECT_ID('requests') AND definition LIKE '%withdrawn%')`],
  ["workflow indexes", `SELECT CASE WHEN COUNT(*)>=4 THEN 0 ELSE 1 END failures FROM sys.indexes
    WHERE name IN('IX_requests_routing','IX_requests_employee_history','IX_assignments_queue','IX_approvals_request_history')`],
  ["withdrawn status consistency", `SELECT COUNT(*) failures FROM requests
    WHERE workflow_status='withdrawn' AND status<>'withdrawn'`],
  ["standalone Admin role retired", `SELECT COUNT(*) failures FROM users WHERE role='admin'`],
  ["no blocking verifier stage", `SELECT COUNT(*) failures FROM requests
    WHERE workflow_status='awaiting_verification' OR status='awaiting_verification'`],
  ["parallel admin assignments", `SELECT COUNT(*) failures FROM requests r
    WHERE r.workflow_status='awaiting_approval' AND r.status<>'queued' AND (SELECT COUNT(DISTINCT a.role)
      FROM request_assignments a WHERE a.request_id=r.id AND a.assignment_type='owner'
      AND a.is_active=1 AND a.can_act=1 AND a.role IN('center_admin','hq_admin','super_admin'))<>3`],
  ["queued requests locked to Super Admin", `SELECT COUNT(*) failures FROM requests r
    WHERE r.workflow_status='awaiting_approval' AND r.status='queued' AND
      (EXISTS(SELECT 1 FROM request_assignments a WHERE a.request_id=r.id AND a.can_act=1
        AND a.role IN('center_admin','hq_admin')) OR NOT EXISTS(SELECT 1 FROM request_assignments a
        WHERE a.request_id=r.id AND a.can_act=1 AND a.role='super_admin'))`],
  ["raised audit event", `SELECT COUNT(*) failures FROM requests r
    WHERE NOT EXISTS(SELECT 1 FROM approvals a WHERE a.request_id=r.id AND a.action='raised')`],
  ["approved requests operationally complete", `SELECT COUNT(*) failures FROM requests
    WHERE status='approved' AND workflow_status<>'completed'`],
  ["closed requests have no actionable admin", `SELECT COUNT(*) failures FROM requests r
    WHERE r.workflow_status<>'awaiting_approval' AND EXISTS(SELECT 1 FROM request_assignments a
      WHERE a.request_id=r.id AND a.can_act=1)`],
  ["duplicate payment records", `SELECT COUNT(*) failures FROM (
    SELECT request_id FROM payments GROUP BY request_id HAVING COUNT(*)>1) duplicates`],
  ["duplicate audit events", `SELECT COUNT(*) failures FROM (
    SELECT request_id,actor_id,action,ISNULL(note,'') note,created_at FROM approvals
    GROUP BY request_id,actor_id,action,ISNULL(note,''),created_at HAVING COUNT(*)>1) duplicates`],
  ["duplicate actionable role owners", `SELECT COUNT(*) failures FROM (
    SELECT request_id,role FROM request_assignments WHERE is_active=1 AND can_act=1 AND assignment_type='owner'
    GROUP BY request_id,role HAVING COUNT(*)>1) duplicates`],
  ["team administration audit table", `SELECT CASE WHEN OBJECT_ID('admin_audit_events','U') IS NULL THEN 1 ELSE 0 END failures`],
  ["additional center access table", `SELECT CASE WHEN OBJECT_ID('admin_center_access','U') IS NULL THEN 1 ELSE 0 END failures`],
  ["fulfillment queue schema", `SELECT CASE WHEN COL_LENGTH('requests','fulfillment_status') IS NULL
    OR NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='IX_requests_fulfillment_queue') THEN 1 ELSE 0 END failures`],
  ["handover audit action constraint", `SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id=OBJECT_ID('approvals') AND definition LIKE '%assigned%'
      AND definition LIKE '%receipt_confirmed%' AND definition LIKE '%receipt_disputed%') THEN 1 ELSE 0 END failures`],
  ["assigned handover identity", `SELECT COUNT(*) failures FROM requests
    WHERE fulfillment_status='assigned' AND (fulfilled_by IS NULL OR fulfilled_at IS NULL)`],
  ["receipt confirmation schema", `SELECT CASE WHEN COL_LENGTH('requests','receipt_status') IS NULL
    OR NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='IX_requests_receipt_queue') THEN 1 ELSE 0 END failures`],
  ["assigned items awaiting receipt outcome", `SELECT COUNT(*) failures FROM requests
    WHERE fulfillment_status='assigned' AND receipt_status NOT IN('awaiting_confirmation','received','disputed')`],
  ["valid employee receipt evidence", `SELECT COUNT(*) failures FROM requests
    WHERE (receipt_status='received' AND (receipt_feedback IS NULL OR receipt_confirmed_at IS NULL))
      OR (receipt_status='disputed' AND (NULLIF(LTRIM(RTRIM(receipt_note)),'') IS NULL OR receipt_confirmed_at IS NULL))`],
  ["receipt outcomes have audit", `SELECT COUNT(*) failures FROM requests r
    WHERE (r.receipt_status='received' AND NOT EXISTS(SELECT 1 FROM approvals a
      WHERE a.request_id=r.id AND a.action='receipt_confirmed'))
      OR (r.receipt_status='disputed' AND NOT EXISTS(SELECT 1 FROM approvals a
        WHERE a.request_id=r.id AND a.action='receipt_disputed'))`],
];

let failed = 0;
for (const [label, sql] of checks) {
  const result = await pool.request().query(sql);
  const count = Number(result.recordset[0]?.failures || 0);
  if (count) { failed += 1; console.log(`FAIL ${label}: ${count}`); }
  else console.log(`PASS ${label}`);
}
await pool.close();
if (failed) throw new Error(`${failed} workflow integrity check(s) failed`);
