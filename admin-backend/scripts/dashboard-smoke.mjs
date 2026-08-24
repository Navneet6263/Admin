const base = (process.env.TEST_BASE_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');
const origin = process.env.TEST_ORIGIN || 'https://admin.greencall.online';
if (!process.env.TEST_EMAIL || !process.env.TEST_PASSWORD) {
  throw new Error('TEST_EMAIL and TEST_PASSWORD are required');
}

async function call(path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    method: options.method || 'GET',
    headers: { ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(options.cookie ? { Cookie: options.cookie } : {}), Origin: origin },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

function pass(label, condition) {
  if (!condition) throw new Error(`FAIL ${label}`);
  console.log(`PASS ${label}`);
}

const login = await call('/api/auth/login', { method: 'POST', body: {
  email: process.env.TEST_EMAIL, password: process.env.TEST_PASSWORD,
} });
pass('dashboard test login', login.response.status === 200);
const cookie = (login.response.headers.get('set-cookie') || '').split(';')[0];

const centers = await call('/api/centers', { cookie });
pass('center directory', centers.response.status === 200 && Array.isArray(centers.data));
const centerCode = centers.data[0]?.code;
if (!centerCode) throw new Error('No active center is available for dashboard smoke testing');

const centerQuery = `?center_code=${encodeURIComponent(centerCode)}`;
const [overview, activity, inventory, finance, policies] = await Promise.all([
  call(`/api/center-admin/overview${centerQuery}`, { cookie }),
  call(`/api/center-admin/activity${centerQuery}`, { cookie }),
  call(`/api/center-admin/inventory-view${centerQuery}`, { cookie }),
  call('/api/payments/head-dashboard', { cookie }),
  call('/api/super-admin/policies', { cookie }),
]);
pass('Center Admin overview', overview.response.status === 200 && overview.data.center?.code === centerCode);
pass('Center Admin activity logs', activity.response.status === 200 && Array.isArray(activity.data));
pass('Center Admin inventory view', inventory.response.status === 200 && Array.isArray(inventory.data));
pass('Finance Head dashboard', finance.response.status === 200 && finance.data.metrics && Array.isArray(finance.data.activity));
pass('Finance Head default policy', policies.response.status === 200
  && policies.data.some((row) => row.role === 'finance_head' && row.can_view && row.can_view_analytics));

await call('/api/auth/logout', { method: 'POST', cookie, body: {} });
