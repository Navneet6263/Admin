import type { RequestItem } from '@/components/models';

const baseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
const tokenKey = 'requesthub.token';
export type SessionUser = { id: number; email: string; name: string; role: string; company: string; dept: string };

export const session = {
  get token() { return typeof window === 'undefined' ? null : localStorage.getItem(tokenKey); },
  clear: () => localStorage.removeItem(tokenKey),
  async login(email: string, password: string) {
    const data = await request<{ token: string; user: SessionUser }>('/api/auth/login', { method: 'POST', body: { email, password } }, false);
    localStorage.setItem(tokenKey, data.token); return data.user;
  },
};

export async function request<T>(path: string, init: { method?: string; body?: unknown } = {}, authenticate = true): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: init.method ?? 'GET', headers: { 'Content-Type': 'application/json', ...(authenticate && session.token ? { Authorization: `Bearer ${session.token}` } : {}) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data as T;
}

export function toRequest(row: Record<string, unknown>): RequestItem {
  return { id: String(row.ref_id), dbId: Number(row.id), employeeId: Number(row.user_id), employeeName: String(row.employeeName ?? ''), employeeDept: String(row.employeeDept ?? row.team ?? ''), company: String(row.company ?? ''), team: String(row.team ?? ''), type: row.type as RequestItem['type'], subject: String(row.subject), amount: row.amount == null ? null : Number(row.amount), description: String(row.description ?? ''), priority: row.priority as RequestItem['priority'], status: row.status as RequestItem['status'], details: typeof row.details === 'string' ? JSON.parse(row.details || '{}') : row.details as Record<string, unknown>, createdAt: String(row.created_at), updatedAt: String(row.updated_at), audit: [] };
}

export const getRequests = async (path: string) => (await request<Record<string, unknown>[]>(path)).map(toRequest);
