import { Router } from "express";
import mssql from "mssql";
import { pool } from "../db";
import { authorize } from "../services/policy";
import { notify } from "../services/notifications";

const router = Router();
router.get("/", async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const size = Math.min(100, Math.max(10, Number(req.query.page_size) || 25));
  const status = String(req.query.status || "all");
  const user = req.user!;
  try {
    const result = await pool
      .request()
      .input("status", mssql.NVarChar(30), status)
      .input("role", mssql.NVarChar(30), user.role)
      .input("cc", mssql.NVarChar(10), user.center_code || null)
      .input("uid", mssql.Int, user.id)
      .input("offset", mssql.Int, (page - 1) * size)
      .input("size", mssql.Int, size)
      .query(`SELECT p.*,r.ref_id,r.type,r.subject,
        r.charge_center_code,r.approval_center_code,u.name employee_name,COUNT(*) OVER() total
        FROM payments p JOIN requests r ON r.id=p.request_id JOIN users u ON u.id=r.user_id
        WHERE (@status='all' OR p.status=@status) AND
          (@role='super_admin' OR EXISTS(SELECT 1 FROM approval_policies ap WHERE ap.is_active=1 AND ap.can_view=1
            AND ap.role=@role AND (ap.user_id IS NULL OR ap.user_id=@uid)
            AND (ap.center_code IS NULL OR ap.center_code=r.approval_center_code)
            AND (ap.category IS NULL OR ap.category=r.type)))
          AND (@role NOT IN('center_admin','hq_admin','admin') OR @cc IS NULL OR r.approval_center_code=@cc)
        ORDER BY CASE WHEN p.status='awaiting_update' THEN 0 WHEN p.status='awaiting_verification' THEN 1 ELSE 2 END,p.due_at
        OFFSET @offset ROWS FETCH NEXT @size ROWS ONLY`);
    res.json({
      data: result.recordset,
      page,
      page_size: size,
      total: Number(result.recordset[0]?.total || 0),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Payments unavailable" });
  }
});

router.post("/:requestId/update", async (req, res) => {
  const id = Number(req.params.requestId);
  const user = req.user!;
  const b = req.body ?? {};
  if (!Number.isFinite(Number(b.actual_amount)) || Number(b.actual_amount) < 0)
    return res.status(400).json({ error: "Valid actual_amount is required" });
  try {
    const lookup = await pool
      .request()
      .input("id", mssql.Int, id)
      .query(`SELECT type,approval_center_code FROM requests WHERE id=@id`);
    const row = lookup.recordset[0];
    if (!row) return res.status(404).json({ error: "Request not found" });
    if (
      ["center_admin", "hq_admin", "admin"].includes(user.role) &&
      user.center_code &&
      user.center_code !== row.approval_center_code
    )
      return res
        .status(403)
        .json({ error: "Request belongs to another handling center" });
    const access = await authorize(
      user,
      "can_update_payment",
      row.type,
      row.approval_center_code,
    );
    if (!access.allowed)
      return res.status(403).json({ error: "Payment update not permitted" });
    await pool
      .request()
      .input("rid", mssql.Int, id)
      .input("amount", mssql.Decimal(14, 2), Number(b.actual_amount))
      .input("vendor", mssql.NVarChar(200), b.vendor_name || null)
      .input("invoice", mssql.NVarChar(100), b.invoice_number || null)
      .input("url", mssql.NVarChar(1000), b.invoice_url || null)
      .input("method", mssql.NVarChar(30), b.payment_method || null)
      .input("ref", mssql.NVarChar(150), b.transaction_ref || null)
      .input("notes", mssql.NVarChar(1000), b.notes || null)
      .input("actor", mssql.Int, user.id)
      .query(`UPDATE payments SET actual_amount=@amount,vendor_name=@vendor,
        invoice_number=@invoice,invoice_url=@url,payment_method=@method,transaction_ref=@ref,notes=@notes,
        status='awaiting_verification',updated_by=@actor,updated_at=SYSUTCDATETIME() WHERE request_id=@rid AND status='awaiting_update';
        UPDATE requests SET actual_amount=@amount,payment_status='awaiting_verification',updated_at=GETDATE() WHERE id=@rid;
        INSERT INTO approvals(request_id,actor_id,action,note) VALUES(@rid,@actor,'payment_updated',@notes)`);
    const finance = await pool
      .request()
      .query(
        `SELECT id FROM users WHERE is_active=1 AND role IN('finance','finance_head')`,
      );
    await Promise.all(
      finance.recordset.map((u) =>
        notify({
          userId: u.id,
          message: `Payment for request #${id} requires verification.`,
          kind: "payment_verification",
          actionUrl: `/finance?request=${id}`,
        }),
      ),
    );
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Payment update failed" });
  }
});

router.post("/:requestId/verify", async (req, res) => {
  const id = Number(req.params.requestId);
  const user = req.user!;
  try {
    const lookup = await pool
      .request()
      .input("id", mssql.Int, id)
      .query(
        `SELECT type,approval_center_code,actual_amount FROM requests WHERE id=@id`,
      );
    const row = lookup.recordset[0];
    if (!row) return res.status(404).json({ error: "Request not found" });
    const access = await authorize(
      user,
      "can_verify_payment",
      row.type,
      row.approval_center_code,
      row.actual_amount,
    );
    if (!access.allowed)
      return res
        .status(403)
        .json({
          error: "Verification limit or permission exceeded",
          limit: access.policy?.max_amount,
        });
    await pool
      .request()
      .input("rid", mssql.Int, id)
      .input("actor", mssql.Int, user.id).query(`
      DECLARE @estimated DECIMAL(14,2),@actual DECIMAL(14,2),@cc NVARCHAR(10);
      SELECT @estimated=p.estimated_amount,@actual=p.actual_amount,@cc=r.charge_center_code
        FROM payments p WITH(UPDLOCK,ROWLOCK) JOIN requests r ON r.id=p.request_id
        WHERE p.request_id=@rid AND p.status='awaiting_verification';
      IF @actual IS NULL THROW 50001,'Payment is not awaiting verification',1;
      UPDATE payments SET status='paid',verified_by=@actor,verified_at=SYSUTCDATETIME(),
        paid_at=COALESCE(paid_at,SYSUTCDATETIME()),updated_at=SYSUTCDATETIME() WHERE request_id=@rid;
      UPDATE requests SET payment_status='paid',workflow_status='completed',updated_at=GETDATE() WHERE id=@rid;
      UPDATE center_budgets SET committed=CASE WHEN committed>=ISNULL(@estimated,0) THEN committed-ISNULL(@estimated,0) ELSE 0 END,
        spent=spent+@actual,updated_at=GETDATE() WHERE center_code=@cc AND month=MONTH(GETDATE()) AND year=YEAR(GETDATE());
      INSERT INTO approvals(request_id,actor_id,action,note) VALUES(@rid,@actor,'payment_verified','Payment verified and closed')`);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Verification failed" });
  }
});

router.get("/analytics/summary", async (req, res) => {
  try {
    const access = await authorize(req.user!, "can_view_analytics");
    if (!access.allowed)
      return res.status(403).json({ error: "Analytics permission required" });
    res.json(
      (
        await pool.request()
          .query(`SELECT r.charge_center_code center_code,r.type,
    COUNT(*) request_count,SUM(COALESCE(p.actual_amount,p.estimated_amount,0)) total_spend,
    SUM(CASE WHEN p.status='paid' THEN 1 ELSE 0 END) paid_count,
    SUM(CASE WHEN p.status<>'paid' THEN 1 ELSE 0 END) pending_count
    FROM payments p JOIN requests r ON r.id=p.request_id GROUP BY r.charge_center_code,r.type`)
      ).recordset,
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Analytics unavailable" });
  }
});
export default router;
