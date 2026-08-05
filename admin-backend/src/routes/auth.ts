import { Router } from "express";
import mssql from "mssql";
import { pool, clearCache } from "../db";
import { createToken, login, requireAuth, hashPassword } from "../auth";

const router = Router();
router.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== "string" || typeof password !== "string")
    return res.status(400).json({ error: "Email and password are required" });
  try {
    const user = await login(email, password);
    if (!user) return res.status(401).json({ error: "Invalid email or password" });
    res.json({ token: createToken(user), user });
  } catch (error) {
    console.error(error); res.status(500).json({ error: "Login unavailable" });
  }
});

router.post("/register", async (req, res) => {
  const { email, name, password, company, dept = "Operations", center_code } = req.body ?? {};
  if (![email, name, password, company, center_code].every((v) => typeof v === "string" && v.trim()))
    return res.status(400).json({ error: "Name, email, password, company and center are required" });
  const cleanEmail = email.trim().toLowerCase(); const centerCode = center_code.trim().toUpperCase();
  const tx = pool.transaction();
  try {
    await tx.begin();
    const valid = await tx.request().input("email", mssql.NVarChar(100), cleanEmail)
      .input("company", mssql.NVarChar(100), company).input("center", mssql.NVarChar(10), centerCode)
      .query(`SELECT
        (SELECT COUNT(*) FROM users WHERE email=@email) email_exists,
        (SELECT COUNT(*) FROM companies WHERE name=@company) company_exists,
        (SELECT COUNT(*) FROM centers WHERE code=@center AND is_active=1) center_exists`);
    const check = valid.recordset[0];
    if (check.email_exists) { await tx.rollback(); return res.status(409).json({ error: "This email is already registered" }); }
    if (!check.company_exists) { await tx.rollback(); return res.status(400).json({ error: "Selected company is not active" }); }
    if (!check.center_exists) { await tx.rollback(); return res.status(400).json({ error: "Selected center is not active" }); }
    const result = await tx.request().input("email", mssql.NVarChar(100), cleanEmail)
      .input("name", mssql.NVarChar(100), name.trim()).input("company", mssql.NVarChar(100), company)
      .input("dept", mssql.NVarChar(100), dept).input("hash", mssql.NVarChar(200), hashPassword(password.trim()))
      .input("center", mssql.NVarChar(10), centerCode).query(`INSERT INTO users
        (email,name,role,company,dept,password_hash,center_code,is_active)
        OUTPUT inserted.id,inserted.email,inserted.name,inserted.role,inserted.company,inserted.dept,inserted.center_code
        VALUES(@email,@name,'employee',@company,@dept,@hash,@center,1)`);
    const user = result.recordset[0];
    await tx.request().input("uid", mssql.Int, user.id).input("center", mssql.NVarChar(10), centerCode)
      .query(`INSERT INTO user_centers(user_id,home_center_code) VALUES(@uid,@center)`);
    await tx.commit(); clearCache("sa:users", "centers:all");
    res.status(201).json({ token: createToken(user), user, message: "Account created successfully" });
  } catch (error) {
    try { await tx.rollback(); } catch { /* already rolled back */ }
    console.error(error); res.status(500).json({ error: "Registration failed" });
  }
});

router.get("/me", requireAuth(), (req, res) => res.json(req.user));
export default router;
