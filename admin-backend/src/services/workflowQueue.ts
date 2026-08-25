import mssql from "mssql";
import { type AuthUser, effectiveRole } from "../auth";
import { pool, withDbRetry } from "../db";

export async function readWorkflowQueue(user: AuthUser, query: Record<string, unknown>) {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(100, Math.max(10, Number(query.page_size) || 25));
  const role = effectiveRole(user.role);
  const status = String(query.status || "all");
  const requestedCenter = typeof query.center_code === "string" && query.center_code !== "all"
    ? query.center_code.trim().toUpperCase() : null;
  const selectedCenter = ["center_admin", "hq_admin", "super_admin"].includes(role)
    ? requestedCenter : null;
  const result = await withDbRetry(() => pool.request()
    .input("uid", mssql.Int, user.id)
    .input("role", mssql.NVarChar(30), role)
    .input("cc", mssql.NVarChar(10), user.center_code || null)
    .input("selectedCenter", mssql.NVarChar(10), selectedCenter)
    .input("status", mssql.NVarChar(30), status)
    .input("offset", mssql.Int, (page - 1) * pageSize)
    .input("limit", mssql.Int, pageSize).query(`
      WITH visible AS (SELECT r.id,r.ref_id,r.user_id,r.company,r.team,r.type,r.subject,r.description,r.amount,r.priority,r.status,r.details,
        r.workflow_status,r.payment_status,r.home_center_code,r.request_center_code,r.approval_center_code,
        r.charge_center_code,r.inventory_center_code,r.fulfillment_status,r.fulfilled_at,r.fulfilled_by,
        CASE WHEN @role IN('hq_admin','super_admin') THEN r.receipt_status ELSE 'not_required' END receipt_status,
        CASE WHEN @role IN('hq_admin','super_admin') THEN r.receipt_feedback END receipt_feedback,
        CASE WHEN @role IN('hq_admin','super_admin') THEN r.receipt_note END receipt_note,
        CASE WHEN @role IN('hq_admin','super_admin') THEN r.receipt_confirmed_at END receipt_confirmed_at,
        r.created_at,r.updated_at,u.name employeeName,u.email,u.dept employeeDept,
        a.assignment_type,CASE
          WHEN @role='super_admin' AND r.workflow_status='awaiting_approval' THEN 1
          WHEN a.role=@role THEN a.can_act ELSE 0 END can_act,
        ISNULL((SELECT al.created_at [at],actor.name actor,al.action,al.note
          FROM approvals al JOIN users actor ON actor.id=al.actor_id WHERE al.request_id=r.id
            AND (@role IN('hq_admin','super_admin') OR al.action NOT IN('receipt_confirmed','receipt_disputed'))
          ORDER BY al.created_at,al.id FOR JSON PATH),'[]') audit
        FROM requests r JOIN users u ON u.id=r.user_id
        OUTER APPLY (SELECT TOP 1 ra.id,ra.role,ra.assignment_type,ra.can_act FROM request_assignments ra
          WHERE ra.request_id=r.id AND ra.is_active=1 AND ra.role=@role
            AND (ra.user_id IS NULL OR ra.user_id=@uid) AND (@role IN('super_admin','hq_admin') OR
              ra.center_code=@cc OR EXISTS(SELECT 1 FROM admin_center_access aca
                WHERE aca.user_id=@uid AND aca.center_code=ra.center_code AND aca.is_active=1))
          ORDER BY CASE WHEN ra.role=@role THEN 0 ELSE 1 END,
            ra.can_act DESC,ra.id DESC) a
        WHERE (@selectedCenter IS NULL OR r.approval_center_code=@selectedCenter) AND
        (@role IN('super_admin','hq_admin') OR a.id IS NOT NULL))
      SELECT *,COUNT(*) OVER() total_count FROM visible
      WHERE @status='all' OR status=@status OR workflow_status=@status
        OR (@status='ready_to_assign' AND fulfillment_status='ready_to_assign')
        OR (@status='delivery_issues' AND @role IN('hq_admin','super_admin') AND receipt_status='disputed')
        OR (@status='inbox' AND status IN('pending','info_requested'))
      ORDER BY created_at DESC,id DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;

      SELECT ISNULL(SUM(CASE WHEN r.status IN('pending','info_requested') THEN 1 ELSE 0 END),0) inbox,
        ISNULL(SUM(CASE WHEN r.status='queued' THEN 1 ELSE 0 END),0) queued,
        ISNULL(SUM(CASE WHEN r.workflow_status='awaiting_verification' THEN 1 ELSE 0 END),0) verification,
        ISNULL(SUM(CASE WHEN r.status='approved' THEN 1 ELSE 0 END),0) approved,
        ISNULL(SUM(CASE WHEN r.fulfillment_status='ready_to_assign' THEN 1 ELSE 0 END),0) ready_to_assign,
        ISNULL(SUM(CASE WHEN @role IN('hq_admin','super_admin') AND r.receipt_status='disputed' THEN 1 ELSE 0 END),0) delivery_issues,
        ISNULL(SUM(CASE WHEN r.status='rejected' THEN 1 ELSE 0 END),0) rejected,
        ISNULL(SUM(CASE WHEN r.status='withdrawn' THEN 1 ELSE 0 END),0) withdrawn,COUNT(*) [all]
      FROM requests r WHERE (@selectedCenter IS NULL OR r.approval_center_code=@selectedCenter) AND
        (@role IN('super_admin','hq_admin') OR EXISTS(SELECT 1 FROM request_assignments ra
          WHERE ra.request_id=r.id AND ra.is_active=1 AND ra.role=@role
            AND (ra.user_id IS NULL OR ra.user_id=@uid) AND (ra.center_code=@cc OR EXISTS(
              SELECT 1 FROM admin_center_access aca WHERE aca.user_id=@uid
                AND aca.center_code=ra.center_code AND aca.is_active=1))))`));
  const sets = result.recordsets as mssql.IRecordSet<Record<string, unknown>>[];
  return { data: sets[0], page, page_size: pageSize,
    total: Number(sets[0][0]?.total_count || 0), summary: sets[1][0] || {} };
}
