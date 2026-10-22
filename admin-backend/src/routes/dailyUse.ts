import { Router, type Request } from 'express';
import mssql from 'mssql';
import { pool } from '../db';
import { hasStaffPermission } from '../auth';
import { resolveCenterScope } from '../services/centerScope';

/**
 * Daily-use consumables register (housekeeping etc.).
 * Vouchers: opening, purchase (GRN), issue, return, adjust_in/adjust_out. Valued at weighted-average cost.
 */
const router = Router();
router.use((req, res, next) => hasStaffPermission(req.user!, 'daily_use') ? next()
  : res.status(403).json({ error: 'Daily-use inventory access has not been granted' }));

export const DAILY_CATEGORIES = ['Cleaning', 'Washroom', 'Pantry', 'Kitchen', 'Electrical', 'Office consumables', 'Other'];
export const ADJUST_REASONS = {
  adjust_in: ['Found extra', 'Count correction', 'Other'],
  adjust_out: ['Damaged', 'Expired', 'Lost / theft', 'Count correction', 'Other'],
};
const PAYMENT_MODES = ['Cash', 'UPI', 'Bank transfer', 'Card', 'Cheque', 'Company account'];
const MOVEMENT_TYPES = ['purchase', 'issue', 'return', 'adjust_in', 'adjust_out'] as const;
type MovementType = (typeof MOVEMENT_TYPES)[number] | 'opening';
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
/** Business date of a movement in India time. */
const LOCAL_DATE = "CONVERT(DATE,SWITCHOFFSET(CONVERT(DATETIMEOFFSET,m.created_at),'+05:30'))";
const SIGNED_QTY = "CASE WHEN m.direction IN('issue','adjust_out') THEN -m.qty ELSE m.qty END";
const VOUCHER = `CASE m.direction WHEN 'purchase' THEN 'GRN' WHEN 'issue' THEN 'ISS' WHEN 'return' THEN 'RET'
  WHEN 'opening' THEN 'OPN' ELSE 'ADJ' END+'-'+RIGHT('000000'+CAST(m.id AS VARCHAR(10)),6)`;
const ITEM_CODE = "'HK-'+RIGHT('0000'+CAST(i.id AS VARCHAR(10)),4)";

const text = (value: unknown, max: number) => {
  const result = String(value ?? '').trim();
  return result.length <= max ? result : null;
};
const wholeNumber = (value: unknown) => Number.isInteger(value) && Number(value) >= 0;
const today = () => new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);

function dateRange(req: Request) {
  const to = typeof req.query.to === 'string' && datePattern.test(req.query.to) ? req.query.to : today();
  const fallbackFrom = `${to.slice(0, 8)}01`;
  const from = typeof req.query.from === 'string' && datePattern.test(req.query.from) ? req.query.from : fallbackFrom;
  return from <= to ? { from, to } : { from: to, to: from };
}

async function itemInScope(req: Request, itemId: number) {
  const result = await pool.request().input('id', mssql.Int, itemId)
    .query(`SELECT id,center_code,name FROM daily_items WHERE id=@id`);
  const item = result.recordset[0];
  if (!item) return null;
  return await resolveCenterScope(req.user!, item.center_code) ? item : null;
}

async function centerFor(req: Request, requested: unknown) {
  return resolveCenterScope(req.user!, requested);
}

router.get('/meta', (_req, res) => res.json({ categories: DAILY_CATEGORIES, adjust_reasons: ADJUST_REASONS, payment_modes: PAYMENT_MODES }));

