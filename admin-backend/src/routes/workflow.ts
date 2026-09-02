import { Router } from "express";
import mssql from "mssql";
import { effectiveRole, requireAssignedCenter } from "../auth";
import { pool } from "../db";
import { completeApproval } from "../services/approval";
import { notify, notifyRole } from "../services/notifications";
import { readWorkflowQueue } from "../services/workflowQueue";
import { markAssigned, resolveDeliveryIssue } from "../services/fulfillment";

const router = Router();
router.use(requireAssignedCenter);
router.get("/queue", async (req, res) => {
  try {
    res.json(await readWorkflowQueue(req.user!, req.query));
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
    .query(`SELECT TOP 1 r.* FROM requests r
      WHERE r.id=@rid AND r.workflow_status='awaiting_approval' AND
      (@role='super_admin' OR EXISTS(SELECT 1 FROM request_assignments a
        WHERE a.request_id=r.id AND a.is_active=1 AND a.can_act=1 AND a.role=@role
        AND (a.user_id IS NULL OR a.user_id=@uid) AND (@role='hq_admin' OR a.center_code=@cc OR EXISTS(
          SELECT 1 FROM admin_center_access aca WHERE aca.user_id=@uid
            AND aca.center_code=a.center_code AND aca.is_active=1))))`);
  return result.recordset[0];
}

router.post("/requests/:id/approve", async (req, res) => {
  const id = Number(req.params.id);
  const user = req.user!;
  try {
    const row = await actionable(user, id);
    if (!row)
      return res.status(403).json({ error: "Request is not assigned to you" });
    await completeApproval(id, user.id, req.body?.remarks || "");
    res.json({
      success: true,
      status: "approved",
      workflow_status: "completed",
    });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Approval failed";
    res.status(/already actioned|Insufficient/i.test(message) ? 409 : 500).json({ error: message });
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
        SET XACT_ABORT ON; BEGIN TRANSACTION;
        UPDATE requests SET status='rejected',workflow_status='rejected',updated_at=GETDATE()
          WHERE id=@rid AND workflow_status='awaiting_approval';
        IF @@ROWCOUNT=0 THROW 51030,'Request was already actioned',1;
        UPDATE request_assignments SET can_act=0 WHERE request_id=@rid;
        INSERT INTO approvals(request_id,actor_id,action,note) VALUES(@rid,@actor,'rejected',@note);
        COMMIT TRANSACTION`);
    await notify({
      userId: row.user_id,
      message: `${row.ref_id} was rejected.`,
      kind: "request_status",
      actionUrl: "/employee",
    });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(error instanceof Error && error.message.includes("already actioned") ? 409 : 500)
      .json({ error: error instanceof Error ? error.message : "Rejection failed" });
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
        SET XACT_ABORT ON; BEGIN TRANSACTION;
        UPDATE requests SET status='info_requested',updated_at=GETDATE()
          WHERE id=@rid AND workflow_status='awaiting_approval' AND status<>'info_requested';
        IF @@ROWCOUNT=0 THROW 51031,'Information was already requested',1;
        INSERT INTO approvals(request_id,actor_id,action,note) VALUES(@rid,@actor,'info_requested',@note);
        COMMIT TRANSACTION`);
    await notify({
      userId: row.user_id,
      message: `${row.ref_id} needs more information.`,
      kind: "request_status",
      actionUrl: "/employee",
    });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(error instanceof Error && error.message.includes("already requested") ? 409 : 500)
      .json({ error: error instanceof Error ? error.message : "Action failed" });
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
        SET XACT_ABORT ON; BEGIN TRANSACTION;
        UPDATE requests SET status='queued',updated_at=GETDATE()
          WHERE id=@rid AND workflow_status='awaiting_approval' AND status<>'queued';
        IF @@ROWCOUNT=0 THROW 51032,'Request was already queued',1;
        UPDATE request_assignments SET can_act=CASE WHEN role='super_admin' THEN 1 ELSE 0 END
          WHERE request_id=@rid AND role IN('center_admin','hq_admin','super_admin');
        IF NOT EXISTS(SELECT 1 FROM request_assignments WHERE request_id=@rid
          AND role='super_admin' AND assignment_type='owner')
          INSERT INTO request_assignments(request_id,role,assignment_type,can_act)
            VALUES(@rid,'super_admin','owner',1);
        INSERT INTO approvals(request_id,actor_id,action,note) VALUES(@rid,@actor,'queued',@note);
        COMMIT TRANSACTION`);
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
    res.status(error instanceof Error && error.message.includes("already queued") ? 409 : 500)
      .json({ error: error instanceof Error ? error.message : "Escalation failed" });
  }
});

router.post("/requests/:id/assign", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid request ID" });
  try {
    res.json({ success: true, ...(await markAssigned(id, req.user!, req.body?.remarks || "")) });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Assignment failed";
    res.status(/already assigned|not ready/i.test(message) ? 409
      : /do not have access/i.test(message) ? 403 : 500).json({ error: message });
  }
});

router.post("/requests/:id/resolve-delivery", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid request ID" });
  try {
    res.json({ success: true, ...(await resolveDeliveryIssue(id, req.user!, req.body?.remarks || "")) });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Delivery issue resolution failed";
    res.status(/already resolved|not available/i.test(message) ? 409
      : /do not have access/i.test(message) ? 403 : 500).json({ error: message });
  }
});

export default router;
