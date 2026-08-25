import "dotenv/config";
import crypto from "node:crypto";
import mssql from "mssql";

const flag = (key, fallback) => {
  const value = process.env[key]?.trim().toLowerCase();
  return value ? ["1", "true", "yes"].includes(value) : fallback;
};
const db = await mssql.connect({ user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER, database: process.env.DB_NAME, port: Number(process.env.DB_PORT) || 1433,
  options: { encrypt: flag("DB_ENCRYPT", true), trustServerCertificate: flag("DB_TRUST_SERVER_CERTIFICATE", true) } });
const base = (process.env.TEST_BASE_URL || "http://127.0.0.1:3001").replace(/\/$/, "");
const secret = process.env.AUTH_SECRET || "local-development-only-change-me";
const cookieName = process.env.NODE_ENV === "production" ? "__Host-requesthub_session" : "requesthub_session";
const sessions = [];

async function sessionFor(roles) {
  const found = await db.request().input("roles", mssql.NVarChar(200), roles.join(","))
    .query(`SELECT TOP 1 id,role FROM users WHERE is_active=1
      AND role IN(SELECT value FROM STRING_SPLIT(@roles,',')) ORDER BY id`);
  if (!found.recordset[0]) return null;
  const token = crypto.randomBytes(32).toString("base64url");
  const hash = crypto.createHmac("sha256", secret).update(token).digest("hex");
  await db.request().input("hash", mssql.Char(64), hash).input("uid", mssql.Int, found.recordset[0].id)
    .query(`INSERT INTO auth_sessions(token_hash,user_id,expires_at)
      VALUES(@hash,@uid,DATEADD(MINUTE,10,SYSUTCDATETIME()))`);
  sessions.push(hash);
  return { cookie: `${cookieName}=${token}`, role: found.recordset[0].role,
    id: found.recordset[0].id };
}
async function call(path, session, method = "GET", body) {
  const response = await fetch(`${base}${path}`, { method,
    headers: { Cookie: session.cookie, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, data: await response.json().catch(() => ({})) };
}
function pass(label, condition) {
  if (!condition) throw new Error(`FAIL ${label}`);
  console.log(`PASS ${label}`);
}

try {
  const hq = await sessionFor(["hq_admin"]);
  if (hq) {
    const queue = await call("/api/workflow/queue?status=inbox&page=1&page_size=10", hq);
    pass("HQ Admin paged approval queue", queue.status === 200 && Array.isArray(queue.data.data)
      && queue.data.summary && Number.isFinite(Number(queue.data.total)));
    pass("HQ Admin approval access", queue.data.data.every((row) => !["pending", "info_requested"].includes(row.status) || row.can_act));
    pass("HQ Admin audit history", queue.data.data.every((row) => typeof row.audit === "string" && Array.isArray(JSON.parse(row.audit))));
    const target = await db.request().query(`SELECT TOP 1 id FROM users
      WHERE is_active=1 AND role='center_admin' ORDER BY id`);
    if (target.recordset[0]) {
      const access = await call(`/api/admin/users/${target.recordset[0].id}/center-access`, hq);
      pass("HQ Admin manages Center Admin extra access", access.status === 200
        && Array.isArray(access.data.additional_centers));
    }
    const financeRead = await call("/api/payments?page=1&page_size=10", hq);
    pass("HQ Admin expense view is read-only", financeRead.status === 200 && Array.isArray(financeRead.data.data));
    const financeWrite = await call("/api/payments/0/update", hq, "POST");
    pass("HQ Admin cannot operate finance review", financeWrite.status === 403);
    const employeeReceipts = await call("/api/employee/receipts/pending", hq);
    pass("HQ Admin cannot impersonate employee receipt", employeeReceipts.status === 403);
  } else console.log("SKIP HQ Admin access: no active account");

  const verifier = await sessionFor(["verifier"]);
  if (verifier) {
    const queue = await call("/api/verifier/queue?view=all&page=1&page_size=10", verifier);
    pass("Verifier paged history", queue.status === 200 && Array.isArray(queue.data.data) && queue.data.summary);
    pass("Verifier audit history", queue.data.data.every((row) => typeof row.audit === "string" && Array.isArray(JSON.parse(row.audit))));
  } else console.log("SKIP Verifier access: no active account");

  const centerAdmin = await sessionFor(["center_admin"]);
  if (centerAdmin) {
    const queue = await call("/api/workflow/queue?status=all&page=1&page_size=10", centerAdmin);
    pass("Center Admin paged workflow queue", queue.status === 200 && Array.isArray(queue.data.data));
    const own = await db.request().input("uid", mssql.Int, centerAdmin.id)
      .query(`SELECT center_code FROM users WHERE id=@uid`);
    const other = await db.request().input("uid", mssql.Int, centerAdmin.id)
      .input("home", mssql.NVarChar(10), own.recordset[0]?.center_code || null)
      .query(`SELECT TOP 1 code FROM centers c WHERE c.is_active=1 AND c.code<>@home
        AND NOT EXISTS(SELECT 1 FROM admin_center_access a
          WHERE a.user_id=@uid AND a.center_code=c.code AND a.is_active=1)`);
    if (other.recordset[0]) {
      const denied = await call(`/api/center-admin/overview?center_code=${other.recordset[0].code}`, centerAdmin);
      pass("Center Admin cannot bypass center grants", denied.status === 403);
    }
    const legacy = await call("/api/center-admin/requests/0/approve", centerAdmin, "POST");
    pass("Legacy Center Admin bypass retired", legacy.status === 410);
  } else console.log("SKIP Center Admin access: no active account");

  const employee = await sessionFor(["employee"]);
  if (employee) {
    const id = (await db.request().input("roles", mssql.NVarChar(200), "employee")
      .query(`SELECT TOP 1 id FROM users WHERE is_active=1 AND role IN(SELECT value FROM STRING_SPLIT(@roles,',')) ORDER BY id`)).recordset[0].id;
    const mine = await call(`/api/employee/requests/${id}?view=all&page=1&page_size=10`, employee);
    pass("Employee stable paged history", mine.status === 200 && Array.isArray(mine.data.data) && mine.data.summary);
    const receipts = await call("/api/employee/receipts/pending", employee);
    pass("Employee pending receipt access", receipts.status === 200 && Array.isArray(receipts.data));
    const missingReceipt = await call("/api/employee/requests/0/receipt", employee, "POST",
      { received: true, feedback: "very_easy", note: "" });
    pass("Employee cannot confirm an unavailable receipt", missingReceipt.status === 409);
  } else console.log("SKIP Employee access: no active account");

  const financeHead = await sessionFor(["finance_head"]);
  if (financeHead) {
    const dashboard = await call("/api/payments/head-dashboard", financeHead);
    pass("Finance Head dashboard access", dashboard.status === 200 && dashboard.data.metrics);
  } else console.log("SKIP Finance Head access: no active account");
} finally {
  for (const hash of sessions) await db.request().input("hash", mssql.Char(64), hash)
    .query("DELETE FROM auth_sessions WHERE token_hash=@hash");
  await db.close();
}
