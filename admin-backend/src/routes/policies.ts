import { Router } from "express";
import mssql from "mssql";
import { pool } from "../db";

const router = Router();
router.get("/", async (_req, res) => {
  try {
    res.json(
      (
        await pool.request()
          .query(`SELECT p.*,u.name user_name,c.name center_name
    FROM approval_policies p LEFT JOIN users u ON u.id=p.user_id LEFT JOIN centers c ON c.code=p.center_code
    ORDER BY p.role,p.center_code,p.category`)
      ).recordset,
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Policies unavailable" });
  }
});

router.post("/", async (req, res) => {
  const b = req.body ?? {};
  if (!b.role) return res.status(400).json({ error: "role is required" });
  try {
    const result = await pool
      .request()
      .input("role", mssql.NVarChar(30), b.role)
      .input("uid", mssql.Int, b.user_id || null)
      .input("cc", mssql.NVarChar(10), b.center_code || null)
      .input("cat", mssql.NVarChar(30), b.category || null)
      .input("max", mssql.Decimal(14, 2), b.max_amount ?? null)
      .input("view", mssql.Bit, b.can_view !== false)
      .input("approve", mssql.Bit, !!b.can_approve)
      .input("update", mssql.Bit, !!b.can_update_payment)
      .input("verify", mssql.Bit, !!b.can_verify_payment)
      .input("analytics", mssql.Bit, !!b.can_view_analytics)
      .input("actor", mssql.Int, req.user!.id).query(`
        INSERT INTO approval_policies(role,user_id,center_code,category,max_amount,can_view,can_approve,
          can_update_payment,can_verify_payment,can_view_analytics,created_by)
        OUTPUT inserted.* VALUES(@role,@uid,@cc,@cat,@max,@view,@approve,@update,@verify,@analytics,@actor)`);
    res.status(201).json(result.recordset[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Policy creation failed" });
  }
});

router.patch("/:id", async (req, res) => {
  const b = req.body ?? {};
  try {
    const result = await pool
      .request()
      .input("id", mssql.Int, req.params.id)
      .input("max", mssql.Decimal(14, 2), b.max_amount ?? null)
      .input("active", mssql.Bit, b.is_active !== false)
      .input("view", mssql.Bit, b.can_view !== false)
      .input("approve", mssql.Bit, !!b.can_approve)
      .input("update", mssql.Bit, !!b.can_update_payment)
      .input("verify", mssql.Bit, !!b.can_verify_payment)
      .input("analytics", mssql.Bit, !!b.can_view_analytics)
      .query(`UPDATE approval_policies SET max_amount=@max,
        can_view=@view,can_approve=@approve,can_update_payment=@update,can_verify_payment=@verify,
        can_view_analytics=@analytics,is_active=@active,updated_at=SYSUTCDATETIME() OUTPUT inserted.* WHERE id=@id`);
    if (!result.recordset[0])
      return res.status(404).json({ error: "Policy not found" });
    res.json(result.recordset[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Policy update failed" });
  }
});
export default router;
