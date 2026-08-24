import type { ActivityRow } from '@/components/dashboard/ActivityFeed';

export interface FinanceHeadData {
  metrics: {
    total_payments: number;
    awaiting_update: number;
    awaiting_verification: number;
    overdue: number;
    open_value: number;
    paid_this_month: number;
    avg_verify_hrs: number;
  };
  monthly: Array<{ month_key: string; amount: number; payment_count: number }>;
  centers: Array<{ center_code: string; amount: number; payment_count: number }>;
  activity: Array<ActivityRow & { payment_status: string }>;
}
