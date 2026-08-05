import mssql from 'mssql';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new mssql.ConnectionPool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER!,
  database: process.env.DB_NAME,
  pool: { max: 30, min: 5, idleTimeoutMillis: 30_000 },
  options: { encrypt: true, trustServerCertificate: true },
});

export let dbConnected = false;

/** Runs once on server start — safe, idempotent DDL for center tables */
async function runMigrations() {
  try {
    // centers table
    await pool.request().query(`
      IF OBJECT_ID('centers','U') IS NULL
      CREATE TABLE centers (
        id          INT PRIMARY KEY IDENTITY(1,1),
        code        NVARCHAR(10)  NOT NULL UNIQUE,
        name        NVARCHAR(100) NOT NULL,
        city        NVARCHAR(80)  NOT NULL,
        company     NVARCHAR(8)   NOT NULL DEFAULT 'VT',
        hq_admin_id INT           NULL,
        is_active   BIT           NOT NULL DEFAULT 1,
        created_at  DATETIME      DEFAULT GETDATE()
      )`);

    // user_centers table
    await pool.request().query(`
      IF OBJECT_ID('user_centers','U') IS NULL
      CREATE TABLE user_centers (
        id                INT PRIMARY KEY IDENTITY(1,1),
        user_id           INT          NOT NULL REFERENCES users(id),
        home_center_code  NVARCHAR(10) NOT NULL REFERENCES centers(code),
        assigned_by       INT          NULL REFERENCES users(id),
        assigned_at       DATETIME     DEFAULT GETDATE(),
        CONSTRAINT uq_user_center UNIQUE (user_id)
      )`);

    // center_budgets table
    await pool.request().query(`
      IF OBJECT_ID('center_budgets','U') IS NULL
      CREATE TABLE center_budgets (
        id          INT PRIMARY KEY IDENTITY(1,1),
        center_code NVARCHAR(10)  NOT NULL REFERENCES centers(code),
        month       TINYINT       NOT NULL CHECK (month BETWEEN 1 AND 12),
        year        SMALLINT      NOT NULL,
        allocated   DECIMAL(14,2) NOT NULL DEFAULT 0,
        committed   DECIMAL(14,2) NOT NULL DEFAULT 0,
        spent       DECIMAL(14,2) NOT NULL DEFAULT 0,
        updated_at  DATETIME      DEFAULT GETDATE(),
        CONSTRAINT uq_center_budget UNIQUE (center_code, month, year)
      )`);

    // Add center_code column to users if missing
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('users') AND name='center_code')
        ALTER TABLE users ADD center_code NVARCHAR(10) NULL`);

    // Add center columns to requests if missing
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('requests') AND name='home_center_code')
      BEGIN
        ALTER TABLE requests ADD home_center_code   NVARCHAR(10) NULL;
        ALTER TABLE requests ADD fulfil_center_code NVARCHAR(10) NULL;
      END`);

    // Auto-expand company columns to NVARCHAR(100) to prevent truncation errors for long company names like "Vision India"
    await pool.request().query(`
      IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('users') AND name='company')
        ALTER TABLE users ALTER COLUMN company NVARCHAR(100) NOT NULL;
      IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('centers') AND name='company')
        ALTER TABLE centers ALTER COLUMN company NVARCHAR(100) NOT NULL;
      IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('requests') AND name='company')
        ALTER TABLE requests ALTER COLUMN company NVARCHAR(100) NOT NULL;
      IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('teams') AND name='company')
        ALTER TABLE teams ALTER COLUMN company NVARCHAR(100) NOT NULL;
    `);

    // Seed default centers if empty
    const existing = await pool.request().query(`SELECT COUNT(*) AS n FROM centers`);
    if (existing.recordset[0].n === 0) {
      await pool.request().query(`
        INSERT INTO centers (code,name,city,company) VALUES
          ('A11','Noida HQ','Noida','VT'),
          ('B01','Patna Center','Patna','VT'),
          ('C01','Mumbai Office','Mumbai','VT'),
          ('D01','Bangalore Center','Bangalore','VT'),
          ('E01','Hyderabad Center','Hyderabad','VT')`);

      // Seed current-month budgets
      await pool.request().query(`
        INSERT INTO center_budgets (center_code,month,year,allocated,committed,spent) VALUES
          ('A11',MONTH(GETDATE()),YEAR(GETDATE()),500000,85000,62000),
          ('B01',MONTH(GETDATE()),YEAR(GETDATE()),200000,40000,38000),
          ('C01',MONTH(GETDATE()),YEAR(GETDATE()),300000,60000,45000),
          ('D01',MONTH(GETDATE()),YEAR(GETDATE()),250000,30000,22000),
          ('E01',MONTH(GETDATE()),YEAR(GETDATE()),150000,20000,18000)`);
    }

    // Clean up old sample seed requests so ONLY real requests created by users remain
    await pool.request().query(`
      DELETE FROM approvals WHERE request_id IN (
        SELECT id FROM requests WHERE user_id = 1 OR ref_id LIKE 'REQ-2026-000%' OR ref_id LIKE 'REQ-2026-001%'
      );
      DELETE FROM requests WHERE user_id = 1 OR ref_id LIKE 'REQ-2026-000%' OR ref_id LIKE 'REQ-2026-001%';
    `);
    clearCache();

    console.log('✅ Migrations applied & mock seed requests cleaned');
  } catch (err) {
    console.error('⚠️  Migration warning (non-fatal):', (err as Error).message);
  }
}

export async function connectDB() {
  try {
    await pool.connect();
    dbConnected = true;
    console.log('✅ SQL Server connected');
    await runMigrations();
  } catch (err) {
    console.error('❌ DB connection failed:', err);
  }
}


// ── In-memory cache ──────────────────────────────────────────────────────────
const cache = new Map<string, { data: unknown; ts: number }>();
const TTL = 30_000;

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < TTL) return entry.data as T;
  cache.delete(key);
  return null;
}

export function setCache(key: string, data: unknown) {
  cache.set(key, { data, ts: Date.now() });
}

export function clearCache(...keys: string[]) {
  keys.forEach(k => cache.delete(k));
}

// ── Shared types ─────────────────────────────────────────────────────────────
export type RequestStatus =
  | 'pending' | 'queued' | 'awaiting_verification'
  | 'approved' | 'rejected' | 'info_requested';

export type RequestType =
  | 'id_card' | 'visiting_card' | 'stationery'
  | 'travel' | 'courier' | 'meeting_room' | 'fooding';

export type Priority = 'low' | 'normal' | 'high' | 'urgent';

export type AuditAction =
  | 'approved' | 'rejected' | 'queued' | 'info_requested'
  | 'verified' | 'sent_back' | 'commented';

export const VALID_TYPES: RequestType[] = [
  'id_card', 'visiting_card', 'stationery',
  'travel', 'courier', 'meeting_room', 'fooding',
];

export const VALID_STATUSES: RequestStatus[] = [
  'pending', 'queued', 'awaiting_verification',
  'approved', 'rejected', 'info_requested',
];
