import { Router } from 'express';
import mssql from 'mssql';
import { pool } from '../db';

const router = Router();
router.get('/', async (req, res) => {
  const company = typeof req.query.company === 'string' ? req.query.company : 'all';
  const status = typeof req.query.status === 'string' ? req.query.status : 'all';
  const center = typeof req.query.center_code === 'string' ? req.query.center_code : 'all';
  try {
    const result = await pool.request().input('company', mssql.NVarChar(100), company).input('status', mssql.NVarChar(30), status)
      .input('center', mssql.NVarChar(10), center)
      .input('uid', mssql.Int, req.user!.id).input('role', mssql.NVarChar(30), req.user!.role).query(`
      SELECT TOP 500 r.id,r.ref_id,r.user_id,r.company,r.team,r.type,r.subject,r.description,r.amount,r.priority,r.status,r.details,r.created_at,r.updated_at,
        r.home_center_code,r.request_center_code,r.approval_center_code,r.charge_center_code,r.inventory_center_code,r.workflow_status,r.payment_status,
        u.name employeeName,u.dept employeeDept
      FROM requests r JOIN users u ON u.id=r.user_id
      WHERE (@company='all' OR r.company=@company) AND (@status='all' OR r.status=@status)
        AND (@center='all' OR r.approval_center_code=@center)
        AND (@role<>'employee' OR r.user_id=@uid)
      ORDER BY r.updated_at DESC`);
    res.json(result.recordset);
  } catch (error) { console.error(error); res.status(500).json({ error: 'Query failed' }); }
});
export default router;
