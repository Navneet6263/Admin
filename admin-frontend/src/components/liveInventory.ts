import { useEffect, useState } from 'react';
import { request } from '@/lib/api';

export interface InventoryItem { sku: string; name: string; category: 'Writing' | 'Paper' | 'Printing' | 'Filing' | 'Desk' | 'Misc'; unit: string; price: number; qty: number; threshold: number; }
export type MovementDirection = 'in' | 'out';
export type MovementSource = 'seed' | 'restock' | 'add_item' | 'adjustment' | 'request' | 'return';
export interface StockMovement { id: string; at: string; sku: string; name: string; category: InventoryItem['category']; direction: MovementDirection; qty: number; balanceAfter: number; source: MovementSource; refId?: string; actor?: string; note?: string; }

let items: InventoryItem[] = [], movements: StockMovement[] = [];
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(listener => listener());
const asItem = (row: Record<string, unknown>): InventoryItem => ({ sku: String(row.sku), name: String(row.name), category: row.category as InventoryItem['category'], unit: String(row.unit), price: Number(row.price), qty: Number(row.qty), threshold: Number(row.threshold) });
const asMovement = (row: Record<string, unknown>): StockMovement => ({ id: String(row.id), sku: String(row.sku), name: String(row.name), category: row.category as InventoryItem['category'], direction: row.direction as MovementDirection, qty: Number(row.qty), balanceAfter: Number(row.balance_after), source: row.source as MovementSource, refId: row.ref_id ? String(row.ref_id) : undefined, actor: row.actor ? String(row.actor) : undefined, note: row.note ? String(row.note) : undefined, at: String(row.created_at) });
async function refresh() {
  try {
    const [stockRes, historyRes] = await Promise.allSettled([
      request<Record<string, unknown>[]>('/api/inventory'),
      request<Record<string, unknown>[]>('/api/inventory/movements')
    ]);
    if (stockRes.status === 'fulfilled') items = stockRes.value.map(asItem);
    if (historyRes.status === 'fulfilled') movements = historyRes.value.map(asMovement);
    notify();
  } catch (err) {
    console.warn('Inventory refresh warning:', err);
  }
}
export const inventoryStore = { get: () => items, movements: () => movements, refresh: () => refresh().catch(console.error), update: async (sku: string, patch: Partial<InventoryItem>) => { if (patch.qty !== undefined) await request(`/api/inventory/${encodeURIComponent(sku)}`, { method: 'PATCH', body: { qty: patch.qty } }); await refresh(); }, add: async (item: InventoryItem) => { await request('/api/inventory', { method: 'POST', body: item }); await refresh(); }, deduct: async () => { await refresh(); }, subscribe: (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); } };
export function useInventory() { const [snapshot, setSnapshot] = useState(items); useEffect(() => { void inventoryStore.refresh(); const unsub = inventoryStore.subscribe(() => setSnapshot([...items])); return () => { unsub(); }; }, []); return snapshot; }
export function useStockMovements() { const [snapshot, setSnapshot] = useState(movements); useEffect(() => { void inventoryStore.refresh(); const unsub = inventoryStore.subscribe(() => setSnapshot([...movements])); return () => { unsub(); }; }, []); return snapshot; }
export const isLow = (item: InventoryItem) => item.qty <= item.threshold;
