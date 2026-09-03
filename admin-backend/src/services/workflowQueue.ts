import mssql from "mssql";
import { type AuthUser, effectiveRole } from "../auth";
import { pool, withDbRetry } from "../db";

const globalRoles = new Set(["super_admin", "hq_admin"]);

function statusPredicate(status: string) {
  const predicates: Record<string, string> = {
    all: "1=1",
    inbox: "r.status IN('pending','info_requested')",
    queued: "r.status='queued'",
    approved: "r.status='approved'",
    rejected: "r.status='rejected'",
    withdrawn: "r.status='withdrawn'",
    ready_to_assign: "r.fulfillment_status='ready_to_assign'",
    delivery_issues: "r.receipt_status='disputed'",
    verification: "r.workflow_status='awaiting_verification'",
  };
  return predicates[status] || "(r.status=@status OR r.workflow_status=@status)";
}

function visibilityPredicate(role: string) {
  if (globalRoles.has(role)) return "1=1";
  return `EXISTS(SELECT 1 FROM request_assignments visible_assignment
    WHERE visible_assignment.request_id=r.id AND visible_assignment.is_active=1
      AND visible_assignment.role=@role
      AND (visible_assignment.user_id IS NULL OR visible_assignment.user_id=@uid)
      AND (visible_assignment.center_code=@cc OR EXISTS(
        SELECT 1 FROM admin_center_access access
        WHERE access.user_id=@uid AND access.center_code=visible_assignment.center_code AND access.is_active=1)))`;
}

const assignmentApply = `OUTER APPLY (SELECT TOP 1 assignment.role,assignment.assignment_type,assignment.can_act
  FROM request_assignments assignment
  WHERE assignment.request_id=p.id AND assignment.is_active=1 AND assignment.role=@role
    AND (assignment.user_id IS NULL OR assignment.user_id=@uid)
    AND (@role IN('super_admin','hq_admin') OR assignment.center_code=@cc OR EXISTS(
      SELECT 1 FROM admin_center_access access
      WHERE access.user_id=@uid AND access.center_code=assignment.center_code AND access.is_active=1))
  ORDER BY assignment.can_act DESC,assignment.id DESC) active_assignment`;

function requestInputs(user: AuthUser, selectedCenter: string | null) {
  return pool.request()
    .input("uid", mssql.Int, user.id)
    .input("role", mssql.NVarChar(30), effectiveRole(user.role))
    .input("cc", mssql.NVarChar(10), user.center_code || null)
    .input("selectedCenter", mssql.NVarChar(10), selectedCenter);
}

