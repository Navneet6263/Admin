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

export async function connectDB() {
  try {
    await pool.connect();
    dbConnected = true;
    console.log('✅ SQL Server connected');
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
