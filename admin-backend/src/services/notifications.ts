import mssql from "mssql";
import { createHash } from "node:crypto";
import { pool, withDbRetry } from "../db";

export interface NoticeInput {
  userId: number;
  message: string;
  kind?: string;
  actionUrl?: string;
  dueAt?: Date | null;
  dedupeKey?: string;
}

export async function notify(input: NoticeInput) {
  const dedupeKey = input.dedupeKey || createHash("sha256")
    .update(`${input.kind || "general"}|${input.userId}|${input.message}`).digest("hex");
  await withDbRetry(() => pool
    .request()
    .input("uid", mssql.Int, input.userId)
    .input("message", mssql.NVarChar(500), input.message)
    .input("kind", mssql.NVarChar(30), input.kind || "general")
    .input("url", mssql.NVarChar(300), input.actionUrl || null)
    .input("due", mssql.DateTime2, input.dueAt || null)
    .input("key", mssql.NVarChar(150), dedupeKey)
    .query(`IF @key IS NULL OR NOT EXISTS(SELECT 1 FROM notifications WHERE dedupe_key=@key)
      INSERT INTO notifications(user_id,message,kind,action_url,due_at,dedupe_key)
      VALUES(@uid,@message,@kind,@url,@due,@key)`));
}

export async function notifyRole(
  role: string,
  center: string | null,
  message: string,
  kind: string,
  actionUrl: string,
) {
  const prefix = createHash("sha256").update(`${role}|${center || "all"}|${kind}|${message}`).digest("hex").slice(0, 64);
  await withDbRetry(() => pool
    .request()
    .input("role", mssql.NVarChar(30), role)
    .input("center", mssql.NVarChar(10), center)
    .input("message", mssql.NVarChar(500), message)
    .input("kind", mssql.NVarChar(30), kind)
    .input("url", mssql.NVarChar(300), actionUrl)
    .input("prefix", mssql.NVarChar(64), prefix)
    .query(
      `INSERT INTO notifications(user_id,message,kind,action_url,dedupe_key)
       SELECT u.id,@message,@kind,@url,CONCAT(@prefix,':',u.id) FROM users u
       WHERE u.is_active=1 AND u.role=@role AND (@center IS NULL OR u.center_code=@center)
       AND NOT EXISTS(SELECT 1 FROM notifications n WHERE n.dedupe_key=CONCAT(@prefix,':',u.id))`,
    ));
}

export async function createPaymentReminders() {
  const due = await withDbRetry(() => pool.request()
    .query(`SELECT p.id,p.request_id,r.ref_id,r.approval_center_code
    FROM payments p JOIN requests r ON r.id=p.request_id
    WHERE p.status='awaiting_update' AND p.due_at<=SYSUTCDATETIME()`));
  for (const row of due.recordset) {
    const admins = await withDbRetry(() => pool
      .request()
      .input("cc", mssql.NVarChar(10), row.approval_center_code)
      .query(`SELECT id FROM users WHERE is_active=1 AND role IN('center_admin','hq_admin','super_admin')
        AND (role='super_admin' OR center_code=@cc)`));
    await Promise.all(
      admins.recordset.map((u) =>
        notify({
          userId: u.id,
          kind: "payment_reminder",
      actionUrl: `/finance?request=${row.request_id}`,
          message: `Payment details for ${row.ref_id} are overdue. Please update the final amount.`,
          dedupeKey: `payment:${row.id}:${u.id}`,
        }),
      ),
    );
  }
}
