import { Router, type Request } from 'express';
import mssql from 'mssql';
import { pool } from '../db';

/** Expense book: Center/HQ/Super Admin record day-to-day spends against a company for reporting. */
const router = Router();

export const EXPENSE_CATEGORIES = [
  'Travel & Conveyance', 'Hotel & Lodging', 'Food & Refreshments', 'Fuel', 'Repairs & Maintenance',
  'Electricity & Utilities', 'Rent', 'Internet & Phone', 'Courier & Postage', 'Printing & Stationery',
  'Housekeeping', 'Office Supplies', 'Events & Meetings', 'Professional Fees', 'Miscellaneous',
];
export const PAYMENT_MODES = ['Cash', 'UPI', 'Bank transfer', 'Card', 'Cheque', 'Company account'];
const HEAD_OFFICE = 'HQ';
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const isGlobal = (req: Request) => req.user!.role === 'hq_admin' || req.user!.role === 'super_admin';

/** Centers this admin may book against: own + granted for Center Admin, everything for HQ/Super. */
async function accessibleCenters(req: Request): Promise<string[] | null> {
  if (isGlobal(req)) return null;
  const result = await pool.request().input('uid', mssql.Int, req.user!.id)
    .input('cc', mssql.NVarChar(10), req.user!.center_code || null)
    .query(`SELECT @cc code WHERE @cc IS NOT NULL
      UNION SELECT center_code FROM admin_center_access WHERE user_id=@uid AND is_active=1`);
  return result.recordset.map((row) => String(row.code));
}

function scopeSql(centers: string[] | null) {
  if (!centers) return '1=1';
  if (!centers.length) return '1=0';
  return `e.center_code IN(${centers.map((code) => `'${code.replace(/'/g, "''")}'`).join(',')})`;
}

type ExpenseInput = {
  expense_date: string; company: string; center_code: string | null; category: string; description: string;
  paid_to: string | null; amount: number; gst_amount: number; payment_mode: string; reference_no: string | null; notes: string | null;
};

/** Validates a create/update payload; returns an error message or the normalised record. */
async function readExpense(req: Request): Promise<string | ExpenseInput> {
  const body = req.body ?? {};
  const str = (value: unknown, max: number) => {
    const text = String(value ?? '').trim();
    return text.length > max ? undefined : text;
  };
  const expenseDate = String(body.expense_date || '');
  const company = str(body.company, 100);
  const centerRaw = str(body.center_code, 10)?.toUpperCase() || '';
  const category = str(body.category, 60);
  const description = str(body.description, 500);
  const paidTo = str(body.paid_to, 150);
  const reference = str(body.reference_no, 60);
  const notes = str(body.notes, 500);
  const amount = Number(body.amount);
  const gst = body.gst_amount === undefined || body.gst_amount === '' ? 0 : Number(body.gst_amount);
  if (!datePattern.test(expenseDate) || Number.isNaN(Date.parse(expenseDate))) return 'Select a valid expense date';
  if (expenseDate > new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)) return 'Expense date cannot be in the future';
  if (!company) return 'Select the company this expense is for';
  if (!category) return 'Select or type an expense category';
  if (!description) return 'Describe what the money was spent on';
  if (paidTo === undefined || reference === undefined || notes === undefined) return 'One or more fields are too long';
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000_000) return 'Enter a valid amount';
  if (!Number.isFinite(gst) || gst < 0 || gst > amount) return 'GST cannot be negative or more than the amount';
  if (!PAYMENT_MODES.includes(body.payment_mode)) return 'Select a payment mode';
  const centers = await accessibleCenters(req);
  const centerCode = centerRaw && centerRaw !== HEAD_OFFICE ? centerRaw : null;
  if (centers && (!centerCode || !centers.includes(centerCode))) return 'You can only record expenses for your own center';
  const checks = await pool.request().input('company', mssql.NVarChar(100), company)
    .input('cc', mssql.NVarChar(10), centerCode)
    .query(`SELECT (SELECT COUNT(*) FROM companies WHERE name=@company) company_ok,
      CASE WHEN @cc IS NULL THEN 1 ELSE (SELECT COUNT(*) FROM centers WHERE code=@cc) END center_ok`);
  if (!checks.recordset[0].company_ok) return 'Select a valid company from the company master';
  if (!checks.recordset[0].center_ok) return 'Select a valid center';
  return { expense_date: expenseDate, company, center_code: centerCode, category, description,
    paid_to: paidTo || null, amount: Math.round(amount * 100) / 100, gst_amount: Math.round(gst * 100) / 100,
    payment_mode: body.payment_mode, reference_no: reference || null, notes: notes || null };
}

