import mssql from 'mssql';
import dotenv from 'dotenv';
import { ensureWorkflowSchema } from './migrations/workflow';

dotenv.config();

export let dbConnected = false;

const envBoolean = (key: string, fallback: boolean) => {
  const value = process.env[key]?.trim().toLowerCase();
  return value === undefined || value === '' ? fallback : ['1', 'true', 'yes'].includes(value);
};

const configuredPort = Number(process.env.DB_PORT);

export const pool = new mssql.ConnectionPool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER!,
  database: process.env.DB_NAME,
  ...(Number.isInteger(configuredPort) && configuredPort > 0 ? { port: configuredPort } : {}),
  connectionTimeout: 15_000,
  requestTimeout: 30_000,
  pool: { max: 10, min: 0, idleTimeoutMillis: 30_000 },
  options: {
    encrypt: envBoolean('DB_ENCRYPT', true),
    trustServerCertificate: envBoolean('DB_TRUST_SERVER_CERTIFICATE', true),
    ...(process.env.DB_INSTANCE ? { instanceName: process.env.DB_INSTANCE } : {}),
  },
});
pool.on('error', (error) => {
  dbConnected = false;
  console.error('SQL pool error:', error instanceof Error ? error.message : error);
});

const transientDbError = (error: unknown) => {
  const value = error as { code?: string; message?: string; originalError?: { code?: string; message?: string; info?: { code?: string } } };
  const codes = [value?.code, value?.originalError?.code, value?.originalError?.info?.code];
  const message = `${value?.message || ''} ${value?.originalError?.message || ''}`;
  return codes.some((code) => ['ESOCKET', 'ECONNRESET', 'ECONNCLOSED', 'ETIMEOUT'].includes(String(code)))
    || /ECONNRESET|connection lost|socket hang up|timeout/i.test(message);
};

export async function withDbRetry<T>(operation: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const result = await operation();
      dbConnected = true;
      return result;
    } catch (error) {
      lastError = error;
      if (!transientDbError(error) || attempt === attempts - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 150 * (2 ** attempt)));
    }
  }
  throw lastError;
}

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

    // HQ and Super Admin are global roles; center assignment is only a dashboard filter.
    await pool.request().query(`
      DELETE uc FROM user_centers uc JOIN users u ON u.id=uc.user_id
        WHERE u.role IN ('hq_admin','admin','super_admin');
      UPDATE users SET center_code=NULL
        WHERE role IN ('hq_admin','admin','super_admin') AND center_code IS NOT NULL;
    `);

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

    await ensureWorkflowSchema(pool);
    clearCache();

    console.log('✅ Migrations applied');
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
