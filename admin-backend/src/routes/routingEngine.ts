import mssql from 'mssql';
import { pool } from '../db';

export interface RouteInfo {
  home_center_code: string;
  fulfil_center_code: string;
  center_admin_id: number | null;
  approval_tier: 'center_admin' | 'ho_admin' | 'super_admin';
}

/** Amount → approval tier */
export function getApprovalTier(amount: number | null): RouteInfo['approval_tier'] {
  if (!amount || amount <= 10000) return 'center_admin';
  if (amount <= 100000)           return 'ho_admin';
  return 'super_admin';
}

/**
 * Resolve routing for a user:
 *  - home_center_code  → from user_centers (where budget is charged)
 *  - fulfil_center_code → same as home (roaming fulfillment handled separately)
 *  - center_admin_id   → admin of home center
 */
export async function resolveRouting(userId: number, amount: number | null): Promise<RouteInfo> {
  const result = await pool.request()
    .input('uid', mssql.Int, userId)
    .query(`
      SELECT
        uc.home_center_code,
        c.hq_admin_id AS center_admin_id
      FROM user_centers uc
      JOIN centers c ON c.code = uc.home_center_code
      WHERE uc.user_id = @uid
    `);

  const row = result.recordset[0];
  const home_center_code  = row?.home_center_code  ?? 'A11';
  const center_admin_id   = row?.center_admin_id   ?? null;

  return {
    home_center_code,
    fulfil_center_code: home_center_code,
    center_admin_id,
    approval_tier: getApprovalTier(amount),
  };
}

/** Deduct spent from center_budgets when a request is approved */
export async function chargeCenter(
  centerCode: string,
  amount: number,
  tx: mssql.Transaction,
): Promise<void> {
  const m = new Date().getMonth() + 1;
  const y = new Date().getFullYear();

  await tx.request()
    .input('code',   mssql.NVarChar(10), centerCode)
    .input('amount', mssql.Decimal(14, 2), amount)
    .input('m',      mssql.TinyInt, m)
    .input('y',      mssql.SmallInt, y)
    .query(`
      UPDATE center_budgets
        SET spent      = spent      + @amount,
            committed  = CASE WHEN committed >= @amount THEN committed - @amount ELSE 0 END,
            updated_at = GETDATE()
      WHERE center_code = @code AND month = @m AND year = @y
    `);
}

/** Commit (reserve) budget when request is first raised */
export async function commitBudget(
  centerCode: string,
  amount: number,
): Promise<void> {
  const m = new Date().getMonth() + 1;
  const y = new Date().getFullYear();

  await pool.request()
    .input('code',   mssql.NVarChar(10), centerCode)
    .input('amount', mssql.Decimal(14, 2), amount)
    .input('m',      mssql.TinyInt, m)
    .input('y',      mssql.SmallInt, y)
    .query(`
      UPDATE center_budgets
        SET committed  = committed + @amount,
            updated_at = GETDATE()
      WHERE center_code = @code AND month = @m AND year = @y
    `);
}
