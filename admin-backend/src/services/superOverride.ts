import mssql from "mssql";
import { pool } from "../db";
import { completeApproval } from "./approval";
import { notify } from "./notifications";

const allowed = ["pending", "queued", "approved", "rejected", "info_requested"];

export async function applySuperOverride(requestId: number, actorId: number, next: string, note = "") {
  if (!allowed.includes(next)) throw new Error("Invalid next_status");
  const lookup = await pool.request().input("id", mssql.Int, requestId)
    .query("SELECT user_id,ref_id,workflow_status FROM requests WHERE id=@id");
  const request = lookup.recordset[0];
  if (!request) throw new Error("Request not found");

  if (next === "approved") {
    if (request.workflow_status === "awaiting_approval") {
      await completeApproval(requestId, actorId, note);
      return "approved";
    }
    throw new Error("Request is not at an approvable workflow stage");
  }
  if (["approved", "completed"].includes(request.workflow_status))
    throw new Error("Completed finance workflow cannot be overridden");

  const action = next === "pending" ? "sent_back" : next === "queued" ? "queued"
    : next === "rejected" ? "rejected" : "info_requested";
  const workflow = next === "rejected" ? "rejected" : "awaiting_approval";
  const tx = pool.transaction();
  await tx.begin();
  try {
    await tx.request()
      .input("id", mssql.Int, requestId).input("status", mssql.NVarChar(30), next)
      .input("workflow", mssql.NVarChar(30), workflow)
      .query(`UPDATE requests SET status=@status,workflow_status=@workflow,updated_at=GETDATE() WHERE id=@id;
        UPDATE request_assignments SET can_act=0 WHERE request_id=@id;
        IF @status IN('queued','pending','info_requested')
          UPDATE request_assignments SET is_active=1,can_act=1
            WHERE request_id=@id AND role IN('center_admin','hq_admin','super_admin')`);
    await tx.request().input("rid", mssql.Int, requestId).input("actor", mssql.Int, actorId)
      .input("action", mssql.NVarChar(30), action)
      .input("note", mssql.NVarChar(1000), note || `Super Admin workflow action: ${next}`)
      .query("INSERT INTO approvals(request_id,actor_id,action,note) VALUES(@rid,@actor,@action,@note)");
    await tx.commit();
  } catch (error) {
    try { await tx.rollback(); } catch { /* transaction already closed */ }
    throw error;
  }
  await notify({ userId: request.user_id,
    message: `${request.ref_id} was updated to ${next.replace(/_/g, " ")} by Super Admin.`,
    kind: "request_status", actionUrl: "/employee",
    dedupeKey: `super-override:${requestId}:${actorId}:${next}:${Date.now()}` });
  return next;
}
