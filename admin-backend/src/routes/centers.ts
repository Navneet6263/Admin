import { Router, Request, Response } from 'express';
import mssql from 'mssql';
import { pool, getCached, setCache, clearCache } from '../db';

const router = Router();

// ── GET /api/centers — Fetch all centers with employee counts ────────────────
router.get('/', async (_req: Request, res: Response) => {
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
router.post('/create', async (req: Request, res: Response) => {
  const { code, name, city, company, initial_budget } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Center name is required' });

  const centerCity = city?.trim() || 'Noida';
  const centerCompany = company?.trim() || 'GROUP';
  const centerCode = (code?.trim() || name.trim().replace(/\s+/g, '_')).toUpperCase().slice(0, 10);
  const budget = parseFloat(initial_budget) || 200000;

  try {
    const result = await pool.request()
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
    await pool.request()
      .input('center_code', mssql.NVarChar(10), centerCode)
      .input('month', mssql.TinyInt, new Date().getMonth() + 1)
      .input('year', mssql.SmallInt, new Date().getFullYear())
      .input('allocated', mssql.Decimal(14, 2), budget)
      .query(`
        IF NOT EXISTS (SELECT 1 FROM center_budgets WHERE center_code=@center_code AND month=@month AND year=@year)
        INSERT INTO center_budgets (center_code, month, year, allocated, committed, spent)
        VALUES (@center_code, @month, @year, @allocated, 0, 0)
      `);

    clearCache('centers:all');
    res.status(201).json(result.recordset[0]);
  } catch (err: unknown) {
    console.error(err);
    if (err instanceof Error && (err.message.includes('UNIQUE') || err.message.includes('PRIMARY'))) {
      return res.status(409).json({ error: `Center code "${centerCode}" already exists` });
    }
    res.status(500).json({ error: 'Failed to create center' });
  }
});

// ── PUT /api/centers/:id — Super Admin edits an existing Center ─────────────
router.put('/:id', async (req: Request, res: Response) => {
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
router.post('/join-by-code', async (req: Request, res: Response) => {
  const { user_id, center_code } = req.body;
  if (!user_id || !center_code?.trim()) {
    return res.status(400).json({ error: 'User ID and Center Code are required' });
  }

  const code = center_code.trim().toUpperCase();

  try {
    // Check if center exists
    const centerRes = await pool.request()
      .input('code', mssql.NVarChar(10), code)
      .query(`SELECT id, code, name, city FROM centers WHERE code = @code AND is_active = 1`);

    if (centerRes.recordset.length === 0) {
      return res.status(404).json({ error: `Invalid Center Code "${code}". Please check with your Admin.` });
    }

    const center = centerRes.recordset[0];

    // Link user in user_centers
    await pool.request()
      .input('user_id', mssql.Int, user_id)
      .input('code', mssql.NVarChar(10), code)
      .query(`
        MERGE user_centers AS target
        USING (SELECT @user_id AS user_id) AS source
        ON (target.user_id = source.user_id)
        WHEN MATCHED THEN
          UPDATE SET home_center_code = @code, assigned_at = GETDATE()
        WHEN NOT MATCHED THEN
          INSERT (user_id, home_center_code) VALUES (@user_id, @code);
      `);

    // Also update users.center_code
    await pool.request()
      .input('user_id', mssql.Int, user_id)
      .input('code', mssql.NVarChar(10), code)
      .query(`UPDATE users SET center_code = @code WHERE id = @user_id`);

    clearCache('centers:all');
    res.json({
      success: true,
      message: `Successfully joined center ${center.name} (${center.code})!`,
      center,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to join center' });
  }
});

export default router;
