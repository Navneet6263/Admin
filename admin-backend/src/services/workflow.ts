import mssql from "mssql";
import { pool } from "../db";
import { notifyRole } from "./notifications";

const paymentCategories = new Set([
  "stationery", "travel", "courier", "fooding",
  "meeting_room", "visiting_card", "id_card",
]);

export type WorkflowNotification = {
  ref: string;
  homeCenter: string;
  requestCenter: string;
  category: string;
};

/** Every request is offered to all three authorised admin levels in parallel. */
export async function notifyWorkflowCreated(input: WorkflowNotification) {
  const message = `${input.ref} requires approval.`;
  await Promise.all([
    notifyRole("center_admin", input.requestCenter, message, "approval", "/center-admin"),
    notifyRole("hq_admin", null, message, "approval", "/admin"),
    notifyRole("super_admin", null, message, "approval", "/super-admin"),
  ]);
}

/** Backward-compatible initializer for older request creation callers. */
export async function initializeWorkflow(
  requestId: number,
  userId: number,
  requestedCenter: string | undefined,
  category: string,
  _amount: number | null,
) {
  const userResult = await pool.request().input("uid", mssql.Int, userId)
    .query(`SELECT center_code FROM users WHERE id=@uid`);
  const home = userResult.recordset[0]?.center_code as string | null;
  if (!home) throw new Error("Employee has no home center assigned");
  const requested = String(requestedCenter || home).toUpperCase();
  const center = await pool.request().input("cc", mssql.NVarChar(10), requested)
    .query(`SELECT code FROM centers WHERE code=@cc AND is_active=1`);
  if (!center.recordset[0]) throw new Error("Invalid request center");
  const payment = paymentCategories.has(category) ? "pending_approval" : "not_required";
  await pool.request()
    .input("id", mssql.Int, requestId)
    .input("home", mssql.NVarChar(10), home)
    .input("requested", mssql.NVarChar(10), requested)
    .input("payment", mssql.NVarChar(30), payment)
    .query(`SET XACT_ABORT ON; BEGIN TRANSACTION;
      UPDATE requests SET home_center_code=@home,fulfil_center_code=@home,
        request_center_code=@requested,approval_center_code=@requested,charge_center_code=@home,
        inventory_center_code=@home,workflow_status='awaiting_approval',payment_status=@payment WHERE id=@id;
      DELETE FROM request_assignments WHERE request_id=@id;
      INSERT INTO request_assignments(request_id,center_code,role,assignment_type,can_act) VALUES
        (@id,@requested,'center_admin','owner',1),(@id,NULL,'hq_admin','owner',1),
        (@id,NULL,'super_admin','owner',1);
      COMMIT TRANSACTION`);
  const row = await pool.request().input("id", mssql.Int, requestId)
    .query(`SELECT ref_id FROM requests WHERE id=@id`);
  await notifyWorkflowCreated({ ref: row.recordset[0]?.ref_id || `#${requestId}`,
    homeCenter: home, requestCenter: requested, category });
  return { homeCenter: home, requestCenter: requested };
}
