import { Router, Request, Response } from 'express';
import mssql from 'mssql';
import { pool, getCached, setCache, clearCache } from '../db';
import { requireAuth } from '../auth';

const router = Router();

router.get('/public', async (_req: Request, res: Response) => {
  try {
    const result = await pool.request().query(`SELECT id,code,name,city,company,is_active
      FROM centers WHERE is_active=1 ORDER BY city,name`);
    res.json(result.recordset);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Centers unavailable' }); }
});

// ── GET /api/centers — Fetch all centers with employee counts ────────────────
router.get('/', requireAuth('center_admin', 'hq_admin', 'admin', 'super_admin'), async (_req: Request, res: Response) => {
  const cacheKey = 'centers:all';
  const cached = getCached<unknown[]>(cacheKey);
  if (cached) return res.json(cached);

  try {
    const result = await pool.request().query(`
      SELECT 
        c.id, c.code, c.name, c.city, c.company, c.is_active, c.created_at,
        COUNT(uc.user_id) AS user_count,
        cb.allocated AS budget_allocated,
        cb.spent AS budget_spent
      FROM centers c
      LEFT JOIN user_centers uc ON c.code = uc.home_center_code
      LEFT JOIN center_budgets cb ON c.code = cb.center_code AND cb.month = MONTH(GETDATE()) AND cb.year = YEAR(GETDATE())
      GROUP BY c.id, c.code, c.name, c.city, c.company, c.is_active, c.created_at, cb.allocated, cb.spent
      ORDER BY c.code ASC
    `);
    setCache(cacheKey, result.recordset);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch centers' });
  }
});

// ── POST /api/centers/create — Super Admin creates a new Center ──────────────
router.post('/create', requireAuth('super_admin'), async (req: Request, res: Response) => {
  const { code, name, city, company, initial_budget } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Center name is required' });
  if (!city?.trim()) return res.status(400).json({ error: 'Center city is required' });
  if (!company?.trim()) return res.status(400).json({ error: 'Center company is required' });

  const centerCity = city.trim();
  const centerCompany = company.trim();
  const centerCode = (code?.trim() || name.trim().replace(/\s+/g, '_')).toUpperCase().slice(0, 10);
  const budget = initial_budget === undefined || initial_budget === '' ? 0 : Number(initial_budget);
  if (!/^[A-Z0-9_-]{2,10}$/.test(centerCode)) return res.status(400).json({ error: 'Center code must be 2-10 letters/numbers' });
  if (!Number.isFinite(budget) || budget < 0) return res.status(400).json({ error: 'Initial budget must be non-negative' });

  const tx = pool.transaction();
  try {
    await tx.begin();
    const validCompany = await tx.request().input('company', mssql.NVarChar(100), centerCompany)
      .query(`SELECT 1 ok FROM companies WHERE name=@company`);
    if (!validCompany.recordset.length) {
      await tx.rollback();
      return res.status(400).json({ error: 'Select a valid company from the company master' });
    }
    const result = await tx.request()
      .input('code', mssql.NVarChar(10), centerCode)
      .input('name', mssql.NVarChar(100), name.trim())
      .input('city', mssql.NVarChar(80), centerCity)
      .input('company', mssql.NVarChar(100), centerCompany)
      .query(`
        INSERT INTO centers (code, name, city, company)
        OUTPUT inserted.id, inserted.code, inserted.name, inserted.city, inserted.company, inserted.created_at
        VALUES (@code, @name, @city, @company)
      `);

    // Create current month budget entry
    await tx.request()
      .input('center_code', mssql.NVarChar(10), centerCode)
      .input('month', mssql.TinyInt, new Date().getMonth() + 1)
      .input('year', mssql.SmallInt, new Date().getFullYear())
      .input('allocated', mssql.Decimal(14, 2), budget)
      .query(`
        IF NOT EXISTS (SELECT 1 FROM center_budgets WHERE center_code=@center_code AND month=@month AND year=@year)
        INSERT INTO center_budgets (center_code, month, year, allocated, committed, spent)
        VALUES (@center_code, @month, @year, @allocated, 0, 0)
      `);
    await tx.request().input('center_code', mssql.NVarChar(10), centerCode).query(`
      INSERT INTO center_inventory(center_code,sku,qty,reserved_qty)
      SELECT @center_code,sku,0,0 FROM inventory
      WHERE NOT EXISTS(SELECT 1 FROM center_inventory WHERE center_code=@center_code AND center_inventory.sku=inventory.sku)
    `);

    await tx.commit();
    clearCache('centers:all');
    res.status(201).json(result.recordset[0]);
  } catch (err: unknown) {
    try { await tx.rollback(); } catch { /* transaction not active */ }
    console.error(err);
    if (err instanceof Error && (err.message.includes('UNIQUE') || err.message.includes('PRIMARY'))) {
      return res.status(409).json({ error: `Center code "${centerCode}" already exists` });
    }
    res.status(500).json({ error: 'Failed to create center' });
  }
});

// ── PUT /api/centers/:id — Super Admin edits an existing Center ─────────────
router.put('/:id', requireAuth('super_admin'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, city, company, is_active } = req.body;

  try {
    const result = await pool.request()
      .input('id', mssql.Int, id)
      .input('name', mssql.NVarChar(100), name)
      .input('city', mssql.NVarChar(80), city)
      .input('company', mssql.NVarChar(100), company)
      .input('is_active', mssql.Bit, is_active !== undefined ? (is_active ? 1 : 0) : 1)
      .query(`
        UPDATE centers
        SET name = ISNULL(@name, name),
            city = ISNULL(@city, city),
            company = ISNULL(@company, company),
            is_active = @is_active
        OUTPUT inserted.id, inserted.code, inserted.name, inserted.city, inserted.company, inserted.is_active
        WHERE id = @id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Center not found' });
    }

    clearCache('centers:all');
    res.json(result.recordset[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update center' });
  }
});

// ── POST /api/centers/join-by-code — Employee joins a center using Center Code ──
router.post('/join-by-code', requireAuth('employee'), (_req: Request, res: Response) => {
  res.status(403).json({ error: 'Center assignments can only be changed by an administrator' });
});

export default router;
