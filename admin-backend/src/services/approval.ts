import mssql from "mssql";
import { pool } from "../db";
import { notify, notifyRole } from "./notifications";

const assignableTypes = new Set(["stationery", "id_card", "visiting_card"]);

async function issueInventory(tx: mssql.Transaction, request: any, actorId: number) {
  if (request.type !== "stationery" || !request.details) return;
  const items = (JSON.parse(request.details).items || []) as Array<{ sku: string; qty: number }>;
  for (const item of items) {
    const stock = await tx.request()
      .input("cc", mssql.NVarChar(10), request.inventory_center_code)
      .input("sku", mssql.NVarChar(30), item.sku)
      .query(`SELECT qty FROM center_inventory WITH(UPDLOCK,ROWLOCK)
        WHERE center_code=@cc AND sku=@sku`);
    if (!stock.recordset[0] || Number(stock.recordset[0].qty) < item.qty)
      throw new Error(`Insufficient ${item.sku} stock at ${request.inventory_center_code}`);
    const balance = Number(stock.recordset[0].qty) - item.qty;
    await tx.request()
      .input("cc", mssql.NVarChar(10), request.inventory_center_code)
      .input("sku", mssql.NVarChar(30), item.sku)
      .input("qty", mssql.Int, item.qty)
      .input("balance", mssql.Int, balance)
      .input("ref", mssql.NVarChar(20), request.ref_id)
      .input("actor", mssql.NVarChar(120), `User #${actorId}`)
      .query(`UPDATE center_inventory SET qty=@balance,updated_at=SYSUTCDATETIME()
          WHERE center_code=@cc AND sku=@sku;
        INSERT INTO stock_movements(sku,direction,qty,balance_after,source,ref_id,actor,note,center_code)
          VALUES(@sku,'out',@qty,@balance,'request',@ref,@actor,'Issued on admin approval',@cc)`);
  }
}

/** First successful Center/HQ/Super approval completes operations immediately. */
export async function completeApproval(requestId: number, actorId: number, note = "") {
  const reminderMinutes = Math.max(5, Number(process.env.PAYMENT_REMINDER_MINUTES) || 240);
  const due = new Date(Date.now() + reminderMinutes * 60_000);
  const tx = pool.transaction();
  await tx.begin();
  let request: any;
  let readyToAssign = false;
  try {
    const result = await tx.request().input("id", mssql.Int, requestId)
      .query(`SELECT user_id,ref_id,type,amount,payment_status,details,inventory_center_code,
        charge_center_code FROM requests WITH(UPDLOCK,ROWLOCK)
        WHERE id=@id AND workflow_status='awaiting_approval'`);
    request = result.recordset[0];
    if (!request) throw new Error("Request already actioned or not found");
    await issueInventory(tx, request, actorId);

    const needsPayment = request.payment_status !== "not_required";
    readyToAssign = assignableTypes.has(request.type);
    const hasAmount = request.amount !== null && request.amount !== undefined;
    const paymentStatus = needsPayment ? (hasAmount ? "awaiting_verification" : "awaiting_update") : "not_required";
    await tx.request()
      .input("id", mssql.Int, requestId)
      .input("actor", mssql.Int, actorId)
      .input("note", mssql.NVarChar(1000), note || null)
      .input("due", mssql.DateTime2, needsPayment ? due : null)
      .input("payment", mssql.NVarChar(30), paymentStatus)
      .input("fulfillment", mssql.NVarChar(30), readyToAssign ? "ready_to_assign" : "not_required")
      .input("actual", mssql.Decimal(14, 2), hasAmount ? request.amount : null)
      .query(`UPDATE requests SET status='approved',workflow_status='completed',
          payment_status=@payment,fulfillment_status=@fulfillment,actual_amount=@actual,
          payment_due_at=@due,updated_at=GETDATE() WHERE id=@id;
        UPDATE request_assignments SET can_act=0 WHERE request_id=@id;
        INSERT INTO approvals(request_id,actor_id,action,note) VALUES(@id,@actor,'approved',@note)`);

    if (needsPayment) {
      await tx.request()
        .input("rid", mssql.Int, requestId)
        .input("amount", mssql.Decimal(14, 2), hasAmount ? request.amount : null)
        .input("status", mssql.NVarChar(30), paymentStatus)
        .input("due", mssql.DateTime2, due)
        .input("actor", mssql.Int, actorId)
        .input("booked", mssql.Bit, hasAmount ? 1 : 0)
        .query(`IF EXISTS(SELECT 1 FROM payments WHERE request_id=@rid)
            THROW 51020,'Payment record already exists for this request',1;
          INSERT INTO payments(request_id,estimated_amount,actual_amount,status,due_at,updated_by,expense_booked)
            VALUES(@rid,@amount,@amount,@status,@due,@actor,@booked)`);
      if (hasAmount) await tx.request()
        .input("cc", mssql.NVarChar(10), request.charge_center_code)
        .input("amount", mssql.Decimal(14, 2), request.amount)
        .query(`IF NOT EXISTS(SELECT 1 FROM center_budgets WHERE center_code=@cc
            AND month=MONTH(GETDATE()) AND year=YEAR(GETDATE()))
          INSERT INTO center_budgets(center_code,month,year,allocated,committed,spent)
            VALUES(@cc,MONTH(GETDATE()),YEAR(GETDATE()),0,0,0);
          UPDATE center_budgets SET spent=spent+@amount,updated_at=GETDATE()
            WHERE center_code=@cc AND month=MONTH(GETDATE()) AND year=YEAR(GETDATE())`);
    }
    await tx.commit();
  } catch (error) {
    try { await tx.rollback(); } catch { /* transaction already closed */ }
    throw error;
  }

  const notices: Promise<unknown>[] = [notify({ userId: request.user_id,
    message: readyToAssign ? `${request.ref_id} was approved and is ready for collection.`
      : `${request.ref_id} was approved and completed.`, kind: "request_status",
    actionUrl: "/employee", dedupeKey: `approval:${requestId}:${actorId}` })];
  if (request.payment_status !== "not_required") notices.push(
    notifyRole("finance", null, `${request.ref_id} is available for expense review.`, "payment_review", `/finance?request=${requestId}`),
    notifyRole("finance_head", null, `${request.ref_id} is available for expense review.`, "payment_review", `/finance?request=${requestId}`),
  );
  await Promise.all(notices);
}
