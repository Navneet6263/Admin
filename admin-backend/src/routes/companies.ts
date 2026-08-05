import { Router, Request, Response } from 'express';
import mssql from 'mssql';
import { pool, getCached, setCache, clearCache } from '../db';

const router = Router();

// ── GET /api/companies — Fetch all dynamic companies ────────────────────────
router.get('/', async (_req: Request, res: Response) => {
  const cacheKey = 'companies:all';
  const cached = getCached<unknown[]>(cacheKey);
  if (cached) return res.json(cached);

  try {
    const result = await pool.request().query(`
      SELECT id, code, name, legal_name, created_at
      FROM companies
      ORDER BY name ASC
    `);
    setCache(cacheKey, result.recordset);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    // Fallback if table not created yet
    res.json([
      { id: 1, code: 'VI', name: 'Vision India', legal_name: 'Vision India Pvt. Ltd.' },
      { id: 2, code: 'JJ', name: 'Just Job', legal_name: 'Just Job Services Pvt. Ltd.' },
      { id: 3, code: 'LS', name: 'Live Skills', legal_name: 'Live Skills Education Pvt. Ltd.' },
    ]);
  }
});

// ── POST /api/companies/create — Super Admin creates a new Company ──────────
router.post('/create', async (req: Request, res: Response) => {
  const { name, code, legal_name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Company name is required' });

  const compCode = (code?.trim() || name.trim().slice(0, 3)).toUpperCase();
  const legalName = legal_name?.trim() || `${name.trim()} Pvt. Ltd.`;

  try {
    const result = await pool.request()
      .input('code', mssql.Varchar(10), compCode)
      .input('name', mssql.NVarChar(100), name.trim())
      .input('legal_name', mssql.NVarChar(150), legalName)
      .query(`
        INSERT INTO companies (code, name, legal_name)
        OUTPUT inserted.id, inserted.code, inserted.name, inserted.legal_name, inserted.created_at
        VALUES (@code, @name, @legal_name)
      `);

    clearCache('companies:all');
    res.status(201).json(result.recordset[0]);
  } catch (err: unknown) {
    console.error(err);
    if (err instanceof Error && err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Company code/name already exists' });
    }
    res.status(500).json({ error: 'Failed to create company' });
  }
});

export default router;