function bindExpense(request: mssql.Request, expense: ExpenseInput) {
  return request.input('date', mssql.Date, expense.expense_date)
    .input('company', mssql.NVarChar(100), expense.company)
    .input('cc', mssql.NVarChar(10), expense.center_code)
    .input('category', mssql.NVarChar(60), expense.category)
    .input('description', mssql.NVarChar(500), expense.description)
    .input('paid_to', mssql.NVarChar(150), expense.paid_to)
    .input('amount', mssql.Decimal(14, 2), expense.amount)
    .input('gst', mssql.Decimal(14, 2), expense.gst_amount)
    .input('mode', mssql.NVarChar(20), expense.payment_mode)
    .input('ref', mssql.NVarChar(60), expense.reference_no)
    .input('notes', mssql.NVarChar(500), expense.notes);
}

async function expenseInScope(req: Request, id: number) {
  const centers = await accessibleCenters(req);
  const result = await pool.request().input('id', mssql.Int, id)
    .query(`SELECT e.id FROM expenses e WHERE e.id=@id AND e.is_deleted=0 AND ${scopeSql(centers)}`);
  return Boolean(result.recordset[0]);
}

router.get('/meta', async (req, res) => {
  try {
    const centers = await accessibleCenters(req);
    const result = await pool.request().query(`
      SELECT code,name FROM companies ORDER BY name;
      SELECT code,name,city,company FROM centers WHERE is_active=1 ORDER BY name;
      SELECT DISTINCT category FROM expenses WHERE is_deleted=0 ORDER BY category;`);
    const sets = result.recordsets as mssql.IRecordSet<Record<string, unknown>>[];
    const used = sets[2].map((row) => String(row.category));
    res.json({
      companies: sets[0],
      centers: centers ? sets[1].filter((row) => centers.includes(String(row.code))) : sets[1],
      allow_head_office: !centers,
      categories: [...new Set([...EXPENSE_CATEGORIES, ...used])],
      payment_modes: PAYMENT_MODES,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Expense options unavailable' });
  }
});

router.get('/', async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(5000, Math.max(10, Number(req.query.page_size) || 25));
  const from = typeof req.query.from === 'string' && datePattern.test(req.query.from) ? req.query.from : null;
  const to = typeof req.query.to === 'string' && datePattern.test(req.query.to) ? req.query.to : null;
  const company = typeof req.query.company === 'string' && req.query.company !== 'all' ? req.query.company : null;
  const category = typeof req.query.category === 'string' && req.query.category !== 'all' ? req.query.category : null;
  const mode = typeof req.query.payment_mode === 'string' && req.query.payment_mode !== 'all' ? req.query.payment_mode : null;
  const center = typeof req.query.center_code === 'string' && req.query.center_code !== 'all'
    ? req.query.center_code.trim().toUpperCase() : null;
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
  try {
    const centers = await accessibleCenters(req);
    const where = `e.is_deleted=0 AND ${scopeSql(centers)}
      AND (@from IS NULL OR e.expense_date>=@from) AND (@to IS NULL OR e.expense_date<=@to)
      AND (@company IS NULL OR e.company=@company) AND (@category IS NULL OR e.category=@category)
      AND (@mode IS NULL OR e.payment_mode=@mode)
      AND (@center IS NULL OR (@center='${HEAD_OFFICE}' AND e.center_code IS NULL) OR e.center_code=@center)
      AND (@q='' OR e.description LIKE '%'+@q+'%' OR e.paid_to LIKE '%'+@q+'%' OR e.reference_no LIKE '%'+@q+'%'
        OR e.category LIKE '%'+@q+'%' OR e.notes LIKE '%'+@q+'%')`;
    const result = await pool.request()
      .input('from', mssql.Date, from).input('to', mssql.Date, to)
      .input('company', mssql.NVarChar(100), company).input('category', mssql.NVarChar(60), category)
      .input('mode', mssql.NVarChar(20), mode).input('center', mssql.NVarChar(10), center)
      .input('q', mssql.NVarChar(100), q)
      .input('offset', mssql.Int, (page - 1) * pageSize).input('limit', mssql.Int, pageSize)
      .query(`
        SELECT e.id,e.expense_date,e.company,e.center_code,ISNULL(c.name,'Head Office') center_name,e.category,
          e.description,e.paid_to,e.amount,e.gst_amount,e.amount-e.gst_amount net_amount,e.payment_mode,e.reference_no,
          e.notes,e.created_at,e.updated_at,creator.name created_by_name,creator.role created_by_role,
          editor.name updated_by_name,COUNT_BIG(*) OVER() total_count
        FROM expenses e LEFT JOIN centers c ON c.code=e.center_code
        JOIN users creator ON creator.id=e.created_by LEFT JOIN users editor ON editor.id=e.updated_by
        WHERE ${where}
        ORDER BY e.expense_date DESC,e.id DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;

        SELECT COUNT(*) entries,ISNULL(SUM(e.amount),0) total,ISNULL(SUM(e.gst_amount),0) gst,
          ISNULL(AVG(e.amount),0) average,ISNULL(MAX(e.amount),0) largest
        FROM expenses e WHERE ${where};
        SELECT e.company label,COUNT(*) entries,SUM(e.amount) total FROM expenses e WHERE ${where}
          GROUP BY e.company ORDER BY total DESC;
        SELECT e.category label,COUNT(*) entries,SUM(e.amount) total FROM expenses e WHERE ${where}
          GROUP BY e.category ORDER BY total DESC;
        SELECT ISNULL(e.center_code,'${HEAD_OFFICE}') code,ISNULL(c.name,'Head Office') label,COUNT(*) entries,SUM(e.amount) total
          FROM expenses e LEFT JOIN centers c ON c.code=e.center_code WHERE ${where}
          GROUP BY e.center_code,c.name ORDER BY total DESC;
        SELECT CONVERT(CHAR(7),e.expense_date,126) label,COUNT(*) entries,SUM(e.amount) total
          FROM expenses e WHERE ${where} GROUP BY CONVERT(CHAR(7),e.expense_date,126) ORDER BY label;
        SELECT e.payment_mode label,COUNT(*) entries,SUM(e.amount) total FROM expenses e WHERE ${where}
          GROUP BY e.payment_mode ORDER BY total DESC;`);
    const sets = result.recordsets as mssql.IRecordSet<Record<string, unknown>>[];
    res.json({ data: sets[0], page, page_size: pageSize, total: Number(sets[0][0]?.total_count || 0),
      summary: { ...sets[1][0], by_company: sets[2], by_category: sets[3], by_center: sets[4], by_month: sets[5], by_mode: sets[6] } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Expenses unavailable' });
  }
});

router.post('/', async (req, res) => {
  try {
    const expense = await readExpense(req);
    if (typeof expense === 'string') return res.status(400).json({ error: expense });
    const result = await bindExpense(pool.request(), expense).input('actor', mssql.Int, req.user!.id)
      .query(`INSERT INTO expenses(expense_date,company,center_code,category,description,paid_to,amount,gst_amount,
          payment_mode,reference_no,notes,created_by)
        OUTPUT inserted.id
        VALUES(@date,@company,@cc,@category,@description,@paid_to,@amount,@gst,@mode,@ref,@notes,@actor)`);
    res.status(201).json({ id: result.recordset[0].id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Expense could not be saved' });
  }
});

router.patch('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid expense' });
  try {
    if (!await expenseInScope(req, id)) return res.status(404).json({ error: 'Expense not found' });
    const expense = await readExpense(req);
    if (typeof expense === 'string') return res.status(400).json({ error: expense });
    await bindExpense(pool.request(), expense).input('id', mssql.Int, id).input('actor', mssql.Int, req.user!.id)
      .query(`UPDATE expenses SET expense_date=@date,company=@company,center_code=@cc,category=@category,
        description=@description,paid_to=@paid_to,amount=@amount,gst_amount=@gst,payment_mode=@mode,
        reference_no=@ref,notes=@notes,updated_by=@actor,updated_at=SYSUTCDATETIME()
        WHERE id=@id AND is_deleted=0`);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Expense could not be updated' });
  }
});

/** Soft delete keeps the audit trail; a reason is mandatory. */
router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const reason = String(req.body?.reason || '').trim();
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid expense' });
  if (!reason || reason.length > 300) return res.status(400).json({ error: 'A reason is required to delete an expense' });
  try {
    if (!await expenseInScope(req, id)) return res.status(404).json({ error: 'Expense not found' });
    await pool.request().input('id', mssql.Int, id).input('actor', mssql.Int, req.user!.id)
      .input('reason', mssql.NVarChar(300), reason)
      .query(`UPDATE expenses SET is_deleted=1,deleted_by=@actor,deleted_at=SYSUTCDATETIME(),delete_reason=@reason
        WHERE id=@id AND is_deleted=0`);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Expense could not be deleted' });
  }
});

export default router;
