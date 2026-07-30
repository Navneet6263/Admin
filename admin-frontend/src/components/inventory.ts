// ⭐ MOCK — Admin inventory store with tiny pub/sub for cross-route reactivity.
import { useEffect, useState } from "react";

export interface InventoryItem {
  sku: string;
  name: string;
  category: "Writing" | "Paper" | "Printing" | "Filing" | "Desk" | "Misc";
  unit: string;      // "pack of 10", "500 sheets", "1 pc"
  price: number;     // ₹ per unit
  qty: number;       // on-hand
  threshold: number; // low-stock trigger
}

export type MovementDirection = "in" | "out";
export type MovementSource =
  | "seed"           // opening balance
  | "restock"        // admin manual restock
  | "add_item"       // new SKU added to catalogue
  | "adjustment"     // manual qty edit
  | "request"        // deducted against an approved request
  | "return";        // stock returned back

export interface StockMovement {
  id: string;
  at: string;               // ISO
  sku: string;
  name: string;
  category: InventoryItem["category"];
  direction: MovementDirection;
  qty: number;              // positive units moved
  balanceAfter: number;     // on-hand after the movement
  source: MovementSource;
  refId?: string;           // e.g. REQ-2026-0138
  actor?: string;           // "John Admin (ADM-001)"
  note?: string;
}

const seed: InventoryItem[] = [
  { sku: "STA-WBM-10",  name: "Whiteboard markers (assorted)",  category: "Writing",  unit: "pack of 10",   price: 300,  qty: 25, threshold: 10 },
  { sku: "STA-STN-100", name: "Sticky notes 3×3 (yellow)",       category: "Paper",    unit: "100 sheets",   price: 80,   qty: 40, threshold: 10 },
  { sku: "STA-A4P-500", name: "A4 printer paper (75 gsm)",       category: "Paper",    unit: "500 sheets",   price: 450,  qty: 15, threshold: 10 },
  { sku: "STA-BPP-10",  name: "Ballpoint pens (blue)",           category: "Writing",  unit: "pack of 10",   price: 120,  qty: 8,  threshold: 10 },
  { sku: "STA-HPC-01",  name: "HP LaserJet cartridge 88A",       category: "Printing", unit: "1 cartridge",  price: 4200, qty: 5,  threshold: 6  },
  { sku: "STA-FLD-25",  name: "File folders (A4, plastic)",      category: "Filing",   unit: "pack of 25",   price: 550,  qty: 30, threshold: 10 },
  { sku: "STA-HLT-05",  name: "Highlighters (5-colour)",         category: "Writing",  unit: "pack of 5",    price: 150,  qty: 20, threshold: 8  },
  { sku: "STA-STP-01",  name: "Stapler + 1000 pins",             category: "Desk",     unit: "1 kit",        price: 450,  qty: 12, threshold: 6  },
  { sku: "STA-NBK-05",  name: "A5 notebooks (ruled)",            category: "Paper",    unit: "pack of 5",    price: 200,  qty: 18, threshold: 10 },
  { sku: "STA-ENV-50",  name: "A4 envelopes (kraft)",            category: "Filing",   unit: "pack of 50",   price: 250,  qty: 22, threshold: 10 },
  { sku: "STA-USB-01",  name: "USB drive 32 GB",                 category: "Misc",     unit: "1 pc",         price: 550,  qty: 4,  threshold: 6  },
  { sku: "STA-BAT-04",  name: "AA batteries (pack of 4)",        category: "Misc",     unit: "pack of 4",    price: 90,   qty: 30, threshold: 10 },
];