router.get('/items', async (req, res) => {
  try {
    const center = await centerFor(req, req.query.center_code);
    if (!center) return res.status(403).json({ error: 'You do not have access to this center' });
    const monthStart = `${today().slice(0, 8)}01`;
    const result = await pool.request().input('cc', mssql.NVarChar(10), center).input('month', mssql.Date, monthStart).query(`
      SELECT i.id,${ITEM_CODE} item_code,i.center_code,i.name,i.category,i.unit,i.qty,i.threshold,i.is_active,
        i.avg_cost,CAST(i.qty*i.avg_cost AS DECIMAL(14,2)) stock_value,i.updated_at,
        ISNULL(m.month_in,0) month_in,ISNULL(m.month_out,0) month_out,ISNULL(m.month_spend,0) month_spend,m.last_movement_at
      FROM daily_items i
      OUTER APPLY (SELECT
          SUM(CASE WHEN ${LOCAL_DATE}>=@month AND m.direction IN('purchase','opening','return','adjust_in') THEN m.qty END) month_in,
          SUM(CASE WHEN ${LOCAL_DATE}>=@month AND m.direction IN('issue','adjust_out') THEN m.qty END) month_out,
          SUM(CASE WHEN ${LOCAL_DATE}>=@month AND m.direction='purchase' THEN m.amount END) month_spend,
          MAX(m.created_at) last_movement_at
        FROM daily_movements m WHERE m.item_id=i.id) m
      WHERE i.center_code=@cc ORDER BY i.is_active DESC,i.category,i.name;

      SELECT COUNT(*) item_count,
        ISNULL(SUM(CASE WHEN i.qty<=i.threshold THEN 1 ELSE 0 END),0) low_stock,
        ISNULL(SUM(CASE WHEN i.qty=0 THEN 1 ELSE 0 END),0) out_of_stock,
        CAST(ISNULL(SUM(i.qty*i.avg_cost),0) AS DECIMAL(14,2)) stock_value
      FROM daily_items i WHERE i.center_code=@cc AND i.is_active=1;

      SELECT ISNULL(SUM(CASE WHEN m.direction='purchase' THEN m.amount END),0) month_spend,
        ISNULL(SUM(CASE WHEN m.direction='issue' THEN m.qty END),0) month_issued,
        ISNULL(SUM(CASE WHEN m.direction='issue' THEN m.value END),0) month_issued_value,
        ISNULL(SUM(CASE WHEN m.direction='adjust_out' THEN m.value END),0) month_writeoff_value
      FROM daily_movements m WHERE m.center_code=@cc AND ${LOCAL_DATE}>=@month;`);
    const sets = result.recordsets as mssql.IRecordSet<Record<string, unknown>>[];
    res.json({ center_code: center, items: sets[0], summary: { ...sets[1][0], ...sets[2][0] } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Daily-use inventory unavailable' });
  }
});

router.post('/items', async (req, res) => {
  const name = text(req.body?.name, 120);
  const unit = text(req.body?.unit || 'piece', 30);
  const category = DAILY_CATEGORIES.includes(req.body?.category) ? req.body.category : 'Other';
  const threshold = req.body?.threshold ?? 0;
  const openingQty = req.body?.opening_qty ?? 0;
  const openingRate = req.body?.opening_rate ?? 0;
  if (!name || !unit || !wholeNumber(threshold) || !wholeNumber(openingQty) || openingQty > 100000
    || !Number.isFinite(openingRate) || openingRate < 0)
    return res.status(400).json({ error: 'Item name, unit and valid stock levels are required' });
  try {
    const center = await centerFor(req, req.body?.center_code);
    if (!center) return res.status(403).json({ error: 'You do not have access to this center' });
    const result = await pool.request()
      .input('cc', mssql.NVarChar(10), center).input('name', mssql.NVarChar(120), name)
      .input('unit', mssql.NVarChar(30), unit).input('category', mssql.NVarChar(40), category)
      .input('threshold', mssql.Int, threshold).input('actor', mssql.Int, req.user!.id)
      .input('qty', mssql.Int, openingQty).input('rate', mssql.Decimal(14, 4), openingRate)
      .query(`SET XACT_ABORT ON; BEGIN TRANSACTION;
        IF EXISTS(SELECT 1 FROM daily_items WITH(UPDLOCK,HOLDLOCK) WHERE center_code=@cc AND name=@name AND is_active=1)
          THROW 51070,'This item already exists',1;
        DECLARE @ids TABLE(id INT);
        IF EXISTS(SELECT 1 FROM daily_items WHERE center_code=@cc AND name=@name)
          UPDATE daily_items SET is_active=1,unit=@unit,category=@category,threshold=@threshold,updated_at=SYSUTCDATETIME()
            OUTPUT inserted.id INTO @ids WHERE center_code=@cc AND name=@name;
        ELSE INSERT INTO daily_items(center_code,name,unit,category,threshold,created_by)
          OUTPUT inserted.id INTO @ids VALUES(@cc,@name,@unit,@category,@threshold,@actor);
        DECLARE @id INT=(SELECT id FROM @ids);
        IF @qty>0 BEGIN
          DECLARE @current INT,@avg DECIMAL(14,4);
          SELECT @current=qty,@avg=avg_cost FROM daily_items WITH(UPDLOCK,ROWLOCK) WHERE id=@id;
          UPDATE daily_items SET qty=@current+@qty,
            avg_cost=(@current*@avg+@qty*@rate)/(@current+@qty),updated_at=SYSUTCDATETIME() WHERE id=@id;
          INSERT INTO daily_movements(item_id,center_code,direction,qty,balance_after,amount,rate,value,note,actor_id)
            VALUES(@id,@cc,'opening',@qty,@current+@qty,ROUND(@qty*@rate,2),@rate,ROUND(@qty*@rate,2),'Opening stock',@actor);
        END;
        COMMIT TRANSACTION;
        SELECT @id id;`);
    res.status(201).json({ id: result.recordset[0].id });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/already exists|UNIQUE|duplicate/i.test(message)) return res.status(409).json({ error: 'This item already exists' });
    console.error(error);
    res.status(500).json({ error: 'Item could not be added' });
  }
});

router.patch('/items/:id', async (req, res) => {
  const id = Number(req.params.id);
  const has = (key: string) => Object.prototype.hasOwnProperty.call(req.body ?? {}, key);
  const name = has('name') ? text(req.body.name, 120) : null;
  const unit = has('unit') ? text(req.body.unit, 30) : null;
  if (!Number.isInteger(id) || (has('name') && !name) || (has('unit') && !unit)
    || (has('category') && !DAILY_CATEGORIES.includes(req.body.category))
    || (has('threshold') && !wholeNumber(req.body.threshold)) || (has('is_active') && typeof req.body.is_active !== 'boolean'))
    return res.status(400).json({ error: 'Invalid item update' });
  try {
    if (!await itemInScope(req, id)) return res.status(404).json({ error: 'Item not found' });
    await pool.request().input('id', mssql.Int, id)
      .input('name', mssql.NVarChar(120), name).input('unit', mssql.NVarChar(30), unit)
      .input('category', mssql.NVarChar(40), has('category') ? req.body.category : null)
      .input('threshold', mssql.Int, has('threshold') ? req.body.threshold : null)
      .input('active', mssql.Bit, has('is_active') ? req.body.is_active : null)
      .query(`UPDATE daily_items SET name=COALESCE(@name,name),unit=COALESCE(@unit,unit),category=COALESCE(@category,category),
        threshold=COALESCE(@threshold,threshold),is_active=COALESCE(@active,is_active),updated_at=SYSUTCDATETIME()
        WHERE id=@id`);
    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/UNIQUE|duplicate/i.test(message)) return res.status(409).json({ error: 'Another item already has this name' });
    console.error(error);
    res.status(500).json({ error: 'Item could not be updated' });
  }
});

