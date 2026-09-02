import type { AuditEntry, RequestItem } from '@/components/models';

const configuredBaseUrl = import.meta.env.VITE_API_URL?.trim().replace(/\/+$/, '');
const baseUrl = configuredBaseUrl || (import.meta.env.DEV ? 'http://localhost:3001' : '');
const tokenKey = 'requesthub.token';
export type SessionUser = {
  id: number;
  email: string;
  name: string;
  role: string;
  company: string;
  dept: string;
  employee_code?: string | null;
  center_code?: string | null;
};

const userKey = 'requesthub.user';
let verifiedUser: SessionUser | null = null;
let verifiedAt = 0;
let meInFlight: Promise<SessionUser | null> | null = null;

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
    verifiedUser = null;
    verifiedAt = 0;
  },
  async login(email: string, password: string) {
    const data = await request<{ user: SessionUser }>('/api/auth/login', { method: 'POST', body: { email, password } }, false);
    localStorage.removeItem(tokenKey);
    localStorage.setItem(userKey, JSON.stringify(data.user));
    verifiedUser = data.user;
    verifiedAt = Date.now();
    return data.user;
  },
  async register(details: { name: string; email: string; password: string; company?: string; dept?: string; center_code?: string; employee_code?: string }) {
    const data = await request<{ user: SessionUser }>('/api/auth/register', { method: 'POST', body: details }, false);
    localStorage.removeItem(tokenKey);
    localStorage.setItem(userKey, JSON.stringify(data.user));
    verifiedUser = data.user;
    verifiedAt = Date.now();
    return data.user;
  },
  async logout() {
    try { await request('/api/auth/logout', { method: 'POST' }, false); }
    finally { this.clear(); }
  },
  async me() {
    if (verifiedUser && Date.now() - verifiedAt < 15_000) return verifiedUser;
    if (!meInFlight) meInFlight = request<SessionUser>('/api/auth/me')
      .then((user) => {
        verifiedUser = user; verifiedAt = Date.now();
        localStorage.setItem(userKey, JSON.stringify(user));
        return user;
      })
      .catch(() => { this.clear(); return null; })
      .finally(() => { meInFlight = null; });
    return meInFlight;
  }
};

export async function request<T>(path: string, init: { method?: string; body?: unknown } = {}, authenticate = true): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: init.method ?? 'GET', headers: { 'Content-Type': 'application/json', ...(authenticate && session.token ? { Authorization: `Bearer ${session.token}` } : {}) },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      credentials: 'include',
    });
  } catch {
    throw new Error('RequestHub server is unavailable. Please start the backend and try again.');
  }
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && authenticate) {
    session.clear();
    if (typeof window !== 'undefined' && window.location.pathname !== '/') {
      window.location.assign('/');
    }
  }
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data as T;
}

export function toRequest(row: Record<string, unknown>): RequestItem {
  const audit: AuditEntry[] =
    typeof row.audit === 'string' ? JSON.parse(row.audit) : (Array.isArray(row.audit) ? row.audit : []);

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
    actualAmount: row.actual_amount == null ? null : Number(row.actual_amount),
    description: String(row.description ?? ''),
    priority: row.priority as RequestItem['priority'],
    status: row.status as RequestItem['status'],
    details: typeof row.details === 'string' ? JSON.parse(row.details || '{}') : (row.details as Record<string, unknown> || {}),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    audit,
    homeCenter: String(row.home_center_code || ''), requestCenter: String(row.request_center_code || ''),
    approvalCenter: String(row.approval_center_code || ''), chargeCenter: String(row.charge_center_code || ''),
    inventoryCenter: String(row.inventory_center_code || ''), workflowStatus: String(row.workflow_status || ''),
    paymentStatus: String(row.payment_status || ''), canAct: Boolean(row.can_act),
    fulfillmentStatus: (row.fulfillment_status || 'not_required') as RequestItem['fulfillmentStatus'],
    fulfilledBy: row.fulfilled_by == null ? null : Number(row.fulfilled_by),
    fulfilledAt: row.fulfilled_at == null ? null : String(row.fulfilled_at),
    receiptStatus: (row.receipt_status || 'not_required') as RequestItem['receiptStatus'],
    receiptFeedback: (row.receipt_feedback || null) as RequestItem['receiptFeedback'],
    receiptNote: row.receipt_note == null ? null : String(row.receipt_note),
    receiptConfirmedAt: row.receipt_confirmed_at == null ? null : String(row.receipt_confirmed_at),
  };
}

export const getRequests = async (path: string) => (await request<Record<string, unknown>[]>(path)).map(toRequest);
export interface Paged<T, S = unknown> { data: T[]; page: number; page_size: number; total: number; summary?: S; }
export const getPagedRequests = async <S = unknown>(path: string) => {
  const page = await request<Paged<Record<string, unknown>, S>>(path);
  return { ...page, data: page.data.map(toRequest) };
};
