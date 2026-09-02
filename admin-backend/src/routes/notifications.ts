import { Router } from "express";
import mssql from "mssql";
import { pool } from "../db";

const router = Router();
router.get("/", async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const size = Math.min(50, Math.max(10, Number(req.query.page_size) || 20));
  try {
    const result = await pool
      .request()
      .input("uid", mssql.Int, req.user!.id)
      .input("offset", mssql.Int, (page - 1) * size)
      .input("size", mssql.Int, size)
      .query(`SELECT id,message,kind,action_url,due_at,is_read,created_at,COUNT(*) OVER() total
        FROM notifications WHERE user_id=@uid ORDER BY created_at DESC,id DESC OFFSET @offset ROWS FETCH NEXT @size ROWS ONLY;
        SELECT COUNT_BIG(*) unread FROM notifications WHERE user_id=@uid AND is_read=0;`);
    res.json({
      data: result.recordset,
      page,
      page_size: size,
      total: Number(result.recordset[0]?.total || 0),
      unread: Number((result.recordsets as unknown as Array<Array<{ unread: number }>>)[1]?.[0]?.unread || 0),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Notifications unavailable" });
  }
});
router.patch("/:id/read", async (req, res) => {
  await pool
    .request()
    .input("id", mssql.BigInt, req.params.id)
    .input("uid", mssql.Int, req.user!.id)
    .query(
      `UPDATE notifications SET is_read=1,read_at=SYSUTCDATETIME() WHERE id=@id AND user_id=@uid`,
    );
  res.json({ success: true });
});
router.post("/read-all", async (req, res) => {
  await pool
    .request()
    .input("uid", mssql.Int, req.user!.id)
    .query(
      `UPDATE notifications SET is_read=1,read_at=SYSUTCDATETIME() WHERE user_id=@uid AND is_read=0`,
    );
  res.json({ success: true });
});
export default router;
