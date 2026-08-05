import { Router, Request, Response } from 'express';
import mssql from 'mssql';
import { pool, getCached, setCache, clearCache } from '../db';
import { requireAuth } from '../auth';

const router = Router();

// ── GET /api/teams — Fetch all dynamic teams ─────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  const company = (req.query.company as string) || 'all';
  const cacheKey = `teams:${company}`;
  const cached = getCached<unknown[]>(cacheKey);
  if (cached) return res.json(cached);

  try {
    const result = await pool.request()
      .input('company', mssql.NVarChar, company)
      .query(`
        SELECT id, name, company, created_at
        FROM teams
        WHERE (@company = 'all' OR company = @company)
        ORDER BY name ASC
      `);
    setCache(cacheKey, result.recordset);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// ── POST /api/teams/create — Super Admin creates a new Team ─────────────────
router.post('/create', requireAuth('super_admin'), async (req: Request, res: Response) => {
  const { name, company = 'VT' } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Team name is required' });

  try {
    const result = await pool.request()
      .input('name', mssql.NVarChar(80), name.trim())
      .input('company', mssql.NVarChar(100), company)
      .query(`
        INSERT INTO teams (name, company)
        OUTPUT inserted.id, inserted.name, inserted.company, inserted.created_at
        VALUES (@name, @company)
      `);

    clearCache('teams:all', `teams:${company}`);
    res.status(201).json(result.recordset[0]);
  } catch (err: unknown) {
    console.error(err);
    if (err instanceof Error && err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Team with this name already exists' });
    }
    res.status(500).json({ error: 'Failed to create team' });
  }
});

export default router;
