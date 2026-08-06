import mssql from "mssql";
import { pool } from "../db";
import { notify, notifyRole } from "./notifications";

const paymentCategories = new Set([
  "stationery",
  "travel",
  "courier",
  "fooding",
  "meeting_room",
  "visiting_card",
  "id_card",
]);

async function approvalRole(category: string, center: string, amount: number) {
  const result = await pool
    .request()
    .input("category", mssql.NVarChar(30), category)
    .input("center", mssql.NVarChar(10), center)
    .input("amount", mssql.Decimal(14, 2), amount)
    .query(`SELECT TOP 1 role,user_id FROM approval_policies WHERE is_active=1 AND can_approve=1
      AND (category=@category OR category IS NULL) AND (center_code=@center OR center_code IS NULL)
      AND (max_amount IS NULL OR max_amount>=@amount)
      AND (user_id IS NULL OR EXISTS(SELECT 1 FROM users WHERE id=approval_policies.user_id AND is_active=1))
      ORDER BY CASE role WHEN 'center_admin' THEN 1 WHEN 'hq_admin' THEN 2 WHEN 'super_admin' THEN 3 ELSE 9 END,
        CASE WHEN user_id IS NOT NULL THEN 0 ELSE 1 END,
        CASE WHEN center_code=@center THEN 1 ELSE 2 END`);
  return {
    role: String(result.recordset[0]?.role || "super_admin"),
    userId: result.recordset[0]?.user_id as number | null,
  };
}

export async function initializeWorkflow(
  requestId: number,
  userId: number,
  requestedCenter: string | undefined,
  category: string,
  amount: number | null,
) {
  const userResult = await pool
    .request()
    .input("uid", mssql.Int, userId)
    .query(`SELECT center_code FROM users WHERE id=@uid`);
  const home = userResult.recordset[0]?.center_code as string | null;
  if (!home) throw new Error("Employee has no home center assigned");
  const requested = String(requestedCenter || home).toUpperCase();
  const center = await pool
    .request()
    .input("cc", mssql.NVarChar(10), requested)
    .query(`SELECT code FROM centers WHERE code=@cc AND is_active=1`);
  if (!center.recordset[0]) throw new Error("Invalid request center");
  const owner = category === "visiting_card"
    ? { role: "center_admin", userId: null }
    : await approvalRole(category, requested, Number(amount || 0));
  const paymentRequired = paymentCategories.has(category);
  await pool
    .request()
    .input("id", mssql.Int, requestId)
    .input("home", mssql.NVarChar(10), home)
    .input("requested", mssql.NVarChar(10), requested)
    .input(
      "payment",
      mssql.NVarChar(30),
      paymentRequired ? "pending_approval" : "not_required",
    )
    .query(`UPDATE requests SET home_center_code=@home,fulfil_center_code=@home,
      request_center_code=@requested,approval_center_code=@requested,charge_center_code=@home,
      inventory_center_code=@home,workflow_status='awaiting_approval',payment_status=@payment WHERE id=@id`);
  await pool
    .request()
    .input("rid", mssql.Int, requestId)
    .input("home", mssql.NVarChar(10), home)
    .input("requested", mssql.NVarChar(10), requested)
    .input("role", mssql.NVarChar(30), owner.role)
    .input("owner", mssql.Int, owner.userId || null)
    .query(`INSERT INTO request_assignments(request_id,center_code,role,user_id,assignment_type,can_act) VALUES
      (@rid,@requested,@role,@owner,'owner',1);
      IF @home<>@requested INSERT INTO request_assignments(request_id,center_code,role,assignment_type,can_act)
        VALUES(@rid,@home,'center_admin','watcher',0)`);
  const request = await pool
    .request()
    .input("id", mssql.Int, requestId)
    .query(`SELECT ref_id FROM requests WHERE id=@id`);
  const ref = request.recordset[0]?.ref_id || `#${requestId}`;
  const actionUrl = owner.role === "center_admin" ? "/center-admin" : owner.role === "hq_admin" ? "/admin" : "/super-admin";
  if (owner.userId)
    await notify({
      userId: owner.userId,
      message: `${ref} requires your approval.`,
      kind: "approval",
      actionUrl,
    });
  else
    await notifyRole(
      owner.role,
      owner.role === "super_admin" ? null : requested,
      `${ref} requires your approval.`,
      "approval",
      actionUrl,
    );
  if (home !== requested)
    await notifyRole(
      "center_admin",
      home,
      `${ref} was raised at ${requested}; expense will charge your center.`,
      "watching",
      "/center-admin",
    );
  if (category === "visiting_card") {
    await Promise.all([
      notifyRole("hq_admin", null, `${ref} has a print-ready visiting card PDF for review.`, "approval_watch", "/admin"),
      notifyRole("super_admin", null, `${ref} has a print-ready visiting card PDF for oversight.`, "approval_watch", "/super-admin"),
    ]);
  }
  return {
    homeCenter: home,
    requestCenter: requested,
    approvalRole: owner.role,
  };
}
