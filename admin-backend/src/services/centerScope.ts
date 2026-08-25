import mssql from "mssql";
import { type AuthUser } from "../auth";
import { pool } from "../db";

export async function resolveCenterScope(user: AuthUser, requested?: unknown) {
  const center = String(requested || user.center_code || "").trim().toUpperCase();
  if (!center) return null;
  if (user.role === "super_admin" || user.role === "hq_admin") return center;
  if (user.role !== "center_admin") return null;
  if (center === user.center_code) return center;
  const access = await pool.request().input("uid", mssql.Int, user.id)
    .input("cc", mssql.NVarChar(10), center)
    .query(`SELECT 1 ok FROM admin_center_access
      WHERE user_id=@uid AND center_code=@cc AND is_active=1`);
  return access.recordset[0] ? center : null;
}
