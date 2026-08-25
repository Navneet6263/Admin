import { Router } from 'express';
import mssql from 'mssql';
import { pool } from '../db';
import { requireAuth } from '../auth';
import { INVENTORY_CATEGORIES } from '../migrations/inventoryCatalog';

const router = Router();
const categories = new Set([...INVENTORY_CATEGORIES, 'Printing', 'Desk', 'Misc']);
const managers = requireAuth('center_admin', 'hq_admin', 'super_admin');

router.get('/', async (req, res) => {
  const fields = req.user?.role === 'employee' ? 'sku,name,category,unit' : 'sku,name,category,unit,price,qty,threshold,updated_at';
  try { res.json((await pool.request().query(`SELECT ${fields} FROM inventory WHERE is_active=1 ORDER BY category,name`)).recordset); }
  catch (error) { console.error(error); res.status(500).json({ error: 'Inventory query failed' }); }
});

router.get('/movements', requireAuth('hq_admin', 'center_admin', 'verifier', 'finance', 'finance_head', 'super_admin'), async (req, res) => {
  try { res.json((await pool.request().input('sku', mssql.NVarChar(30), req.query.sku || null).query(`
    SELECT TOP 200 m.id,m.sku,i.name,i.category,m.direction,m.qty,m.balance_after,m.source,m.ref_id,m.actor,m.note,m.created_at
    FROM stock_movements m JOIN inventory i ON i.sku=m.sku WHERE @sku IS NULL OR m.sku=@sku ORDER BY m.created_at DESC`)).recordset); }
  catch (error) { console.error(error); res.status(500).json({ error: 'Movement query failed' }); }
});

router.post('/', managers, async (req, res) => {
  const { sku, name, category, unit, price, qty, threshold = 10 } = req.body ?? {};
  if (![sku, name, category, unit].every(v => typeof v === 'string' && v.trim()) || !categories.has(category) || !Number.isFinite(price) || price < 0 || !Number.isInteger(qty) || qty < 0 || !Number.isInteger(threshold) || threshold < 0) return res.status(400).json({ error: 'Invalid inventory item' });
  const tx = pool.transaction();
  try {
    await tx.begin(); const dbSku = sku.trim().toUpperCase();
    await tx.request().input('sku', mssql.NVarChar(30), dbSku).input('name', mssql.NVarChar(200), name.trim()).input('category', mssql.NVarChar(50), category).input('unit', mssql.NVarChar(50), unit.trim()).input('price', mssql.Decimal(10, 2), price).input('qty', mssql.Int, qty).input('threshold', mssql.Int, threshold).query('INSERT INTO inventory(sku,name,category,unit,price,qty,threshold) VALUES(@sku,@name,@category,@unit,@price,@qty,@threshold)');
    await tx.request().input('sku', mssql.NVarChar(30), dbSku).query(`INSERT INTO center_inventory(center_code,sku,qty,reserved_qty)
      SELECT code,@sku,0,0 FROM centers c WHERE c.is_active=1 AND NOT EXISTS(
        SELECT 1 FROM center_inventory ci WHERE ci.center_code=c.code AND ci.sku=@sku)`);
    if (qty) await tx.request().input('sku', mssql.NVarChar(30), dbSku).input('qty', mssql.Int, qty).input('actor', mssql.NVarChar(120), req.user!.name).query("INSERT INTO stock_movements(sku,direction,qty,balance_after,source,actor,note) VALUES(@sku,'in',@qty,@qty,'add_item',@actor,'New SKU added')");
    await tx.commit(); res.status(201).json({ sku: dbSku });
  } catch (error) { await tx.rollback(); console.error(error); const number = (error as { number?: number }).number;
    res.status(number === 2601 || number === 2627 ? 409 : 500).json({ error: number === 2601 || number === 2627 ? 'SKU or item already exists' : 'Inventory creation failed' }); }
});

router.patch('/:sku', managers, async (req, res) => {
  const { name, category, unit, price, qty, threshold, note = 'Manual inventory edit' } = req.body ?? {};
  const has = (key: string) => Object.prototype.hasOwnProperty.call(req.body ?? {}, key);
  if ((has('name') && (typeof name !== 'string' || !name.trim())) || (has('category') && !categories.has(category))
    || (has('unit') && (typeof unit !== 'string' || !unit.trim())) || (has('price') && (!Number.isFinite(price) || price < 0))
    || (has('qty') && (!Number.isInteger(qty) || qty < 0)) || (has('threshold') && (!Number.isInteger(threshold) || threshold < 0)))
    return res.status(400).json({ error: 'Invalid inventory update' });
  const tx = pool.transaction();
  try {
    await tx.begin(); const current = await tx.request().input('sku', mssql.NVarChar(30), req.params.sku).query('SELECT qty FROM inventory WITH (UPDLOCK, ROWLOCK) WHERE sku=@sku AND is_active=1');
    if (!current.recordset[0]) { await tx.rollback(); return res.status(404).json({ error: 'SKU not found' }); }
    const oldQty = Number(current.recordset[0].qty); const nextQty = has('qty') ? qty : oldQty; const delta = nextQty - oldQty;
    await tx.request().input('sku', mssql.NVarChar(30), req.params.sku)
      .input('name', mssql.NVarChar(200), has('name') ? name.trim() : null).input('category', mssql.NVarChar(50), has('category') ? category : null)
      .input('unit', mssql.NVarChar(50), has('unit') ? unit.trim() : null).input('price', mssql.Decimal(10, 2), has('price') ? price : null)
      .input('qty', mssql.Int, has('qty') ? qty : null).input('threshold', mssql.Int, has('threshold') ? threshold : null)
      .query(`UPDATE inventory SET name=COALESCE(@name,name),category=COALESCE(@category,category),unit=COALESCE(@unit,unit),
        price=COALESCE(@price,price),qty=COALESCE(@qty,qty),threshold=COALESCE(@threshold,threshold),updated_at=GETDATE() WHERE sku=@sku`);
    if (delta) await tx.request().input('sku', mssql.NVarChar(30), req.params.sku).input('dir', mssql.NVarChar(3), delta > 0 ? 'in' : 'out').input('delta', mssql.Int, Math.abs(delta)).input('qty', mssql.Int, nextQty).input('actor', mssql.NVarChar(120), req.user!.name).input('note', mssql.NVarChar(500), note).query("INSERT INTO stock_movements(sku,direction,qty,balance_after,source,actor,note) VALUES(@sku,@dir,@delta,@qty,'adjustment',@actor,@note)");
    await tx.commit(); res.json({ sku: req.params.sku, qty: nextQty });
  } catch (error) { await tx.rollback(); console.error(error); res.status(500).json({ error: 'Inventory update failed' }); }
});

router.delete('/:sku', managers, async (req, res) => {
  try {
    const result = await pool.request().input('sku', mssql.NVarChar(30), req.params.sku)
      .query('UPDATE inventory SET is_active=0,updated_at=GETDATE() OUTPUT inserted.sku WHERE sku=@sku AND is_active=1');
    if (!result.recordset[0]) return res.status(404).json({ error: 'SKU not found' });
    res.json({ sku: result.recordset[0].sku, deleted: true });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Inventory deletion failed' }); }
});

export default router;
