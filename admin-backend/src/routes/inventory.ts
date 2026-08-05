import { Router } from 'express';
import mssql from 'mssql';
import { pool } from '../db';
import { requireAuth } from '../auth';

const router = Router();
const categories = new Set(['Writing', 'Paper', 'Printing', 'Filing', 'Desk', 'Misc']);

router.get('/', async (_req, res) => {
  try { res.json((await pool.request().query('SELECT sku,name,category,unit,price,qty,threshold,updated_at FROM inventory ORDER BY category,name')).recordset); }
  catch (error) { console.error(error); res.status(500).json({ error: 'Inventory query failed' }); }
});

router.get('/movements', async (req, res) => {
  try { res.json((await pool.request().input('sku', mssql.NVarChar(30), req.query.sku || null).query(`
    SELECT TOP 200 m.id,m.sku,i.name,i.category,m.direction,m.qty,m.balance_after,m.source,m.ref_id,m.actor,m.note,m.created_at
    FROM stock_movements m JOIN inventory i ON i.sku=m.sku WHERE @sku IS NULL OR m.sku=@sku ORDER BY m.created_at DESC`)).recordset); }
  catch (error) { console.error(error); res.status(500).json({ error: 'Movement query failed' }); }
});

router.post('/', requireAuth('hq_admin', 'admin', 'super_admin'), async (req, res) => {
  const { sku, name, category, unit, price, qty, threshold = 10 } = req.body ?? {};
  if (![sku, name, category, unit].every(v => typeof v === 'string') || !categories.has(category) || !Number.isFinite(price) || !Number.isInteger(qty) || qty < 0) return res.status(400).json({ error: 'Invalid inventory item' });
  const tx = pool.transaction();
  try {
    await tx.begin(); const dbSku = sku.trim().toUpperCase();
    await tx.request().input('sku', mssql.NVarChar(30), dbSku).input('name', mssql.NVarChar(200), name.trim()).input('category', mssql.NVarChar(20), category).input('unit', mssql.NVarChar(50), unit.trim()).input('price', mssql.Decimal(10, 2), price).input('qty', mssql.Int, qty).input('threshold', mssql.Int, threshold).query('INSERT INTO inventory(sku,name,category,unit,price,qty,threshold) VALUES(@sku,@name,@category,@unit,@price,@qty,@threshold)');
    if (qty) await tx.request().input('sku', mssql.NVarChar(30), dbSku).input('qty', mssql.Int, qty).input('actor', mssql.NVarChar(120), req.user!.name).query("INSERT INTO stock_movements(sku,direction,qty,balance_after,source,actor,note) VALUES(@sku,'in',@qty,@qty,'add_item',@actor,'New SKU added')");
    await tx.commit(); res.status(201).json({ sku: dbSku });
  } catch (error) { await tx.rollback(); console.error(error); res.status(500).json({ error: 'Inventory creation failed' }); }
});

router.patch('/:sku', requireAuth('hq_admin', 'admin', 'super_admin'), async (req, res) => {
  const { qty, note = 'Manual stock edit' } = req.body ?? {};
  if (!Number.isInteger(qty) || qty < 0) return res.status(400).json({ error: 'qty must be a non-negative integer' });
  const tx = pool.transaction();
  try {
    await tx.begin(); const current = await tx.request().input('sku', mssql.NVarChar(30), req.params.sku).query('SELECT qty FROM inventory WITH (UPDLOCK, ROWLOCK) WHERE sku=@sku');
    if (!current.recordset[0]) { await tx.rollback(); return res.status(404).json({ error: 'SKU not found' }); }
    const oldQty = current.recordset[0].qty; const delta = qty - oldQty;
    await tx.request().input('sku', mssql.NVarChar(30), req.params.sku).input('qty', mssql.Int, qty).query('UPDATE inventory SET qty=@qty,updated_at=GETDATE() WHERE sku=@sku');
    if (delta) await tx.request().input('sku', mssql.NVarChar(30), req.params.sku).input('dir', mssql.NVarChar(3), delta > 0 ? 'in' : 'out').input('delta', mssql.Int, Math.abs(delta)).input('qty', mssql.Int, qty).input('actor', mssql.NVarChar(120), req.user!.name).input('note', mssql.NVarChar(500), note).query("INSERT INTO stock_movements(sku,direction,qty,balance_after,source,actor,note) VALUES(@sku,@dir,@delta,@qty,'adjustment',@actor,@note)");
    await tx.commit(); res.json({ sku: req.params.sku, qty });
  } catch (error) { await tx.rollback(); console.error(error); res.status(500).json({ error: 'Inventory update failed' }); }
});

export default router;
