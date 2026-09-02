import { useEffect, useState } from 'react';
import { request, session } from '@/lib/api';

export const INVENTORY_CATEGORIES = ['Adhesive', 'Art Material', 'Battery', 'Correction', 'Cutting', 'Desk Accessories',
  'Desk Organizer', 'Diary', 'Filing', 'Labels', 'Mailing', 'Marker', 'Measuring', 'Notes', 'Office Equipment',
  'if Not in above', 'Other', 'Packing', 'Paper', 'Pen', 'Pinning', 'Premium Pen', 'Presentation', 'Printing', 'Register', 'Stamping',
  'Stapling', 'Whiteboard', 'Writing', 'Writing Accessories', 'Writing Pad', 'Desk', 'Misc'] as const;
export interface InventoryItem { sku: string; name: string; category: string; unit: string; price: number; qty: number; threshold: number; }
export type MovementDirection = 'in' | 'out';
export type MovementSource = 'seed' | 'restock' | 'add_item' | 'adjustment' | 'request' | 'return';
export interface StockMovement { id: string; at: string; sku: string; name: string; category: InventoryItem['category']; direction: MovementDirection; qty: number; balanceAfter: number; source: MovementSource; refId?: string; actor?: string; note?: string; }

let items: InventoryItem[] = [], movements: StockMovement[] = [];
let stockLoadedAt = 0, movementsLoadedAt = 0;
let stockTask: Promise<void> | null = null, movementTask: Promise<void> | null = null;
const movementRoles = new Set(['hq_admin', 'center_admin', 'finance', 'finance_head', 'super_admin']);
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(listener => listener());
const asItem = (row: Record<string, unknown>): InventoryItem => ({ sku: String(row.sku), name: String(row.name), category: row.category as InventoryItem['category'], unit: String(row.unit), price: Number(row.price ?? 0), qty: Number(row.qty ?? 0), threshold: Number(row.threshold ?? 0) });
const asMovement = (row: Record<string, unknown>): StockMovement => ({ id: String(row.id), sku: String(row.sku), name: String(row.name), category: row.category as InventoryItem['category'], direction: row.direction as MovementDirection, qty: Number(row.qty), balanceAfter: Number(row.balance_after), source: row.source as MovementSource, refId: row.ref_id ? String(row.ref_id) : undefined, actor: row.actor ? String(row.actor) : undefined, note: row.note ? String(row.note) : undefined, at: String(row.created_at) });
const fresh = (at: number) => Date.now() - at < 15_000;
function loadStock(force = false) {
  if (!force && fresh(stockLoadedAt)) return Promise.resolve();
  if (!stockTask) stockTask = request<Record<string, unknown>[]>('/api/inventory')
    .then((rows) => { items = rows.map(asItem); stockLoadedAt = Date.now(); notify(); })
    .finally(() => { stockTask = null; });
  return stockTask;
}
function loadMovements(force = false) {
  if (!movementRoles.has(session.user?.role ?? '') || (!force && fresh(movementsLoadedAt))) return Promise.resolve();
  if (!movementTask) movementTask = request<Record<string, unknown>[]>('/api/inventory/movements')
    .then((rows) => { movements = rows.map(asMovement); movementsLoadedAt = Date.now(); notify(); })
    .finally(() => { movementTask = null; });
  return movementTask;
}
async function refresh(includeMovements = false, force = false) {
  try { await Promise.all([loadStock(force), ...(includeMovements ? [loadMovements(force)] : [])]); }
  catch (err) { console.warn('Inventory refresh warning:', err); }
}
export const inventoryStore = {
  get: () => items, movements: () => movements, refresh: (history = false) => refresh(history).catch(console.error),
  update: async (sku: string, patch: Partial<InventoryItem>) => { await request(`/api/inventory/${encodeURIComponent(sku)}`, { method: 'PATCH', body: patch }); await refresh(true, true); },
  add: async (item: InventoryItem) => { await request('/api/inventory', { method: 'POST', body: item }); await refresh(true, true); },
  remove: async (sku: string) => { await request(`/api/inventory/${encodeURIComponent(sku)}`, { method: 'DELETE' }); await refresh(true, true); },
  deduct: async () => { await refresh(true, true); }, subscribe: (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); },
};
export function useInventory(enabled = true) { const [snapshot, setSnapshot] = useState(items); useEffect(() => { if (enabled) void inventoryStore.refresh(); const unsub = inventoryStore.subscribe(() => setSnapshot([...items])); return () => { unsub(); }; }, [enabled]); return snapshot; }
export function useStockMovements(enabled = true) { const [snapshot, setSnapshot] = useState(movements); useEffect(() => { if (enabled) void inventoryStore.refresh(true); const unsub = inventoryStore.subscribe(() => setSnapshot([...movements])); return () => { unsub(); }; }, [enabled]); return snapshot; }
export const isLow = (item: InventoryItem) => item.qty <= item.threshold;
