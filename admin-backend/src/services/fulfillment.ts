import mssql from "mssql";
import { type AuthUser } from "../auth";
import { pool } from "../db";
import { notify } from "./notifications";

export async function markAssigned(requestId: number, actor: AuthUser, note = "") {
  const tx = pool.transaction();
  await tx.begin();
  let row: any;
  const assignedAt = new Date();
  try {
    const result = await tx.request().input("id", mssql.Int, requestId)
      .query(`SELECT user_id,ref_id,type,approval_center_code FROM requests WITH(UPDLOCK,ROWLOCK)
        WHERE id=@id AND status='approved' AND fulfillment_status='ready_to_assign'`);
    row = result.recordset[0];
    if (!row) throw new Error("Item was already assigned or is not ready");
    if (actor.role === "center_admin" && actor.center_code !== row.approval_center_code) {
      const access = await tx.request().input("uid", mssql.Int, actor.id)
        .input("cc", mssql.NVarChar(10), row.approval_center_code)
        .query(`SELECT 1 ok FROM admin_center_access
          WHERE user_id=@uid AND center_code=@cc AND is_active=1`);
      if (!access.recordset[0]) throw new Error("You do not have access to this center");
    }
    await tx.request()
      .input("id", mssql.Int, requestId)
      .input("actor", mssql.Int, actor.id)
      .input("note", mssql.NVarChar(1000), note || "Item handed over to employee")
      .input("assignedAt", mssql.DateTime2, assignedAt)
      .query(`UPDATE requests SET fulfillment_status='assigned',receipt_status='awaiting_confirmation',
          receipt_feedback=NULL,receipt_note=NULL,receipt_confirmed_at=NULL,fulfilled_by=@actor,
          fulfilled_at=@assignedAt,updated_at=GETDATE() WHERE id=@id;
        INSERT INTO approvals(request_id,actor_id,action,note) VALUES(@id,@actor,'assigned',@note)`);
    await tx.commit();
  } catch (error) {
    try { await tx.rollback(); } catch { /* transaction already closed */ }
    throw error;
  }
  try {
    await notify({ userId: row.user_id,
      message: `${row.ref_id} was handed over by ${actor.name}.`, kind: "request_status",
      actionUrl: "/employee", dedupeKey: `assigned:${requestId}:${assignedAt.getTime()}` });
  } catch (error) {
    console.error(`Handover ${requestId} saved but notification failed:`, error);
  }
  return { fulfillment_status: "assigned", receipt_status: "awaiting_confirmation", fulfilled_by: actor.id };
}

export async function resolveDeliveryIssue(requestId: number, actor: AuthUser, note = "") {
  const tx = pool.transaction();
  await tx.begin();
  let row: any;
  try {
    const result = await tx.request().input("id", mssql.Int, requestId)
      .query(`SELECT user_id,ref_id,approval_center_code FROM requests WITH(UPDLOCK,ROWLOCK)
        WHERE id=@id AND status='approved' AND fulfillment_status='assigned'
          AND receipt_status='disputed'`);
    row = result.recordset[0];
    if (!row) throw new Error("Delivery issue is already resolved or not available");
    if (actor.role === "center_admin" && actor.center_code !== row.approval_center_code) {
      const access = await tx.request().input("uid", mssql.Int, actor.id)
        .input("cc", mssql.NVarChar(10), row.approval_center_code)
        .query(`SELECT 1 ok FROM admin_center_access
          WHERE user_id=@uid AND center_code=@cc AND is_active=1`);
      if (!access.recordset[0]) throw new Error("You do not have access to this center");
    }
    const auditNote = note || "Delivery issue resolved. Employee asked to confirm receipt again.";
    await tx.request()
      .input("id", mssql.Int, requestId)
      .input("actor", mssql.Int, actor.id)
      .input("note", mssql.NVarChar(1000), auditNote)
      .query(`UPDATE requests SET receipt_status='awaiting_confirmation',
          receipt_feedback=NULL,receipt_note=NULL,receipt_confirmed_at=NULL,
          fulfilled_by=@actor,fulfilled_at=SYSUTCDATETIME(),updated_at=GETDATE()
          WHERE id=@id;
        INSERT INTO approvals(request_id,actor_id,action,note)
          VALUES(@id,@actor,'issue_resolved',@note)`);
    await tx.commit();
  } catch (error) {
    try { await tx.rollback(); } catch { /* transaction already closed */ }
    throw error;
  }
  try {
    await notify({ userId: row.user_id,
      message: `${row.ref_id} delivery issue was resolved. Please confirm receipt again.`,
      kind: "request_status", actionUrl: "/employee",
      dedupeKey: `issue-resolved:${requestId}:${Date.now()}` });
  } catch (error) {
    console.error(`Delivery issue ${requestId} resolved but notification failed:`, error);
  }
  return { receipt_status: "awaiting_confirmation", fulfilled_by: actor.id };
}
