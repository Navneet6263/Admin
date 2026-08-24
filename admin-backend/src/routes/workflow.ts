import { Router } from "express";
import mssql from "mssql";
import { effectiveRole, requireAssignedCenter } from "../auth";
import { pool, withDbRetry } from "../db";
import { authorize } from "../services/policy";
import { completeApproval } from "../services/approval";
import { notify, notifyRole } from "../services/notifications";

const router = Router();
router.use(requireAssignedCenter);
const paging = (pageValue: unknown, sizeValue: unknown) => {
  const page = Math.max(1, Number(pageValue) || 1);
  const pageSize = Math.min(100, Math.max(10, Number(sizeValue) || 25));
  return { page, pageSize, offset: (page - 1) * pageSize };
};

router.get("/queue", async (req, res) => {
  const user = req.user!;
  const { page, pageSize, offset } = paging(
    req.query.page,
    req.query.page_size,
  );
  const status = String(req.query.status || "all");
  const role = effectiveRole(user.role);
  const selectedCenter = typeof req.query.center_code === "string" && req.query.center_code !== "all"
    && (role === "hq_admin" || role === "super_admin") ? req.query.center_code : null;
  try {
    const db = await withDbRetry(() => pool
      .request()
      .input("uid", mssql.Int, user.id)
      .input("role", mssql.NVarChar(30), role)
      .input("cc", mssql.NVarChar(10), user.center_code || null)
      .input("selectedCenter", mssql.NVarChar(10), selectedCenter)
      .input("status", mssql.NVarChar(30), status)
      .input("offset", mssql.Int, offset)
      .input("limit", mssql.Int, pageSize).query(`
        WITH visible AS (SELECT r.id,r.ref_id,r.user_id,r.company,r.team,r.type,r.subject,r.description,r.amount,r.priority,r.status,r.details,
          r.workflow_status,r.payment_status,r.home_center_code,r.request_center_code,r.approval_center_code,
          r.charge_center_code,r.inventory_center_code,r.created_at,r.updated_at,u.name employeeName,u.dept employeeDept,
          a.assignment_type,CASE WHEN a.role=@role OR (@role='hq_admin' AND a.role='admin') THEN a.can_act ELSE 0 END can_act
          FROM requests r JOIN users u ON u.id=r.user_id
          OUTER APPLY (SELECT TOP 1 ra.id,ra.role,ra.assignment_type,ra.can_act FROM request_assignments ra
            WHERE ra.request_id=r.id AND ra.is_active=1 AND (@role IN('super_admin','hq_admin') OR
              (ra.role=@role AND (ra.user_id IS NULL OR ra.user_id=@uid)
                AND (@cc IS NULL OR ra.center_code=@cc OR @role IN('hq_admin','finance','finance_head'))))
            ORDER BY CASE WHEN ra.role=@role OR (@role='hq_admin' AND ra.role='admin') THEN 0 ELSE 1 END,
              ra.can_act DESC,ra.id DESC) a
          WHERE (@status='all' OR r.workflow_status=@status)
          AND (@selectedCenter IS NULL OR r.approval_center_code=@selectedCenter) AND
          (@role IN('super_admin','hq_admin') OR a.id IS NOT NULL))
        SELECT *,COUNT(*) OVER() total_count FROM visible ORDER BY created_at DESC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`));
    res.json({
      data: db.recordset,
      page,
      page_size: pageSize,
      total: Number(db.recordset[0]?.total_count || 0),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Queue unavailable" });
  }
});

async function actionable(user: Express.Request["user"], requestId: number) {
  const role = effectiveRole(user!.role);
  const result = await pool
    .request()
    .input("rid", mssql.Int, requestId)
    .input("role", mssql.NVarChar(30), role)
    .input("uid", mssql.Int, user!.id)
    .input("cc", mssql.NVarChar(10), user!.center_code || null)
    .query(`SELECT TOP 1 r.* FROM requests r JOIN request_assignments a ON a.request_id=r.id
      WHERE r.id=@rid AND r.workflow_status='awaiting_approval' AND a.is_active=1 AND a.can_act=1
      AND (@role='super_admin' OR ((a.role=@role OR (@role='hq_admin' AND a.role='admin')) AND (a.user_id IS NULL OR a.user_id=@uid)
        AND (@cc IS NULL OR a.center_code=@cc OR @role='hq_admin')))`);
  return result.recordset[0];
}

router.post("/requests/:id/approve", async (req, res) => {
  const id = Number(req.params.id);
  const user = req.user!;
  try {
    const row = await actionable(user, id);
    if (!row)
      return res.status(403).json({ error: "Request is not assigned to you" });
    const access = await authorize(
      user,
      "can_approve",
      row.type,
      row.approval_center_code,
      row.amount,
    );
    if (!access.allowed)
      return res.status(403).json({
        error: `Approval limit exceeded`,
        limit: access.policy?.max_amount,
      });
    await completeApproval(id, user.id, req.body?.remarks || "");
    res.json({
      success: true,
      payment_status:
        row.payment_status === "not_required"
          ? "not_required"
          : "awaiting_update",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Approval failed" });
  }
});

router.post("/requests/:id/reject", async (req, res) => {
  const id = Number(req.params.id);
  const user = req.user!;
  try {
    const row = await actionable(user, id);
    if (!row)
      return res.status(403).json({ error: "Request is not assigned to you" });
    await pool
      .request()
      .input("rid", mssql.Int, id)
      .input("actor", mssql.Int, user.id)
      .input("note", mssql.NVarChar(1000), req.body?.remarks || null).query(`
        UPDATE requests SET status='rejected',workflow_status='rejected',updated_at=GETDATE() WHERE id=@rid;
        UPDATE request_assignments SET can_act=0 WHERE request_id=@rid;
        INSERT INTO approvals(request_id,actor_id,action,note) VALUES(@rid,@actor,'rejected',@note)`);
    await notify({
      userId: row.user_id,
      message: `${row.ref_id} was rejected.`,
      kind: "request_status",
      actionUrl: "/employee",
    });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Rejection failed" });
  }
});

router.post("/requests/:id/info", async (req, res) => {
  const id = Number(req.params.id);
  const user = req.user!;
  try {
    const row = await actionable(user, id);
    if (!row)
      return res.status(403).json({ error: "Request is not assigned to you" });
    await pool
      .request()
      .input("rid", mssql.Int, id)
      .input("actor", mssql.Int, user.id)
      .input(
        "note",
        mssql.NVarChar(1000),
        req.body?.remarks || "More information required",
      ).query(`
        UPDATE requests SET status='info_requested',updated_at=GETDATE() WHERE id=@rid;
        INSERT INTO approvals(request_id,actor_id,action,note) VALUES(@rid,@actor,'info_requested',@note)`);
    await notify({
      userId: row.user_id,
      message: `${row.ref_id} needs more information.`,
      kind: "request_status",
      actionUrl: "/employee",
    });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Action failed" });
  }
});

router.post("/requests/:id/queue", async (req, res) => {
  const id = Number(req.params.id);
  const user = req.user!;
  try {
    const row = await actionable(user, id);
    if (!row)
      return res.status(403).json({ error: "Request is not assigned to you" });
    await pool
      .request()
      .input("rid", mssql.Int, id)
      .input("actor", mssql.Int, user.id)
      .input(
        "note",
        mssql.NVarChar(1000),
        req.body?.remarks || "Escalated to Super Admin",
      ).query(`
        UPDATE request_assignments SET can_act=0 WHERE request_id=@rid AND can_act=1;
        INSERT INTO request_assignments(request_id,role,assignment_type,can_act) VALUES(@rid,'super_admin','owner',1);
        UPDATE requests SET status='queued',updated_at=GETDATE() WHERE id=@rid;
        INSERT INTO approvals(request_id,actor_id,action,note) VALUES(@rid,@actor,'queued',@note)`);
    await notifyRole(
      "super_admin",
      null,
      `${row.ref_id} was escalated for approval.`,
      "approval",
      "/super-admin",
    );
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Escalation failed" });
  }
});

export default router;