type MovementInput = {
  type: MovementType; qty: number; amount: number | null; vendor: string | null; billNo: string | null;
  billDate: string | null; paymentMode: string | null; handedTo: string | null; department: string | null;
  reason: string | null; note: string | null;
};

/** Posts one voucher atomically: locks the item, checks stock, revalues, writes the ledger line. */
async function postMovement(req: Request, itemId: number, input: MovementInput) {
  const result = await pool.request().input('id', mssql.Int, itemId)
    .input('type', mssql.VarChar(10), input.type).input('qty', mssql.Int, input.qty)
    .input('amount', mssql.Decimal(14, 2), input.amount)
    .input('vendor', mssql.NVarChar(150), input.vendor).input('bill', mssql.NVarChar(60), input.billNo)
    .input('billDate', mssql.Date, input.billDate).input('mode', mssql.NVarChar(20), input.paymentMode)
    .input('handed', mssql.NVarChar(120), input.handedTo).input('dept', mssql.NVarChar(80), input.department)
    .input('reason', mssql.NVarChar(40), input.reason).input('note', mssql.NVarChar(500), input.note)
    .input('actor', mssql.Int, req.user!.id)
    .query(`SET XACT_ABORT ON; BEGIN TRANSACTION;
      DECLARE @current INT,@avg DECIMAL(14,4),@cc NVARCHAR(10);
      SELECT @current=qty,@avg=avg_cost,@cc=center_code FROM daily_items WITH(UPDLOCK,ROWLOCK) WHERE id=@id AND is_active=1;
      IF @current IS NULL THROW 51071,'Item is not active',1;
      DECLARE @sign INT=CASE WHEN @type IN('issue','adjust_out') THEN -1 ELSE 1 END;
      IF @sign<0 AND @current<@qty THROW 51072,'Not enough stock for this entry',1;
      DECLARE @rate DECIMAL(14,4),@value DECIMAL(14,2);
      IF @type='purchase' BEGIN
        SET @rate=@amount/@qty; SET @value=@amount;
        SET @avg=(@current*@avg+@amount)/(@current+@qty);
      END ELSE BEGIN
        SET @rate=@avg; SET @value=ROUND(@qty*@avg,2);
      END;
      UPDATE daily_items SET qty=@current+@sign*@qty,avg_cost=@avg,updated_at=SYSUTCDATETIME() WHERE id=@id;
      DECLARE @ids TABLE(id INT);
      INSERT INTO daily_movements(item_id,center_code,direction,qty,balance_after,amount,rate,value,vendor,bill_no,bill_date,
          payment_mode,handed_to,department,reason,note,actor_id)
        OUTPUT inserted.id INTO @ids
        VALUES(@id,@cc,@type,@qty,@current+@sign*@qty,CASE WHEN @type='purchase' THEN @amount END,@rate,@value,
          @vendor,@bill,@billDate,@mode,@handed,@dept,@reason,@note,@actor);
      COMMIT TRANSACTION;
      SELECT @current+@sign*@qty qty,(SELECT id FROM @ids) movement_id;`);
  return result.recordset[0] as { qty: number; movement_id: number };
}

