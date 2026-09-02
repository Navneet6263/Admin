import { Router } from "express";
import mssql from "mssql";
import { clearCache, pool } from "../db";
import { clearSessionCookie, createSession, hashPassword, login, passwordError, requireAuth, revokeSession, setSessionCookie } from "../auth";
import { loginRateLimit, resetLoginRateLimit } from "../security";

const router = Router();
router.post("/login", loginRateLimit, async (req, res) => {
  const { email, password } = req.body ?? {};
  res.setHeader('Cache-Control', 'no-store');
  if (typeof email !== "string" || typeof password !== "string"
    || email.length > 254 || password.length > 256)
    return res.status(400).json({ error: "Email and password are required" });
  try {
    const user = await login(email, password);
    if (!user) return res.status(401).json({ error: "Invalid email or password" });
    setSessionCookie(res, await createSession(user.id));
    resetLoginRateLimit(req);
    res.json({ user });
  } catch (error) {
    console.error(error); res.status(500).json({ error: "Login unavailable" });
  }
});

router.get("/register-options", async (_req, res) => {
  try {
    const [companies, teams, centers] = await Promise.all([
      pool.request().query(`SELECT id,code,name FROM companies ORDER BY name ASC`),
      pool.request().query(`SELECT id,name,company FROM teams ORDER BY company ASC,name ASC`),
      pool.request().query(`SELECT id,code,name,city,company,is_active
        FROM centers WHERE is_active=1 ORDER BY company ASC,city ASC,name ASC`),
    ]);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ companies: companies.recordset, teams: teams.recordset, centers: centers.recordset });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Registration options unavailable" });
  }
});

router.post("/register", async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const company = String(req.body?.company || "").trim();
  const dept = String(req.body?.dept || "").trim();
  const centerCode = String(req.body?.center_code || "").trim().toUpperCase();
  const employeeCode = String(req.body?.employee_code || "").trim().toUpperCase();
  res.setHeader('Cache-Control', 'no-store');
  if (!name || !email || !password || !company || !dept || !centerCode || !employeeCode)
    return res.status(400).json({ error: "Name, employee ID, email, password, company, department and center are required" });
  if (name.length > 100 || email.length > 100 || company.length > 100 || dept.length > 80 || centerCode.length > 10 || employeeCode.length > 40)
    return res.status(400).json({ error: "One or more fields exceed the allowed length" });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: "Enter a valid email address" });
  if (!/^[A-Z0-9_-]{2,40}$/.test(employeeCode))
    return res.status(400).json({ error: "Employee ID may contain only letters, numbers, hyphen or underscore" });
  const invalidPassword = passwordError(password);
  if (invalidPassword) return res.status(400).json({ error: invalidPassword });

  const tx = pool.transaction();
  try {
    await tx.begin();
    const result = await tx.request()
      .input("email", mssql.NVarChar(100), email)
      .input("name", mssql.NVarChar(100), name)
      .input("company", mssql.NVarChar(100), company)
      .input("dept", mssql.NVarChar(80), dept)
      .input("cc", mssql.NVarChar(10), centerCode)
      .input("emp", mssql.NVarChar(40), employeeCode)
      .input("hash", mssql.NVarChar(256), hashPassword(password))
      .query(`
        IF EXISTS(SELECT 1 FROM users WHERE employee_code=@emp)
          THROW 51104,'Employee ID already exists',1;
        IF NOT EXISTS(SELECT 1 FROM companies WHERE name=@company)
          THROW 51101,'Select a valid company',1;
        IF NOT EXISTS(SELECT 1 FROM teams WHERE company=@company AND name=@dept)
          THROW 51102,'Select a valid department',1;
        IF NOT EXISTS(SELECT 1 FROM centers WHERE code=@cc AND is_active=1)
          THROW 51103,'Select an active center',1;
        INSERT INTO users(email,name,role,company,dept,employee_code,center_code,password_hash,is_active)
        OUTPUT inserted.id,inserted.email,inserted.name,inserted.role,inserted.company,
          inserted.dept,inserted.employee_code,inserted.center_code
        VALUES(@email,@name,'employee',@company,@dept,@emp,@cc,@hash,1);
      `);
    const user = result.recordset[0];
    await tx.request().input("uid", mssql.Int, user.id).input("cc", mssql.NVarChar(10), centerCode)
      .query(`INSERT INTO user_centers(user_id,home_center_code)
        SELECT @uid,@cc WHERE NOT EXISTS(SELECT 1 FROM user_centers WHERE user_id=@uid)`);
    await tx.commit();
    clearCache('sa:users');
    setSessionCookie(res, await createSession(user.id));
    res.status(201).json({ user });
  } catch (error) {
    try { await tx.rollback(); } catch { /* transaction already closed */ }
    const message = error instanceof Error ? error.message : "Registration failed";
    if (/valid company|valid department|active center/i.test(message)) return res.status(400).json({ error: message });
    if (/Employee ID already exists/i.test(message)) return res.status(409).json({ error: "Employee ID already exists" });
    if (/UNIQUE|duplicate/i.test(message)) return res.status(409).json({ error: "User with this email already exists" });
    console.error(error);
    res.status(500).json({ error: "Registration failed" });
  }
});

router.post('/logout', async (req, res) => {
  try { await revokeSession(req); }
  catch (error) { console.error('Session revocation failed:', error); }
  finally { clearSessionCookie(res); }
  res.setHeader('Cache-Control', 'no-store');
  res.json({ success: true });
});

router.get("/me", requireAuth(), (req, res) => res.json(req.user));
export default router;
