import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
const require = createRequire(import.meta.url);
process.env.NODE_ENV = 'test';
process.env.DB_SERVER = '127.0.0.1';
const { dispatchVendorCards } = require('../dist/services/vendorDispatch.js');
const { cardRevision, validatePdf, emailValid } = require('../dist/services/vendorPolicy.js');
const { deliveryFailure } = require('../dist/services/vendorMail.js');

const actor = { id: 1, role: 'hq_admin', center_code: null };
const vendor = { id: 1, email: 'printer@example.com', name: 'Printer', service: 'both', is_active: true };
const row = { id: 1, ref_id: 'TEST-001', type: 'visiting_card', status: 'approved', approval_center_code: 'A11',
  company: 'GC', company_name: 'GreenCall', details: JSON.stringify({ brand: 'green_call', qty: 100 }) };
const pdf = Buffer.from('%PDF-1.4\n' + 'test image document '.repeat(10) + '\n%%EOF').toString('base64');
function body() { return { key: randomUUID(), vendorId: 1, vendorEmail: vendor.email,
  cards: [{ id: 1, revision: cardRevision(row), verified: true, pdf, lastDeliveryId: null }] }; }
function fixture(options = {}) {
  const deliveries = new Map(); let count = 0, rollbacks = 0;
  const query = async (sql, p) => {
    if (sql.startsWith('SELECT id,actor_id')) return { recordset: deliveries.has(p.id) ? [deliveries.get(p.id)] : [] };
    if (sql.includes('SELECT * FROM vendors')) return { recordset: options.inactive ? [] : [{ ...vendor, ...options.vendor }] };
    if (sql.includes('FROM requests r')) {
      assert.match(sql, /UPDLOCK,HOLDLOCK/); assert.match(sql, /r\.status='approved'/);
      assert.match(sql, /admin_center_access/);
      const candidate = { ...row, ...options.card };
      const permitted = ['hq_admin', 'super_admin'].includes(p.role)
        || (p.role === 'center_admin' && (p.cc === candidate.approval_center_code || options.granted));
      return { recordset: permitted && candidate.status === 'approved' ? [candidate] : [] };
    }
    if (sql.includes('INSERT INTO vendor_deliveries')) deliveries.set(p.id, { id: p.id, actor_id: p.actor, payload_hash: p.hash, status: 'sending' });
    if (sql.includes('UPDATE vendor_deliveries SET status')) {
      if (options.finishFails) throw new Error('DB disconnected after SMTP');
      deliveries.get(p.id).status = p.status;
    }
    return { recordset: [] };
  };
  const request = () => { const p = {}; return { input(name, _type, value) { p[name] = value; return this; }, query(sql) { return query(sql, p); } }; };
  const database = { request, transaction() { return { request, async begin() {}, async commit() {}, async rollback() { rollbacks++; } }; } };
  return { dependencies: { database, settings() {}, async send(id, recipient, cards, attachments) {
    count++; assert.equal(recipient.email, vendor.email); assert.equal(cards[0].company_name, 'GreenCall');
    assert.equal(cards[0].quantity, 100); assert.ok(Buffer.isBuffer(attachments[0]));
    if (options.smtpError) throw options.smtpError;
    return `<${id}@example.com>`;
  } }, deliveries, get sends() { return count; }, get rollbacks() { return rollbacks; } };
}
async function rejects(input, status, options = {}, user = actor) {
  const f = fixture(options);
  await assert.rejects(() => dispatchVendorCards(user, input, f.dependencies), error => error.status === status);
  assert.equal(f.sends, 0);
}

assert.equal(emailValid('printer@example.com'), true);
assert.equal(emailValid('a@example.com,b@example.com'), false);
assert.equal(emailValid('a@example.com\r\nBcc: b@example.com'), false);
assert.throws(() => validatePdf(Buffer.from('<script>bad</script>').toString('base64')));
assert.throws(() => validatePdf(Buffer.from('%PDF-1.4\n' + ' '.repeat(100) + '/JavaScript (bad)\n%%EOF').toString('base64')));
assert.equal(deliveryFailure({ code: 'EAUTH' }), 'failed');
assert.equal(deliveryFailure({ code: 'ETIMEDOUT' }), 'unknown');
assert.equal(deliveryFailure({ responseCode: 550 }), 'failed');
await rejects({ ...body(), cards: [] }, 400);
await rejects({ ...body(), cards: [null] }, 400);
const unverified = body(); unverified.cards[0].verified = false; await rejects(unverified, 400);
const duplicate = body(); duplicate.cards.push(duplicate.cards[0]); await rejects(duplicate, 400);
const changed = body(); changed.cards[0].revision = 'wrong'; await rejects(changed, 409);
await rejects(body(), 409, { inactive: true });
await rejects(body(), 400, { vendor: { service: 'id_card' } });
await rejects(body(), 404, { card: { status: 'pending' } });
await rejects(body(), 404, {}, { ...actor, role: 'employee' });
await rejects(body(), 404, {}, { ...actor, role: 'center_admin', center_code: 'OTHER' });
await rejects(body(), 409, { card: { delivery_status: 'sent' } });
await rejects({ ...body(), resend: true }, 409, { card: { delivery_status: 'unknown' } });
await rejects(body(), 409, { card: { delivery_id: randomUUID(), delivery_status: 'sent' } });
const f = fixture(); const input = body();
assert.equal((await dispatchVendorCards(actor, input, f.dependencies)).status, 'sent');
assert.equal((await dispatchVendorCards(actor, input, f.dependencies)).status, 'sent');
assert.equal(f.sends, 1, 'same dispatch key must not send twice');
await assert.rejects(() => dispatchVendorCards({ ...actor, id: 2 }, input, f.dependencies), error => error.status === 409);
const scoped = fixture({ granted: true });
assert.equal((await dispatchVendorCards({ ...actor, role: 'center_admin', center_code: 'OTHER' }, body(), scoped.dependencies)).status, 'sent');
const resend = fixture({ card: { delivery_status: 'sent' } });
assert.equal((await dispatchVendorCards(actor, { ...body(), resend: true }, resend.dependencies)).status, 'sent');
const failed = fixture({ smtpError: { code: 'EAUTH' } });
assert.equal((await dispatchVendorCards(actor, body(), failed.dependencies)).status, 'failed');
const unknown = fixture({ smtpError: { code: 'ETIMEDOUT' } });
assert.equal((await dispatchVendorCards(actor, body(), unknown.dependencies)).status, 'unknown');
const interrupted = fixture({ finishFails: true }); const interruptedBody = body();
await assert.rejects(() => dispatchVendorCards(actor, interruptedBody, interrupted.dependencies));
assert.equal((await dispatchVendorCards(actor, interruptedBody, interrupted.dependencies)).status, 'sending');
assert.equal(interrupted.sends, 1, 'no duplicate after SMTP succeeds but final DB update fails');
console.log('PASS: vendor validation; PDF validation; verification gate; approval/scope guards; revision checks; supported service; duplicate/idempotent/resend checks; SMTP failure/uncertainty; post-send DB failure. Mock database and sender only.');
