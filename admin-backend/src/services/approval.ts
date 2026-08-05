import mssql from "mssql";
import { pool } from "../db";
import { notify } from "./notifications";

async function issueInventory(
  tx: mssql.Transaction,
  request: any,
  actorId: number,
) {
  if (request.type !== "stationery" || !request.details) return;
  const items = (JSON.parse(request.details).items || []) as Array<{
    sku: string;
    qty: number;
  }>;
  for (const item of items) {
    const stock = await tx
      .request()
      .input("cc", mssql.NVarChar(10), request.inventory_center_code)
      .input("sku", mssql.NVarChar(30), item.sku)
      .query(`SELECT qty FROM center_inventory WITH(UPDLOCK,ROWLOCK)
        WHERE center_code=@cc AND sku=@sku`);
    if (!stock.recordset[0] || stock.recordset[0].qty < item.qty)
      throw new Error(
        `Insufficient ${item.sku} stock at ${request.inventory_center_code}`,
      );
    const balance = stock.recordset[0].qty - item.qty;
    await tx
      .request()
      .input("cc", mssql.NVarChar(10), request.inventory_center_code)
      .input("sku", mssql.NVarChar(30), item.sku)
      .input("qty", mssql.Int, item.qty)
      .input("balance", mssql.Int, balance)
      .input("ref", mssql.NVarChar(20), request.ref_id)
      .input("actor", mssql.NVarChar(120), `User #${actorId}`)
      .query(`UPDATE center_inventory
        SET qty=@balance,updated_at=SYSUTCDATETIME() WHERE center_code=@cc AND sku=@sku;
        INSERT INTO stock_movements(sku,direction,qty,balance_after,source,ref_id,actor,note,center_code)
        VALUES(@sku,'out',@qty,@balance,'request',@ref,@actor,'Issued on approval',@cc)`);
  }
}

export async function completeApproval(
  requestId: number,
  actorId: number,
  note = "",
) {
  const minutes = Math.max(
    5,
    Number(process.env.PAYMENT_REMINDER_MINUTES) || 240,
  );
  const due = new Date(Date.now() + minutes * 60_000);
  const tx = pool.transaction();
  await tx.begin();
  let request: any;
  try {
    const row = await tx.request().input("id", mssql.Int, requestId)
      .query(`SELECT user_id,ref_id,type,amount,
      payment_status,details,inventory_center_code,charge_center_code FROM requests WITH(UPDLOCK,ROWLOCK)
      WHERE id=@id AND workflow_status='awaiting_approval'`);
    request = row.recordset[0];
    if (!request) throw new Error("Request already actioned or not found");
    await issueInventory(tx, request, actorId);
    await tx
      .request()
      .input("id", mssql.Int, requestId)
      .input("due", mssql.DateTime2, due).query(`UPDATE requests SET
      status='approved',workflow_status='approved',payment_status=CASE WHEN payment_status='not_required' THEN payment_status ELSE 'awaiting_update' END,
      payment_due_at=CASE WHEN payment_status='not_required' THEN NULL ELSE @due END,updated_at=GETDATE() WHERE id=@id`);
    if (request.payment_status !== "not_required") {
      await tx
        .request()
        .input("rid", mssql.Int, requestId)
        .input("amount", mssql.Decimal(14, 2), request.amount || null)
        .input("due", mssql.DateTime2, due)
        .input("actor", mssql.Int, actorId).query(`INSERT INTO payments
          (request_id,estimated_amount,status,due_at,updated_by) VALUES(@rid,@amount,'awaiting_update',@due,@actor)`);
      if (request.amount)
        await tx
          .request()
          .input("cc", mssql.NVarChar(10), request.charge_center_code)
          .input("amount", mssql.Decimal(14, 2), request.amount)
          .query(`UPDATE center_budgets
          SET committed=committed+@amount,updated_at=GETDATE() WHERE center_code=@cc AND month=MONTH(GETDATE()) AND year=YEAR(GETDATE())`);
    }
    await tx
      .request()
      .input("rid", mssql.Int, requestId)
      .input("actor", mssql.Int, actorId)
      .input("note", mssql.NVarChar(1000), note || null)
      .query(`UPDATE request_assignments SET can_act=0 WHERE request_id=@rid AND can_act=1;
        INSERT INTO approvals(request_id,actor_id,action,note) VALUES(@rid,@actor,'approved',@note)`);
    await tx.commit();
  } catch (error) {
    await tx.rollback();
    throw error;
  }
  await notify({
    userId: request.user_id,
    message: `${request.ref_id} has been approved.`,
    kind: "request_status",
    actionUrl: "/employee",
  });
}