export async function readWorkflowQueue(user: AuthUser, query: Record<string, unknown>) {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(100, Math.max(10, Number(query.page_size) || 25));
  const role = effectiveRole(user.role);
  const status = String(query.status || "all");
  const compact = String(query.compact || "") === "1";
  const requestedCenter = typeof query.center_code === "string" && query.center_code !== "all"
    ? query.center_code.trim().toUpperCase() : null;
  const selectedCenter = ["center_admin", "hq_admin", "super_admin"].includes(role) ? requestedCenter : null;
  const centerWhere = selectedCenter ? "r.approval_center_code=@selectedCenter" : "1=1";
  const visibilityWhere = visibilityPredicate(role);
  const contentColumns = compact ? "" : ",r.description,r.details";
  const auditColumn = compact ? ",CAST('[]' AS NVARCHAR(MAX)) audit" : `,ISNULL((SELECT
    history.created_at [at],actor.name actor,history.action,history.note
    FROM approvals history JOIN users actor ON actor.id=history.actor_id
    WHERE history.request_id=p.id
      AND (@role IN('center_admin','hq_admin','super_admin') OR history.action NOT IN
        ('receipt_confirmed','receipt_disputed','issue_resolved'))
    ORDER BY history.created_at,history.id FOR JSON PATH),'[]') audit`;

  const result = await withDbRetry(() => requestInputs(user, selectedCenter)
    .input("status", mssql.NVarChar(30), status)
    .input("offset", mssql.Int, (page - 1) * pageSize)
    .input("limit", mssql.Int, pageSize).query(`
      WITH filtered AS (SELECT r.id,r.ref_id,r.user_id,r.company,r.team,r.type,r.subject,r.amount,r.priority,r.status,
        r.workflow_status,r.payment_status,r.actual_amount,r.home_center_code,r.request_center_code,
        r.approval_center_code,r.charge_center_code,r.inventory_center_code,r.fulfillment_status,
        r.fulfilled_at,r.fulfilled_by,
        CASE WHEN @role IN('center_admin','hq_admin','super_admin') THEN r.receipt_status ELSE 'not_required' END receipt_status,
        CASE WHEN @role IN('center_admin','hq_admin','super_admin') THEN r.receipt_feedback END receipt_feedback,
        CASE WHEN @role IN('center_admin','hq_admin','super_admin') THEN r.receipt_note END receipt_note,
        CASE WHEN @role IN('center_admin','hq_admin','super_admin') THEN r.receipt_confirmed_at END receipt_confirmed_at,
        r.created_at,r.updated_at,u.name employeeName,u.email,u.dept employeeDept${contentColumns},
        COUNT_BIG(*) OVER() total_count
        FROM requests r JOIN users u ON u.id=r.user_id
        WHERE ${centerWhere} AND ${visibilityWhere} AND ${statusPredicate(status)}),
      paged AS (SELECT * FROM filtered ORDER BY created_at DESC,id DESC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY)
      SELECT p.*,active_assignment.assignment_type,CASE
        WHEN @role='super_admin' AND p.workflow_status='awaiting_approval' THEN 1
        WHEN active_assignment.role=@role THEN active_assignment.can_act ELSE 0 END can_act${auditColumn}
      FROM paged p ${assignmentApply} ORDER BY p.created_at DESC,p.id DESC;

      SELECT ISNULL(SUM(CASE WHEN r.status IN('pending','info_requested') THEN 1 ELSE 0 END),0) inbox,
        ISNULL(SUM(CASE WHEN r.status='queued' THEN 1 ELSE 0 END),0) queued,
        ISNULL(SUM(CASE WHEN r.workflow_status='awaiting_verification' THEN 1 ELSE 0 END),0) verification,
        ISNULL(SUM(CASE WHEN r.status='approved' THEN 1 ELSE 0 END),0) approved,
        ISNULL(SUM(CASE WHEN r.fulfillment_status='ready_to_assign' THEN 1 ELSE 0 END),0) ready_to_assign,
        ISNULL(SUM(CASE WHEN r.receipt_status='disputed' THEN 1 ELSE 0 END),0) delivery_issues,
        ISNULL(SUM(CASE WHEN r.status='rejected' THEN 1 ELSE 0 END),0) rejected,
        ISNULL(SUM(CASE WHEN r.status='withdrawn' THEN 1 ELSE 0 END),0) withdrawn,COUNT_BIG(*) [all]
      FROM requests r WHERE ${centerWhere} AND ${visibilityWhere}`));
  const sets = result.recordsets as mssql.IRecordSet<Record<string, unknown>>[];
  return { data: sets[0], page, page_size: pageSize,
    total: Number(sets[0][0]?.total_count || 0), summary: sets[1][0] || {} };
}

export async function readWorkflowRequest(user: AuthUser, requestId: number) {
  const role = effectiveRole(user.role);
  const visibilityWhere = visibilityPredicate(role);
  const result = await withDbRetry(() => requestInputs(user, null)
    .input("requestId", mssql.Int, requestId).query(`
      WITH selected AS (SELECT r.*,u.name employeeName,u.email,u.dept employeeDept
        FROM requests r JOIN users u ON u.id=r.user_id
        WHERE r.id=@requestId AND ${visibilityWhere})
      SELECT p.*,active_assignment.assignment_type,CASE
        WHEN @role='super_admin' AND p.workflow_status='awaiting_approval' THEN 1
        WHEN active_assignment.role=@role THEN active_assignment.can_act ELSE 0 END can_act,
        ISNULL((SELECT history.created_at [at],actor.name actor,history.action,history.note
          FROM approvals history JOIN users actor ON actor.id=history.actor_id
          WHERE history.request_id=p.id ORDER BY history.created_at,history.id FOR JSON PATH),'[]') audit
      FROM selected p ${assignmentApply}`));
  return result.recordset[0] || null;
}
