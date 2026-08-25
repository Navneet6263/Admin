import { Router } from 'express';
import mssql from 'mssql';
import { pool } from '../db';
import { resolveCenterScope } from '../services/centerScope';

const router = Router();

router.get('/overview', async (req, res) => {
  try {
    const center = await resolveCenterScope(req.user!, req.query.center_code);
    if (!center) return res.status(403).json({ error: 'You do not have access to this center' });
    const result = await pool.request().input('cc', mssql.NVarChar(10), center).query(`
      SELECT c.code,c.name,c.city,c.company,
        ISNULL(cb.allocated,0) allocated,ISNULL(cb.committed,0) committed,ISNULL(cb.spent,0) spent
      FROM centers c LEFT JOIN center_budgets cb ON cb.center_code=c.code
        AND cb.month=MONTH(GETDATE()) AND cb.year=YEAR(GETDATE())
      WHERE c.code=@cc AND c.is_active=1;

      SELECT COUNT(*) total,
        SUM(CASE WHEN workflow_status='awaiting_approval' THEN 1 ELSE 0 END) awaiting_approval,
        SUM(CASE WHEN workflow_status='awaiting_approval' AND priority='urgent' THEN 1 ELSE 0 END) urgent_open,
        SUM(CASE WHEN status='approved' AND updated_at>=DATEADD(DAY,-30,GETDATE()) THEN 1 ELSE 0 END) approved_30d,
        SUM(CASE WHEN workflow_status='rejected' AND updated_at>=DATEADD(DAY,-30,GETDATE()) THEN 1 ELSE 0 END) rejected_30d,
        ISNULL(AVG(CASE WHEN workflow_status<>'awaiting_approval'
          THEN DATEDIFF(MINUTE,created_at,updated_at)/60.0 END),0) avg_response_hrs
      FROM requests WHERE approval_center_code=@cc
        OR (approval_center_code IS NULL AND home_center_code=@cc);

      SELECT COUNT(*) sku_count,
        SUM(CASE WHEN ci.qty-ci.reserved_qty<=i.threshold THEN 1 ELSE 0 END) low_stock,
        ISNULL(SUM(ci.qty*i.price),0) stock_value,ISNULL(SUM(ci.reserved_qty),0) reserved_units
      FROM center_inventory ci JOIN inventory i ON i.sku=ci.sku
      WHERE ci.center_code=@cc AND i.is_active=1;

      SELECT COUNT(*) active_users FROM users WHERE center_code=@cc AND is_active=1;
    `);
    const sets = result.recordsets as mssql.IRecordSet<Record<string, unknown>>[];
    if (!sets[0]?.[0]) return res.status(404).json({ error: 'Center not found' });
    res.json({ center: sets[0][0], requests: sets[1][0], inventory: sets[2][0], people: sets[3][0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Center overview unavailable' });
  }
});

router.get('/activity', async (req, res) => {
  const limit = Math.min(50, Math.max(5, Number(req.query.limit) || 20));
  try {
    const center = await resolveCenterScope(req.user!, req.query.center_code);
    if (!center) return res.status(403).json({ error: 'You do not have access to this center' });
    const result = await pool.request()
      .input('cc', mssql.NVarChar(10), center).input('limit', mssql.Int, limit).query(`
        SELECT TOP (@limit) a.id,a.action,a.note,a.created_at,r.ref_id,r.subject,r.type,
          actor.name actor_name,actor.role actor_role
        FROM approvals a JOIN requests r ON r.id=a.request_id
        JOIN users actor ON actor.id=a.actor_id
        WHERE a.action NOT IN('receipt_confirmed','receipt_disputed')
          AND (r.approval_center_code=@cc OR (r.approval_center_code IS NULL AND r.home_center_code=@cc))
        ORDER BY a.created_at DESC,a.id DESC`);
    res.json(result.recordset);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Center activity unavailable' });
  }
});

router.get('/inventory-view', async (req, res) => {
  try {
    const center = await resolveCenterScope(req.user!, req.query.center_code);
    if (!center) return res.status(403).json({ error: 'You do not have access to this center' });
    const result = await pool.request().input('cc', mssql.NVarChar(10), center).query(`
      SELECT i.sku,i.name,i.category,i.unit,i.price,ci.qty,ci.reserved_qty,
        ci.qty-ci.reserved_qty available_qty,i.threshold,ci.updated_at
      FROM center_inventory ci JOIN inventory i ON i.sku=ci.sku
      WHERE ci.center_code=@cc AND i.is_active=1 ORDER BY i.category,i.name`);
    res.json(result.recordset);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Center inventory unavailable' });
  }
});

export default router;