function readMovement(body: Record<string, unknown>): string | MovementInput {
  const type = body.type as MovementType;
  if (!(MOVEMENT_TYPES as readonly string[]).includes(type)) return 'Select a valid entry type';
  const qty = body.qty;
  if (!Number.isInteger(qty) || Number(qty) < 1 || Number(qty) > 100000) return 'Enter a valid quantity';
  const vendor = text(body.vendor, 150), billNo = text(body.bill_no, 60), handedTo = text(body.handed_to, 120);
  const department = text(body.department, 80), note = text(body.note, 500);
  if ([vendor, billNo, handedTo, department, note].some((value) => value === null)) return 'One or more fields are too long';
  const billDate = typeof body.bill_date === 'string' && body.bill_date ? body.bill_date : null;
  if (billDate && (!datePattern.test(billDate) || billDate > today())) return 'Enter a valid bill date';
  const paymentMode = typeof body.payment_mode === 'string' && body.payment_mode ? body.payment_mode : null;
  if (paymentMode && !PAYMENT_MODES.includes(paymentMode)) return 'Select a valid payment mode';
  let amount: number | null = null;
  if (type === 'purchase') {
    amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount < 0 || amount > 10_000_000) return 'Enter the total amount paid';
  }
  if ((type === 'issue' || type === 'return') && !handedTo)
    return type === 'issue' ? 'Enter who the item was handed over to' : 'Enter who returned the item';
  const reasons = type === 'adjust_in' || type === 'adjust_out' ? ADJUST_REASONS[type] : null;
  const reason = reasons ? String(body.reason || '') : null;
  if (reasons && !reasons.includes(reason!)) return 'Select a reason for the adjustment';
  if (reasons && !note) return 'Add a note explaining the adjustment';
  return { type, qty: Number(qty), amount, vendor: vendor || null, billNo: billNo || null, billDate,
    paymentMode, handedTo: handedTo || null, department: department || null, reason, note: note || null };
}

router.post('/items/:id/movements', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid item' });
  const input = readMovement(req.body ?? {});
  if (typeof input === 'string') return res.status(400).json({ error: input });
  try {
    if (!await itemInScope(req, id)) return res.status(404).json({ error: 'Item not found' });
    res.json({ success: true, ...(await postMovement(req, id, input)) });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/not active|Not enough stock/i.test(message)) return res.status(409).json({ error: message });
    console.error(error);
    res.status(500).json({ error: 'Stock could not be updated' });
  }
});

