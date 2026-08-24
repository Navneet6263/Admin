import type { ActivityRow } from '@/components/dashboard/ActivityFeed';

export interface CenterOverviewData {
  center: {
    code: string; name: string; city: string; company: string;
    allocated: number; committed: number; spent: number;
  };
  requests: {
    total: number; awaiting_approval: number; urgent_open: number;
    approved_30d: number; rejected_30d: number; avg_response_hrs: number;
  };
  inventory: { sku_count: number; low_stock: number; stock_value: number; reserved_units: number };
  people: { active_users: number };
}

export interface CenterInventoryRow {
  sku: string; name: string; category: string; unit: string; price: number;
  qty: number; reserved_qty: number; available_qty: number; threshold: number; updated_at: string;
}

export type CenterActivityRow = ActivityRow;
