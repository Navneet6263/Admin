import { Router } from 'express';
import mssql from 'mssql';
import { requireAuth } from '../auth';
import { pool } from '../db';

const router = Router();

router.get('/head-dashboard', requireAuth('finance_head'), async (_req, res) => {
  try {
    const result = await pool.request().query(`
      SELECT COUNT(*) total_payments,
        SUM(CASE WHEN status='awaiting_update' THEN 1 ELSE 0 END) awaiting_update,
        SUM(CASE WHEN status='awaiting_verification' THEN 1 ELSE 0 END) awaiting_verification,
        SUM(CASE WHEN due_at<GETDATE() AND status<>'paid' THEN 1 ELSE 0 END) overdue,
        ISNULL(SUM(CASE WHEN status<>'paid' THEN COALESCE(actual_amount,estimated_amount,0) ELSE 0 END),0) open_value,
        ISNULL(SUM(CASE WHEN status='paid' AND paid_at>=DATEFROMPARTS(YEAR(GETDATE()),MONTH(GETDATE()),1)
          THEN COALESCE(actual_amount,estimated_amount,0) ELSE 0 END),0) paid_this_month,
        ISNULL(AVG(CASE WHEN verified_at IS NOT NULL THEN DATEDIFF(MINUTE,created_at,verified_at)/60.0 END),0) avg_verify_hrs
      FROM payments;

      SELECT FORMAT(paid_at,'yyyy-MM') month_key,
        ISNULL(SUM(COALESCE(actual_amount,estimated_amount,0)),0) amount,COUNT(*) payment_count
      FROM payments WHERE status='paid' AND paid_at>=DATEADD(MONTH,-5,DATEFROMPARTS(YEAR(GETDATE()),MONTH(GETDATE()),1))
      GROUP BY FORMAT(paid_at,'yyyy-MM') ORDER BY month_key;

      SELECT TOP 8 r.charge_center_code center_code,
        ISNULL(SUM(COALESCE(p.actual_amount,p.estimated_amount,0)),0) amount,COUNT(*) payment_count
      FROM payments p JOIN requests r ON r.id=p.request_id
      GROUP BY r.charge_center_code ORDER BY amount DESC;

      SELECT TOP 20 a.id,a.action,a.note,a.created_at,r.ref_id,r.subject,r.type,
        u.name actor_name,u.role actor_role,p.status payment_status,
        COALESCE(p.actual_amount,p.estimated_amount,0) amount
      FROM approvals a JOIN requests r ON r.id=a.request_id
      JOIN users u ON u.id=a.actor_id LEFT JOIN payments p ON p.request_id=r.id
      WHERE a.action IN('payment_updated','payment_verified')
      ORDER BY a.created_at DESC,a.id DESC;
    `);
    const sets = result.recordsets as mssql.IRecordSet<Record<string, unknown>>[];
    res.json({ metrics: sets[0][0], monthly: sets[1], centers: sets[2], activity: sets[3] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Finance Head dashboard unavailable' });
  }
});

export default router;
