import type { RequestItem } from '@/components/models';

const baseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
const tokenKey = 'requesthub.token';
export type SessionUser = { id: number; email: string; name: string; role: string; company: string; dept: string };

const userKey = 'requesthub.user';

export const session = {
  get token() { return typeof window === 'undefined' ? null : localStorage.getItem(tokenKey); },
  get user(): SessionUser | null {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(userKey);
    try { return raw ? JSON.parse(raw) : null; } catch { return null; }
  },
  clear: () => {
    localStorage.removeItem(tokenKey);
    localStorage.removeItem(userKey);
  },
  async login(email: string, password: string) {
    const data = await request<{ token: string; user: SessionUser }>('/api/auth/login', { method: 'POST', body: { email, password } }, false);
    localStorage.setItem(tokenKey, data.token);
    localStorage.setItem(userKey, JSON.stringify(data.user));
    return data.user;
  },
  async register(details: { name: string; email: string; password: string; company?: string; dept?: string; center_code?: string }) {
    const data = await request<{ token: string; user: SessionUser }>('/api/auth/register', { method: 'POST', body: details }, false);
    localStorage.setItem(tokenKey, data.token);
    localStorage.setItem(userKey, JSON.stringify(data.user));
    return data.user;
  },
  async me() {
    if (!this.token) return null;
    try {
      const u = await request<SessionUser>('/api/auth/me');
      localStorage.setItem(userKey, JSON.stringify(u));
      return u;
    } catch {
      return this.user;
    }
  }
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
  let audit: { at: string; actor: string; action: string; note?: string }[] =
    typeof row.audit === 'string' ? JSON.parse(row.audit) : (Array.isArray(row.audit) ? row.audit : []);

  if (!audit || audit.length === 0) {
    const actorName = String(row.employeeName || row.employee_name || 'Requester');
    const createdAt = String(row.created_at || new Date().toISOString());
    const updatedAt = String(row.updated_at || createdAt);
    audit = [{ at: createdAt, actor: actorName, action: 'raised', note: 'Request raised' }];
    if (row.status === 'rejected') {
      audit.push({ at: updatedAt, actor: actorName, action: 'withdrawn', note: 'Withdrawn by requester' });
    }
  }

  return {
    id: String(row.ref_id || row.id),
    dbId: Number(row.id),
    employeeId: Number(row.user_id),
    employeeName: String(row.employeeName || row.employee_name || row.userName || ''),
    employeeDept: String(row.employeeDept || row.team || row.dept || ''),
    company: String(row.company ?? ''),
    team: String(row.team ?? ''),
    type: row.type as RequestItem['type'],
    subject: String(row.subject),
    amount: row.amount == null ? null : Number(row.amount),
    description: String(row.description ?? ''),
    priority: row.priority as RequestItem['priority'],
    status: row.status as RequestItem['status'],
    details: typeof row.details === 'string' ? JSON.parse(row.details || '{}') : (row.details as Record<string, unknown> || {}),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    audit,
  };
}

export const getRequests = async (path: string) => (await request<Record<string, unknown>[]>(path)).map(toRequest);
