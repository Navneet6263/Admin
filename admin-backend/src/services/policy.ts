import mssql from "mssql";
import { AuthUser, effectiveRole } from "../auth";
import { pool } from "../db";

export type Capability =
  | "can_view"
  | "can_approve"
  | "can_update_payment"
  | "can_verify_payment"
  | "can_view_analytics";
export interface Policy {
  id: number;
  role: string;
  user_id: number | null;
  center_code: string | null;
  category: string | null;
  max_amount: number | null;
  can_view: boolean;
  can_approve: boolean;
  can_update_payment: boolean;
  can_verify_payment: boolean;
  can_view_analytics: boolean;
}

export async function policyFor(
  user: AuthUser,
  category?: string,
  center?: string,
): Promise<Policy | null> {
  if (user.role === "super_admin")
    return {
      id: 0,
      role: "super_admin",
      user_id: user.id,
      center_code: null,
      category: null,
      max_amount: null,
      can_view: true,
      can_approve: true,
      can_update_payment: true,
      can_verify_payment: true,
      can_view_analytics: true,
    };
  const role = effectiveRole(user.role);
  const result = await pool
    .request()
    .input("uid", mssql.Int, user.id)
    .input("role", mssql.NVarChar(30), role)
    .input("category", mssql.NVarChar(30), category || null)
    .input("center", mssql.NVarChar(10), center || null)
    .query(`SELECT TOP 1 * FROM approval_policies WHERE is_active=1 AND role=@role
      AND (user_id=@uid OR user_id IS NULL) AND (category=@category OR category IS NULL)
      AND (center_code=@center OR center_code IS NULL)
      ORDER BY CASE WHEN user_id=@uid THEN 1 ELSE 0 END DESC,
        CASE WHEN category=@category THEN 1 ELSE 0 END DESC,
        CASE WHEN center_code=@center THEN 1 ELSE 0 END DESC, id DESC`);
  return (result.recordset[0] as Policy | undefined) ?? null;
}

export async function authorize(
  user: AuthUser,
  capability: Capability,
  category?: string,
  center?: string,
  amount?: number | null,
) {
  const policy = await policyFor(user, category, center);
  if (!policy || !policy[capability]) return { allowed: false, policy };
  const exceeds =
    capability === "can_approve" &&
    policy.max_amount != null &&
    Number(amount || 0) > Number(policy.max_amount);
  return { allowed: !exceeds, policy };
}
