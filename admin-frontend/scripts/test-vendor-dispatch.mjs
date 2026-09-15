import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = path.resolve(root, '../scratch/vendor-dispatch-preview');
await mkdir(out, { recursive: true });
const { chromium } = await import(process.env.REQUESTHUB_PLAYWRIGHT_MODULE || 'playwright');
const entry = `import React,{useState} from 'react';import{createRoot}from'react-dom/client';
import{VendorSendDialog}from'/src/components/vendors/VendorSendDialog';
import{VendorManager}from'/src/components/vendors/VendorManager';
import{VendorCardsPanel}from'/src/components/vendors/VendorCardsPanel';
import'/src/styles.css';const h=React.createElement;function App(){const[open,setOpen]=useState(false);return h(React.Fragment,null,
h('button',{onClick:()=>setOpen(true)},'Open send'),h(VendorManager),h(VendorCardsPanel),
open&&h(VendorSendDialog,{ids:[1,2],onClose:()=>setOpen(false),onSent:()=>{window.sent=true}}));}
createRoot(document.getElementById('root')).render(h(App));`;
const server = await createServer({ root, configFile: false, logLevel: 'error', resolve: { alias: { '@': path.join(root, 'src') } },
  plugins: [react(), tailwind(), { name: 'vendor-test', resolveId(id) { if (id === 'virtual:vendor-test') return '\0vendor-test.jsx'; },
    load(id) { if (id === '\0vendor-test.jsx') return entry; }, configureServer(instance) {
      instance.middlewares.use(async (req, res, next) => {
        if (req.url !== '/') return next();
        res.setHeader('Content-Type', 'text/html');
        res.end(await instance.transformIndexHtml('/', '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/@id/virtual:vendor-test"></script></body></html>'));
      });
    } }], server: { host: '127.0.0.1', port: 0 } });
const vendor = { id: 7, name: 'Test Printing Partner', email: 'printer@example.com', contact_name: 'Print Desk', phone: '', service: 'both', is_active: true };
const cards = [
  { id: 1, ref_id: 'TEST-001', type: 'id_card', subject: 'Test ID Card', company_name: 'Vision India', quantity: 1, revision: 'a'.repeat(64), delivery_id: null,
    details: { brand: 'vision_india', name: 'Test Employee', employeeCode: 'TEST-01', designation: 'Developer', department: 'IT', phone: '9876543210', bloodGroup: 'O+', emergencyPhone: '9876543210' } },
  { id: 2, ref_id: 'TEST-002', type: 'visiting_card', subject: 'Test Visiting Card', company_name: 'GreenCall', quantity: 100, revision: 'b'.repeat(64), delivery_id: null,
    details: { brand: 'green_call', name: 'Test Employee', designation: 'Developer', phone: '9876543210', email: 'test@example.com', address: '', qty: 100 } },
];
let browser;
try {
  await server.listen(); browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = [], sends = [], saves = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/vendor-cards/send') {
      sends.push(route.request().postDataJSON()); return route.fulfill({ json: { id: 'test', status: 'sent' } });
    }
    if (url.pathname === '/api/vendors' && route.request().method() === 'POST') {
      saves.push(route.request().postDataJSON()); return route.fulfill({ json: { id: 8 }, status: 201 });
    }
    if (url.pathname === '/api/vendors') return route.fulfill({ json: { items: [vendor], total: 1, page: 1 } });
    if (url.pathname === '/api/vendor-cards') return route.fulfill({ json: { items: cards, total: 2, page: 1 } });
    const id = Number(url.pathname.split('/').at(-1));
    if (cards[id - 1]) return route.fulfill({ json: cards[id - 1] });
    throw new Error(`Unexpected request ${url}`);
  });
  await page.goto(server.resolvedUrls.local[0]);
  await page.getByLabel('Vendor / business name *').fill('New Vendor');
  await page.getByLabel('Email *', { exact: true }).fill('new@example.com');
  await page.getByRole('button', { name: 'Create vendor', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('input').value === '');
  assert.equal(saves.length, 1); assert.equal(saves[0].service, 'both');
  await page.getByRole('button', { name: 'Open send', exact: true }).click();
  const dialog = page.getByRole('dialog').last();
  await dialog.getByRole('checkbox').first().waitFor({ state: 'visible', timeout: 30000 });
  await dialog.getByLabel('Select vendor', { exact: true }).selectOption('7');
  const send = dialog.getByRole('button', { name: 'Send to vendor', exact: true });
  assert.equal(await send.isDisabled(), true);
  await dialog.getByRole('checkbox').first().check();
  assert.equal(await send.isDisabled(), true, 'every selected template must be verified');
  await dialog.getByRole('button', { name: 'Next card' }).click();
  await dialog.getByRole('checkbox').first().check();
  assert.equal(await send.isEnabled(), true);
  const footer = await send.boundingBox(); assert.ok(footer.y + footer.height <= 768, 'send visible at 100% zoom');
  await page.screenshot({ path: path.join(out, 'verify-desktop.png') });
  await page.setViewportSize({ width: 390, height: 700 });
  await page.waitForTimeout(350);
  const mobileFooter = await send.boundingBox();
  assert.ok(mobileFooter.y + mobileFooter.height <= 700 && mobileFooter.x >= 0 && mobileFooter.x + mobileFooter.width <= 390, 'mobile footer visible');
  await page.screenshot({ path: path.join(out, 'verify-mobile.png') });
  await send.click(); await dialog.getByText(/Sent to vendor. Email accepted/).waitFor();
  assert.equal(sends.length, 1); assert.equal(sends[0].cards.length, 2);
  assert.ok(sends[0].cards.every(card => card.verified && Buffer.from(card.pdf, 'base64').subarray(0, 5).toString() === '%PDF-'));
  assert.equal(sends[0].vendorEmail, vendor.email); assert.equal(await send.isDisabled(), true);
  assert.deepEqual(errors, []);
  console.log('PASS: vendor creation; approved bulk PDF preparation; per-card verification; exact PDFs; recipient; single send; desktop/mobile footer. Mock API only, no DB writes or real emails.');
} finally { await browser?.close(); await server.close(); }
