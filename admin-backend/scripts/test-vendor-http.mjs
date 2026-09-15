import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHmac } from 'node:crypto';
const require = createRequire(import.meta.url);
process.env.NODE_ENV = 'test';
process.env.AUTH_SECRET = 'offline-vendor-test-secret-not-a-real-key';
process.env.DB_SERVER = '127.0.0.1';
const express = require('express');
const { pool } = require('../dist/db.js');
const { requireAuth } = require('../dist/auth.js');
const { enforceTrustedOrigin } = require('../dist/security.js');
const { vendorSendRateLimit } = require('../dist/services/vendorRateLimit.js');
const vendors = require('../dist/routes/vendors.js').default;
const cards = require('../dist/routes/vendorCards.js').default;
process.env.SMTP_HOST = ''; // Absolutely no live SMTP calls from this test.
const roles = ['employee', 'finance', 'finance_head', 'center_admin', 'hq_admin', 'super_admin'];
const users = new Map(roles.map((role, i) => [createHmac('sha256', process.env.AUTH_SECRET).update(String(i + 1).repeat(44)).digest('hex'),
  { id: i + 1, role, center_code: role === 'center_admin' ? 'A11' : null }]));
let writes = 0;
const request = () => {
  const p = {};
  return { input(name, _type, value) { p[name] = value; return this; }, async query(sql) {
    if (sql.includes('FROM auth_sessions')) return { recordset: users.has(p.hash) ? [users.get(p.hash)] : [] };
    if (sql.includes('FROM requests r')) {
      assert.match(sql, /admin_center_access/); assert.match(sql, /r\.status='approved'/);
      return { recordset: [], recordsets: [[], [{ total: 0 }]] };
    }
    if (sql.includes('FROM vendors')) return { recordset: [], recordsets: [[], [{ total: 0 }]] };
    if (sql.includes('INSERT INTO vendors')) { writes++; return { recordset: [{ id: 1 }] }; }
    if (sql.includes('INSERT INTO vendor_audit')) { writes++; return { recordset: [] }; }
    throw new Error(`Unexpected SQL in offline test: ${sql.slice(0, 80)}`);
  } };
};
pool.request = request;
pool.transaction = () => ({ request, async begin() {}, async commit() {}, async rollback() {} });
const app = express();
app.use('/api/vendor-cards/send', requireAuth('center_admin', 'hq_admin', 'super_admin'), enforceTrustedOrigin,
  vendorSendRateLimit, express.json({ limit: '12mb' }));
app.use(express.json({ limit: '1mb' }));
app.use(enforceTrustedOrigin);
app.use('/api/vendors', requireAuth('center_admin', 'hq_admin', 'super_admin'), vendors);
app.use('/api/vendor-cards', requireAuth('center_admin', 'hq_admin', 'super_admin'), cards);
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const call = (path, role, method = 'GET', body, extra = {}) => fetch(base + path, { method, headers: {
  'Content-Type': 'application/json', ...(role ? { Authorization: `Bearer ${String(roles.indexOf(role) + 1).repeat(44)}` } : {}), ...extra,
}, body: body === undefined ? undefined : JSON.stringify(body) });
const vendor = { name: 'Test Printer', email: 'printer@example.com', contact_name: '', phone: '', service: 'both', is_active: true };
try {
  assert.equal((await call('/api/vendors')).status, 401);
  for (const role of ['employee', 'finance', 'finance_head']) {
    assert.equal((await call('/api/vendors', role)).status, 403);
    assert.equal((await call('/api/vendor-cards', role)).status, 403);
    assert.equal((await call('/api/vendor-cards/send', role, 'POST', {})).status, 403);
  }
  assert.equal((await call('/api/vendors', 'center_admin')).status, 200);
  assert.equal((await call('/api/vendors', 'center_admin', 'POST', vendor)).status, 403);
  assert.equal((await call('/api/vendors/1', 'center_admin', 'PUT', vendor)).status, 403);
  assert.equal((await call('/api/vendor-cards/999', 'center_admin')).status, 404);
  assert.equal((await call('/api/vendor-cards/1/reconcile', 'center_admin', 'POST', {})).status, 403);
  assert.equal((await call('/api/vendors', 'hq_admin', 'POST', vendor)).status, 201);
  assert.equal((await call('/api/vendors', 'super_admin', 'POST', vendor)).status, 201);
  assert.equal(writes, 4, 'only permitted vendor creation and audit writes');
  assert.equal((await call('/api/vendors', 'hq_admin', 'POST', { ...vendor, email: 'a@example.com,b@example.com' })).status, 400);
  assert.equal((await call('/api/vendors', 'hq_admin', 'POST', vendor, { Origin: 'https://untrusted.example' })).status, 403);
  for (let i = 0; i < 5; i++) assert.equal((await call('/api/vendor-cards/send', 'hq_admin', 'POST', {})).status, 400);
  const limited = await call('/api/vendor-cards/send', 'hq_admin', 'POST', {});
  assert.equal(limited.status, 429); assert.ok(limited.headers.has('retry-after'));
  console.log('PASS: actual HTTP routers and authentication middleware; 401/403 guards; center read-only vendors; HQ/Super creation and audit; missing scoped card; CSRF; recipient validation; send rate limit. Mock SQL only.');
} finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
