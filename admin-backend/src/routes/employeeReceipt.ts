import { Router } from "express";
import mssql from "mssql";
import { pool } from "../db";
import { notifyRole } from "../services/notifications";

const router = Router();
const feedbackValues = new Set(["very_easy", "easy", "needs_improvement"]);

router.get("/receipts/pending", async (req, res) => {
  try {
    const result = await pool.request().input("uid", mssql.Int, req.user!.id)
      .query(`SELECT TOP 10 r.id,r.ref_id,r.subject,r.type,r.fulfilled_at,u.name fulfilled_by_name
        FROM requests r LEFT JOIN users u ON u.id=r.fulfilled_by
        WHERE r.user_id=@uid AND r.fulfillment_status='assigned'
          AND r.receipt_status='awaiting_confirmation'
        ORDER BY r.fulfilled_at,r.id`);
    res.json(result.recordset);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Pending receipt confirmations are unavailable" });
  }
});

router.post("/requests/:id/receipt", async (req, res) => {
  const id = Number(req.params.id);
  const received = req.body?.received;
  const feedback = String(req.body?.feedback || "").trim();
  const note = String(req.body?.note || "").trim();
  if (!Number.isInteger(id) || typeof received !== "boolean")
    return res.status(400).json({ error: "Valid request and Yes/No selection are required" });
  if (note.length > 1000) return res.status(400).json({ error: "Note must be within 1000 characters" });
  if (!received && note.length < 5)
    return res.status(400).json({ error: "Please explain why the item was not received" });
  if (received && !feedbackValues.has(feedback))
    return res.status(400).json({ error: "Please select an ease rating" });
  if (received && feedback === "needs_improvement" && note.length < 5)
    return res.status(400).json({ error: "Please tell us what should be improved" });

  const tx = pool.transaction();
  let requestRow: { ref_id: string; subject: string } | undefined;
  try {
    await tx.begin();
    const result = await tx.request().input("id", mssql.Int, id)
      .input("uid", mssql.Int, req.user!.id)
      .query(`SELECT ref_id,subject FROM requests WITH(UPDLOCK,ROWLOCK)
        WHERE id=@id AND user_id=@uid AND fulfillment_status='assigned'
          AND receipt_status='awaiting_confirmation'`);
    requestRow = result.recordset[0];
    if (!requestRow) throw new Error("Receipt was already confirmed or is not available");
    const action = received ? "receipt_confirmed" : "receipt_disputed";
    const auditNote = received
      ? `Employee confirmed receipt · ${feedback.replace(/_/g, " ")}${note ? ` · ${note}` : ""}`
      : `Employee reported item not received · ${note}`;
    await tx.request().input("id", mssql.Int, id).input("uid", mssql.Int, req.user!.id)
      .input("status", mssql.NVarChar(30), received ? "received" : "disputed")
      .input("feedback", mssql.NVarChar(30), received ? feedback : null)
      .input("note", mssql.NVarChar(1000), note || null)
      .input("action", mssql.NVarChar(30), action)
      .input("auditNote", mssql.NVarChar(1000), auditNote)
      .query(`UPDATE requests SET receipt_status=@status,receipt_feedback=@feedback,
          receipt_note=@note,receipt_confirmed_at=SYSUTCDATETIME(),updated_at=GETDATE() WHERE id=@id;
        INSERT INTO approvals(request_id,actor_id,action,note) VALUES(@id,@uid,@action,@auditNote)`);
    await tx.commit();
  } catch (error) {
    try { await tx.rollback(); } catch { /* transaction already closed */ }
    const message = error instanceof Error ? error.message : "Receipt confirmation failed";
    return res.status(/already confirmed|not available/i.test(message) ? 409 : 500).json({ error: message });
  }

  if (!received && requestRow) {
    const alert = `${requestRow.ref_id}: employee says the approved item was not received. Note: ${note}`;
    const results = await Promise.allSettled([
      notifyRole("hq_admin", null, alert, "delivery_dispute", `/admin?request=${id}`),
      notifyRole("super_admin", null, alert, "delivery_dispute", `/super-admin?request=${id}`),
    ]);
    results.filter((item) => item.status === "rejected")
      .forEach((item) => console.error("Delivery dispute notification failed:", item.reason));
  }
  res.json({ success: true, receipt_status: received ? "received" : "disputed" });
});

export default router;
