import { Router } from "express";
import mssql from "mssql";
import { pool, withDbRetry } from "../db";

const router = Router();
const paging = (pageValue: unknown, sizeValue: unknown) => {
  const page = Math.max(1, Number(pageValue) || 1);
  const pageSize = Math.min(100, Math.max(10, Number(sizeValue) || 25));
  return { page, pageSize, offset: (page - 1) * pageSize };
};

router.get("/queue", async (req, res) => {
  const { page, pageSize, offset } = paging(req.query.page, req.query.page_size);
  const view = ["queue", "verified", "sent_back", "all"].includes(String(req.query.view))
    ? String(req.query.view) : "queue";
  const user = req.user!;
  try {
    const result = await withDbRetry(() => pool.request()
      .input("cc", mssql.NVarChar(10), user.center_code || null)
      .input("view", mssql.NVarChar(20), view)
      .input("offset", mssql.Int, offset)
      .input("limit", mssql.Int, pageSize)
      .query(`WITH scoped AS (
        SELECT r.id,r.ref_id,r.user_id,r.company,r.team,r.type,r.subject,r.description,r.amount,
          r.priority,r.status,r.details,r.workflow_status,r.payment_status,r.home_center_code,
          r.request_center_code,r.approval_center_code,r.charge_center_code,r.inventory_center_code,
          r.created_at,r.updated_at,u.name employeeName,u.dept employeeDept,
          CASE WHEN r.workflow_status='awaiting_verification' AND EXISTS(SELECT 1 FROM request_assignments qa
            WHERE qa.request_id=r.id AND qa.role='verifier' AND qa.can_act=1 AND qa.is_active=1
              AND (@cc IS NULL OR qa.center_code=@cc)) THEN 1 ELSE 0 END can_act,
          ISNULL((SELECT a.created_at [at],au.name actor,a.action,a.note
            FROM approvals a JOIN users au ON au.id=a.actor_id WHERE a.request_id=r.id
              AND a.action NOT IN('receipt_confirmed','receipt_disputed')
            ORDER BY a.created_at,a.id FOR JSON PATH),'[]') audit
        FROM requests r JOIN users u ON u.id=r.user_id
        WHERE EXISTS(SELECT 1 FROM request_assignments va WHERE va.request_id=r.id AND va.role='verifier'
          AND (@cc IS NULL OR va.center_code=@cc))
          AND (@view='all'
            OR (@view='queue' AND r.workflow_status='awaiting_verification')
            OR (@view='verified' AND EXISTS(SELECT 1 FROM approvals x WHERE x.request_id=r.id AND x.action='verified'))
            OR (@view='sent_back' AND EXISTS(SELECT 1 FROM approvals x WHERE x.request_id=r.id AND x.action='sent_back')))
      ) SELECT *,COUNT(*) OVER() total_count FROM scoped
        ORDER BY CASE WHEN workflow_status='awaiting_verification' THEN 0 ELSE 1 END,updated_at DESC,id DESC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;

      WITH history AS (SELECT r.id,r.workflow_status,
        CASE WHEN verified.request_id IS NULL THEN 0 ELSE 1 END was_verified,
        CASE WHEN returned.request_id IS NULL THEN 0 ELSE 1 END was_sent_back
        FROM requests r
        OUTER APPLY(SELECT TOP 1 request_id FROM approvals WHERE request_id=r.id AND action='verified') verified
        OUTER APPLY(SELECT TOP 1 request_id FROM approvals WHERE request_id=r.id AND action='sent_back') returned
        WHERE EXISTS(SELECT 1 FROM request_assignments va
          WHERE va.request_id=r.id AND va.role='verifier' AND (@cc IS NULL OR va.center_code=@cc)))
      SELECT ISNULL(SUM(CASE WHEN workflow_status='awaiting_verification' THEN 1 ELSE 0 END),0) queue,
        ISNULL(SUM(was_verified),0) verified,ISNULL(SUM(was_sent_back),0) sent_back,COUNT(*) [all] FROM history`));
    const sets = result.recordsets as mssql.IRecordSet<Record<string, unknown>>[];
    res.json({ data: sets[0], page, page_size: pageSize,
      total: Number(sets[0][0]?.total_count || 0), summary: sets[1][0] || {} });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Verification queue unavailable" });
  }
});

router.post(["/requests/:id/verify", "/requests/:id/send-back"], (_req, res) =>
  res.status(410).json({ error: "Verifier actions are retired; admin approval now completes requests" }));

export default router;