/** Physical stock count: posts the variance as an adjustment so books match the shelf. */
router.post('/items/:id/count', async (req, res) => {
  const id = Number(req.params.id);
  const physical = req.body?.physical_qty;
  const note = text(req.body?.note, 500);
  if (!Number.isInteger(id) || !wholeNumber(physical) || physical > 100000 || note === null)
    return res.status(400).json({ error: 'Enter the physical quantity counted' });
  try {
    if (!await itemInScope(req, id)) return res.status(404).json({ error: 'Item not found' });
    const current = await pool.request().input('id', mssql.Int, id).query('SELECT qty FROM daily_items WHERE id=@id');
    const variance = physical - Number(current.recordset[0].qty);
    if (!variance) return res.json({ success: true, qty: physical, variance: 0 });
    const result = await postMovement(req, id, { type: variance > 0 ? 'adjust_in' : 'adjust_out', qty: Math.abs(variance),
      amount: null, vendor: null, billNo: null, billDate: null, paymentMode: null, handedTo: null, department: null,
      reason: 'Count correction', note: note || `Physical count ${physical} (book ${physical - variance})` });
    res.json({ success: true, ...result, variance });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/not active|Not enough stock/i.test(message)) return res.status(409).json({ error: message });
    console.error(error);
    res.status(500).json({ error: 'Stock count could not be saved' });
  }
});

/** Stock register (ledger) with filters. */
router.get('/register', async (req, res) => {
  const { from, to } = dateRange(req);
  const itemId = req.query.item_id ? Number(req.query.item_id) : null;
  const type = typeof req.query.type === 'string' && req.query.type !== 'all' ? req.query.type : null;
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
  const limit = Math.min(5000, Math.max(20, Number(req.query.limit) || 500));
  if (itemId !== null && !Number.isInteger(itemId)) return res.status(400).json({ error: 'Invalid item' });
  if (type && !['opening', ...MOVEMENT_TYPES, 'adjust'].includes(type)) return res.status(400).json({ error: 'Invalid entry type' });
  try {
    const center = await centerFor(req, req.query.center_code);
    if (!center) return res.status(403).json({ error: 'You do not have access to this center' });
    const result = await pool.request().input('cc', mssql.NVarChar(10), center).input('item', mssql.Int, itemId)
      .input('from', mssql.Date, from).input('to', mssql.Date, to).input('type', mssql.VarChar(10), type)
      .input('q', mssql.NVarChar(100), q).input('limit', mssql.Int, limit)
      .query(`SELECT TOP (@limit) m.id,${VOUCHER} voucher_no,${LOCAL_DATE} entry_date,m.created_at,m.item_id,
          ${ITEM_CODE} item_code,i.name item_name,i.category,i.unit,m.direction,m.qty,
          CASE WHEN m.direction IN('opening','purchase','return','adjust_in') THEN m.qty ELSE 0 END qty_in,
          CASE WHEN m.direction IN('issue','adjust_out') THEN m.qty ELSE 0 END qty_out,
          m.balance_after,m.rate,m.value,m.amount,m.vendor,m.bill_no,m.bill_date,m.payment_mode,
          m.handed_to,m.department,m.reason,m.note,actor.name actor_name,actor.role actor_role
        FROM daily_movements m JOIN daily_items i ON i.id=m.item_id JOIN users actor ON actor.id=m.actor_id
        WHERE m.center_code=@cc AND ${LOCAL_DATE} BETWEEN @from AND @to
          AND (@item IS NULL OR m.item_id=@item)
          AND (@type IS NULL OR m.direction=@type OR (@type='adjust' AND m.direction IN('adjust_in','adjust_out')))
          AND (@q='' OR i.name LIKE '%'+@q+'%' OR m.handed_to LIKE '%'+@q+'%' OR m.vendor LIKE '%'+@q+'%'
            OR m.bill_no LIKE '%'+@q+'%' OR m.department LIKE '%'+@q+'%' OR m.note LIKE '%'+@q+'%')
        ORDER BY m.created_at DESC,m.id DESC`);
    res.json({ from, to, rows: result.recordset });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Stock register unavailable' });
  }
});

