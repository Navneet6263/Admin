const base = (process.env.TEST_BASE_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');
const origin = process.env.TEST_ORIGIN || 'https://admin.greencall.online';
const credentials = Boolean(process.env.TEST_EMAIL && process.env.TEST_PASSWORD);

async function call(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${base}${path}`, {
    method: options.method || 'GET', headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    redirect: 'manual',
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

function expect(label, actual, expected) {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, received ${actual}`);
  console.log(`PASS ${label}: ${actual}`);
}

for (const path of ['/api/teams', '/api/companies', '/api/centers/public', '/api/employee/receipts/pending']) {
  const { response } = await call(path);
  expect(`unauthenticated ${path}`, response.status, 401);
}

const malformed = await call('/api/auth/me', { headers: { Authorization: 'Bearer invalid' } });
expect('malformed bearer token', malformed.response.status, 401);

const crossSite = await call('/api/auth/login', {
  method: 'POST', headers: { Origin: 'https://evil.example', 'Sec-Fetch-Site': 'cross-site' },
  body: { email: 'nobody@example.com', password: 'invalid' },
});
expect('cross-site login', crossSite.response.status, 403);

const registration = await call('/api/auth/register', {
  method: 'POST', headers: { Origin: origin }, body: {},
});
expect('public registration disabled', registration.response.status, 403);

if (!credentials) {
  console.log('Authenticated checks skipped: set TEST_EMAIL and TEST_PASSWORD.');
} else {
const login = await call('/api/auth/login', {
  method: 'POST', headers: { Origin: origin },
  body: { email: process.env.TEST_EMAIL, password: process.env.TEST_PASSWORD },
});
expect('valid login', login.response.status, 200);
expect('token absent from JSON', Object.hasOwn(login.data, 'token'), false);
const setCookie = login.response.headers.get('set-cookie') || '';
for (const attribute of ['__Host-requesthub_session=', 'HttpOnly', 'Secure', 'SameSite=Strict']) {
  expect(`session cookie ${attribute}`, setCookie.includes(attribute), true);
}
const cookie = setCookie.split(';')[0];
const me = await call('/api/auth/me', { headers: { Cookie: cookie } });
expect('session lookup', me.response.status, 200);
const role = login.data.user?.role;
if (role !== 'super_admin') {
  const superAdmin = await call('/api/super-admin/stats', { headers: { Cookie: cookie } });
  expect(`${role} blocked from Super Admin API`, superAdmin.response.status, 403);
}
if (role === 'employee') {
  const requests = await call('/api/requests', { headers: { Cookie: cookie } });
  expect('employee request list', requests.response.status, 200);
  expect('employee request ownership filter',
    requests.data.every((row) => Number(row.user_id) === Number(login.data.user.id)), true);
  const otherUser = await call(`/api/employee/requests/${Number(login.data.user.id) + 1}`, {
    headers: { Cookie: cookie },
  });
  expect('employee IDOR blocked', otherUser.response.status, 403);
  const selfCenterChange = await call('/api/centers/join-by-code', {
    method: 'POST', headers: { Cookie: cookie, Origin: origin }, body: { center_code: 'TEST' },
  });
  expect('employee self-center change blocked', selfCenterChange.response.status, 403);
}
if (role === 'finance' || role === 'finance_head' || role === 'verifier') {
  const broadRequests = await call('/api/requests', { headers: { Cookie: cookie } });
  expect(`${role} blocked from broad request API`, broadRequests.response.status, 403);
}
const logout = await call('/api/auth/logout', {
  method: 'POST', headers: { Cookie: cookie, Origin: origin },
});
expect('logout', logout.response.status, 200);
const replay = await call('/api/auth/me', { headers: { Cookie: cookie } });
expect('revoked session replay', replay.response.status, 401);
}