let items: InventoryItem[] = [...seed];
let movements: StockMovement[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const daysAgo = (d: number, hourOffset = 0) =>
  new Date(Date.now() - d * 86400_000 - hourOffset * 3600_000).toISOString();

let midCounter = 1;
const nextId = () => `MV-${String(midCounter++).padStart(5, "0")}`;

const log = (m: Omit<StockMovement, "id">) => {
  movements = [{ id: nextId(), ...m }, ...movements];
};

// Seed opening balances + a spread of synthetic history so the timeline
// looks realistic on first render.
(function seedHistory() {
  // Opening balances (45 days ago)
  seed.forEach((i) => log({
    at: daysAgo(45), sku: i.sku, name: i.name, category: i.category,
    direction: "in", qty: i.qty, balanceAfter: i.qty,
    source: "seed", actor: "System", note: "Opening balance",
  }));

  // A few restocks + request-driven deductions across the last 40 days.
  const events: Array<[number, string, MovementDirection, number, MovementSource, string?, string?]> = [
    [40, "STA-BPP-10", "out", 4, "request", "REQ-2026-0091", "John Admin (ADM-001)"],
    [36, "STA-A4P-500", "out", 6, "request", "REQ-2026-0098", "John Admin (ADM-001)"],
    [33, "STA-STN-100", "out", 10, "request", "REQ-2026-0104", "John Admin (ADM-001)"],
    [30, "STA-BPP-10", "in", 12, "restock", undefined, "John Admin (ADM-001)"],
    [28, "STA-HPC-01", "out", 2, "request", "REQ-2026-0111", "John Admin (ADM-001)"],
    [24, "STA-WBM-10", "out", 3, "request", "REQ-2026-0119", "John Admin (ADM-001)"],
    [21, "STA-USB-01", "out", 2, "request", "REQ-2026-0123", "John Admin (ADM-001)"],
    [18, "STA-HPC-01", "in", 3, "restock", undefined, "John Admin (ADM-001)"],
    [14, "STA-A4P-500", "out", 8, "request", "REQ-2026-0128", "John Admin (ADM-001)"],
    [12, "STA-NBK-05", "out", 4, "request", "REQ-2026-0130", "John Admin (ADM-001)"],
    [9,  "STA-STN-100", "in", 20, "restock", undefined, "John Admin (ADM-001)"],
    [7,  "STA-BPP-10", "out", 5, "request", "REQ-2026-0134", "John Admin (ADM-001)"],
    [5,  "STA-BAT-04", "out", 6, "request", "REQ-2026-0136", "John Admin (ADM-001)"],
    [3,  "STA-FLD-25", "out", 4, "request", "REQ-2026-0140", "John Admin (ADM-001)"],
    [2,  "STA-HLT-05", "out", 2, "request", "REQ-2026-0141", "John Admin (ADM-001)"],
    [1,  "STA-USB-01", "out", 1, "request", "REQ-2026-0142", "John Admin (ADM-001)"],
  ];

  // Recompute a synthetic running balance in insertion order (oldest → newest).
  const running = new Map(seed.map((i) => [i.sku, i.qty] as const));
  // Historical items don't affect the current on-hand (which is `seed`); we
  // only care that balanceAfter looks plausible relative to its neighbours.
  events
    .slice()
    .reverse() // oldest first
    .forEach(([d, sku, dir, qty, source, refId, actor]) => {
      const item = seed.find((s) => s.sku === sku)!;
      const prev = running.get(sku) ?? item.qty;
      const bal = dir === "in" ? prev + qty : Math.max(0, prev - qty);
      running.set(sku, bal);
      log({
        at: daysAgo(d, Math.round(seedHash(sku, d) * 8)),
        sku, name: item.name, category: item.category,
        direction: dir, qty, balanceAfter: bal, source, refId, actor,
      });
    });
})();

function seedHash(sku: string, d: number) {
  const x = Math.sin(sku.length * 91.7 + d * 13.3) * 10000;
  return x - Math.floor(x);
}

const record = (
  sku: string,
  direction: MovementDirection,
  qty: number,
  source: MovementSource,
  extra: { refId?: string; actor?: string; note?: string } = {},
) => {
  const item = items.find((i) => i.sku === sku);
  if (!item || qty <= 0) return;
  log({
    at: new Date().toISOString(),
    sku, name: item.name, category: item.category,
    direction, qty, balanceAfter: item.qty,
    source, ...extra,
  });
};

export const inventoryStore = {
  get: () => items,
  movements: () => movements,
  update: (sku: string, patch: Partial<InventoryItem>, actor = "John Admin (ADM-001)") => {
    const prev = items.find((i) => i.sku === sku);
    items = items.map((i) => (i.sku === sku ? { ...i, ...patch } : i));
    if (prev && typeof patch.qty === "number" && patch.qty !== prev.qty) {
      const diff = patch.qty - prev.qty;
      const dir: MovementDirection = diff > 0 ? "in" : "out";
      record(sku, dir, Math.abs(diff), diff > 0 ? "restock" : "adjustment", { actor, note: "Manual stock edit" });
    }
    emit();
  },
  add: (item: InventoryItem, actor = "John Admin (ADM-001)") => {
    items = [item, ...items];
    if (item.qty > 0) {
      log({
        at: new Date().toISOString(),
        sku: item.sku, name: item.name, category: item.category,
        direction: "in", qty: item.qty, balanceAfter: item.qty,
        source: "add_item", actor, note: "New SKU added to catalogue",
      });
    }
    emit();
  },
  deduct: (picks: { sku: string; qty: number }[], meta: { refId?: string; actor?: string } = {}) => {
    items = items.map((i) => {
      const p = picks.find((x) => x.sku === i.sku);
      return p ? { ...i, qty: Math.max(0, i.qty - p.qty) } : i;
    });
    picks.forEach((p) => record(p.sku, "out", p.qty, "request", {
      refId: meta.refId, actor: meta.actor ?? "John Admin (ADM-001)",
      note: meta.refId ? `Issued against ${meta.refId}` : "Issued",
    }));
    emit();
  },
  subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
};

export function useInventory() {
  const [snap, setSnap] = useState(items);
  useEffect(() => inventoryStore.subscribe(() => setSnap([...inventoryStore.get()])), []);
  return snap;
}

export function useStockMovements() {
  const [snap, setSnap] = useState(movements);
  useEffect(() => inventoryStore.subscribe(() => setSnap([...inventoryStore.movements()])), []);
  return snap;
}

export const isLow = (i: InventoryItem) => i.qty <= i.threshold;