/** Stock summary: opening, inward, outward and closing per item for a period. */
router.get('/summary', async (req, res) => {
  const { from, to } = dateRange(req);
  try {
    const center = await centerFor(req, req.query.center_code);
    if (!center) return res.status(403).json({ error: 'You do not have access to this center' });
    const result = await pool.request().input('cc', mssql.NVarChar(10), center)
      .input('from', mssql.Date, from).input('to', mssql.Date, to)
      .query(`SELECT i.id,${ITEM_CODE} item_code,i.name,i.category,i.unit,i.threshold,i.is_active,i.avg_cost,
          ISNULL(SUM(CASE WHEN ${LOCAL_DATE}<@from THEN ${SIGNED_QTY} END),0) opening_qty,
          ISNULL(SUM(CASE WHEN ${LOCAL_DATE} BETWEEN @from AND @to AND m.direction IN('opening','purchase') THEN m.qty END),0) purchased_qty,
          ISNULL(SUM(CASE WHEN ${LOCAL_DATE} BETWEEN @from AND @to AND m.direction IN('opening','purchase') THEN m.value END),0) purchase_value,
          ISNULL(SUM(CASE WHEN ${LOCAL_DATE} BETWEEN @from AND @to AND m.direction='return' THEN m.qty END),0) returned_qty,
          ISNULL(SUM(CASE WHEN ${LOCAL_DATE} BETWEEN @from AND @to AND m.direction='issue' THEN m.qty END),0) issued_qty,
          ISNULL(SUM(CASE WHEN ${LOCAL_DATE} BETWEEN @from AND @to AND m.direction='issue' THEN m.value END),0) issued_value,
          ISNULL(SUM(CASE WHEN ${LOCAL_DATE} BETWEEN @from AND @to AND m.direction='adjust_in' THEN m.qty END),0) adjusted_in_qty,
          ISNULL(SUM(CASE WHEN ${LOCAL_DATE} BETWEEN @from AND @to AND m.direction='adjust_out' THEN m.qty END),0) adjusted_out_qty,
          ISNULL(SUM(CASE WHEN ${LOCAL_DATE} BETWEEN @from AND @to AND m.direction='adjust_out' THEN m.value END),0) writeoff_value,
          ISNULL(SUM(CASE WHEN ${LOCAL_DATE}<=@to THEN ${SIGNED_QTY} END),0) closing_qty
        FROM daily_items i LEFT JOIN daily_movements m ON m.item_id=i.id
        WHERE i.center_code=@cc
        GROUP BY i.id,i.name,i.category,i.unit,i.threshold,i.is_active,i.avg_cost
        HAVING i.is_active=1 OR COUNT(m.id)>0
        ORDER BY i.category,i.name`);
    const rows = result.recordset.map((row) => ({ ...row,
      inward_qty: row.purchased_qty + row.returned_qty + row.adjusted_in_qty,
      outward_qty: row.issued_qty + row.adjusted_out_qty,
      closing_value: Math.round(row.closing_qty * Number(row.avg_cost) * 100) / 100 }));
    res.json({ from, to, rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Stock summary unavailable' });
  }
});

/** Who consumed what: issues net of returns, per person/department and item. */
router.get('/consumption', async (req, res) => {
  const { from, to } = dateRange(req);
  try {
    const center = await centerFor(req, req.query.center_code);
    if (!center) return res.status(403).json({ error: 'You do not have access to this center' });
    const result = await pool.request().input('cc', mssql.NVarChar(10), center)
      .input('from', mssql.Date, from).input('to', mssql.Date, to)
      .query(`SELECT m.handed_to person,ISNULL(NULLIF(m.department,''),'—') department,i.name item_name,i.unit,
          SUM(CASE WHEN m.direction='issue' THEN m.qty ELSE 0 END) issued_qty,
          SUM(CASE WHEN m.direction='return' THEN m.qty ELSE 0 END) returned_qty,
          SUM(CASE WHEN m.direction='issue' THEN m.qty ELSE -m.qty END) net_qty,
          SUM(CASE WHEN m.direction='issue' THEN m.value ELSE -m.value END) net_value,
          COUNT(*) entries,MAX(m.created_at) last_at
        FROM daily_movements m JOIN daily_items i ON i.id=m.item_id
        WHERE m.center_code=@cc AND m.direction IN('issue','return') AND ${LOCAL_DATE} BETWEEN @from AND @to
        GROUP BY m.handed_to,ISNULL(NULLIF(m.department,''),'—'),i.name,i.unit
        ORDER BY m.handed_to,net_value DESC`);
    res.json({ from, to, rows: result.recordset });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Consumption report unavailable' });
  }
});

export default router;
