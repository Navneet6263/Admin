// Isolated browser smoke test. No API calls, logins or database writes.
// Set REQUESTHUB_PLAYWRIGHT_MODULE to a local playwright index.mjs if needed.
import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";

const root = fileURLToPath(new URL("../", import.meta.url));
const out = path.resolve(root, "../scratch/id-card-test-results");
await mkdir(out, { recursive: true });
const { chromium } = await import(process.env.REQUESTHUB_PLAYWRIGHT_MODULE || "playwright");
const entry = `
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';
import { IdCardForm } from '/src/components/id-card/IdCardForm';
import { emptyIdCard, idCardDetails, idCardValid, summarizeIdCard } from '/src/components/id-card/idCardFormState';
import { ID_CARD_NAMES, isIdCardBrand } from '/src/components/id-card/idCardTemplates';
import { idCardSvg, safeIdPhoto } from '/src/components/id-card/idCardSvg';
import { visionIndiaIdCardSvg } from '/src/components/id-card/visionIndiaIdCard';
const canvas = document.createElement('canvas'); canvas.width=480; canvas.height=560;
const ctx=canvas.getContext('2d'); ctx.fillStyle='#dbeafe'; ctx.fillRect(0,0,480,560);
ctx.fillStyle='#1e40af'; ctx.font='36px Arial'; ctx.fillText('TEST PHOTO',100,280);
const profile={id:123,name:'Navneet Kumar',employee_code:'EMP-0123',company:'GreenCall',dept:'Operations',email:'test@example.com',center_code:'TEST'};
function App() {
 const [value,setValue]=useState({...emptyIdCard(),designation:'Senior Operations Manager',phone:'9876543210',emergencyPhone:'9876501234',bloodGroup:'AB+',reason:'First employee card',photoDataUrl:canvas.toDataURL('image/png')});
 window.cardTest={value,profile,idCardValid,idCardDetails,details:idCardDetails(value,profile),valid:idCardValid(value,profile),summary:summarizeIdCard(value),names:ID_CARD_NAMES,isIdCardBrand,idCardSvg,safeIdPhoto,visionIndiaIdCardSvg};
 return React.createElement(React.Fragment,null,React.createElement(IdCardForm,{value,onChange:setValue,profile}),React.createElement(Toaster));
}
createRoot(document.getElementById('root')).render(React.createElement(App));`;

const server = await createServer({ root, configFile: false, logLevel: "error",
  resolve: { alias: { "@": path.join(root, "src") } },
  plugins: [react(), { name: "id-card-smoke", resolveId(id) { if (id === "virtual:id-card-test") return "\0id-card-test.tsx"; },
    load(id) { if (id === "\0id-card-test.tsx") return entry; },
    configureServer(instance) { instance.middlewares.use(async (req, res, next) => {
      if (req.url !== "/") return next();
      const html = await instance.transformIndexHtml("/", `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
      body{margin:0;background:#0f172a;color:white;font:14px Arial}#root{max-width:720px;margin:auto;padding:20px}select,input,textarea{padding:8px;max-width:100%;box-sizing:border-box}svg{max-width:100%}.grid-cols-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}.space-y-4>div{margin-bottom:16px}button{padding:10px}.sr-only{display:none}.h-3\\.5,.h-4{height:16px;width:16px}.h-16{height:64px}.w-14{width:56px}.h-full{height:100%}.w-full{width:100%}.object-contain{object-fit:contain}.text-sm{font-size:14px}.text-xs{font-size:12px}.text-white{color:white}label{display:block;margin:8px 0}.flex{display:flex;gap:8px}.rounded-xl{border-radius:12px}.bg-white{background:white}.overflow-hidden{overflow:hidden}
      </style></head><body><div id="root"></div><script type="module" src="/@id/virtual:id-card-test"></script></body></html>`);
      res.setHeader("Content-Type", "text/html"); res.end(html);
    }); } }], server: { host: "127.0.0.1", port: 0 } });

let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1100, height: 1000 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForFunction(() => Boolean(window.cardTest));
  const names = await page.evaluate(() => window.cardTest.names);
  assert.equal(Object.keys(names).length, 7);
  const sql = await readFile(path.resolve(root, "../admin-backend/src/services/requestCreation.ts"), "utf8");
  for (const brand of Object.keys(names)) {
    assert.ok(sql.includes(`'${brand}'`), `${brand} must be accepted by the backend`);
    await page.locator("select").first().selectOption(brand);
    assert.equal(await page.locator('input[type="text"]').count(), brand === "green_call" ? 0 : 1);
    assert.equal(await page.locator('input[type="tel"]').count(), brand === "vision_india" ? 2 : 1);
    const validation = await page.evaluate(() => {
      const t = window.cardTest;
      const valid = { ...t.value, confirmed: true };
      const noPhone = { ...valid, phone: "" };
      const noDesignation = { ...valid, designation: "" };
      const profile = { ...t.profile, dept: "" };
      return {
        noPhone: t.idCardValid(noPhone, profile),
        noDesignation: t.idCardValid(noDesignation, profile),
        noEmergency: t.idCardValid({ ...valid, emergencyPhone: "" }, profile),
        badEmergency: t.idCardValid({ ...valid, emergencyPhone: "987654321012" }, profile),
        noBlood: t.idCardValid({ ...valid, bloodGroup: "" }, profile),
        badBlood: t.idCardValid({ ...valid, bloodGroup: "invalid" }, profile),
        phone: t.idCardDetails(valid, profile).phone,
        designation: t.idCardDetails(valid, profile).designation,
      };
    });
    assert.equal(validation.noPhone, brand !== "vision_india");
    assert.equal(validation.noDesignation, brand === "green_call");
    assert.equal(validation.noEmergency || validation.badEmergency || validation.noBlood || validation.badBlood, false);
    if (brand !== "vision_india") assert.equal(validation.phone, "");
    if (brand === "green_call") assert.equal(validation.designation, "");
    assert.equal(await page.locator('input[type="checkbox"]').isChecked(), false);
    await page.locator('input[type="checkbox"]').check();
    const result = await page.evaluate(() => {
      const t = window.cardTest;
      const front = t.idCardSvg("front", t.details);
      const back = t.idCardSvg("back", t.details);
      return { brand: t.details.brand, valid: t.valid, subject: t.summary.subject,
        company: t.profile.company, hasCode: front.includes(t.details.employeeCode),
        hasEmergency: back.includes(t.details.emergencyPhone), escaped: t.idCardSvg("front", {...t.details,name:'<script>"&'}).includes("&lt;script&gt;"),
        unsafe: t.safeIdPhoto('https://example.com/photo.png'), unknown: t.isIdCardBrand('__proto__'),
        legacy: t.details.brand !== 'vision_india' || front === t.visionIndiaIdCardSvg('front',t.details) };
    });
    assert.equal(result.brand, brand); assert.equal(result.valid, true);
    assert.equal(result.company, "GreenCall"); assert.ok(result.subject.includes(names[brand]));
    assert.ok(result.hasCode && result.hasEmergency && result.escaped && result.legacy);
    assert.equal(result.unsafe, ""); assert.equal(result.unknown, false);
    const request = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download PDF preview" }).click();
    const download = await request;
    await download.saveAs(path.join(out, `${brand}.pdf`));
    const bytes = await readFile(path.join(out, `${brand}.pdf`));
    assert.equal(bytes.subarray(0, 4).toString(), "%PDF");
    assert.ok(bytes.length > 40000, "PDF must contain rendered card artwork");
    assert.ok(bytes.includes(Buffer.from("/Width 2160")), "PDF must render at the HD export width");
    if (brand !== "vision_india") {
      const svg = await readFile(path.resolve(root, `src/assets/id-card/${brand}-front.svg`), "utf8");
      assert.ok(svg.includes("<path"), "Card backgrounds must retain vector artwork");
      assert.equal(await page.locator('svg image').first().getAttribute("href").then((src) => src.includes(".svg")), true);
    }
    await page.locator(".grid-cols-2").nth(1).screenshot({ path: path.join(out, `${brand}.png`) });
    console.log(`PASS ${brand}: selected, validated, escaped, previewed and downloaded (${bytes.length} bytes)`);
  }
  await page.locator('input[type="text"]').first().fill("Updated designation");
  assert.equal(await page.locator('input[type="checkbox"]').isChecked(), false);
  assert.equal(await page.evaluate(() => window.cardTest.valid), false);
  await page.route("**/assets/id-card/*", (route) => route.fulfill({ status: 404, body: "Missing" }));
  await page.getByRole("button", { name: "Download PDF preview" }).click();
  await page.getByText("ID-card artwork could not be loaded. Please try again.", { exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Download PDF preview" }).isEnabled(), true);
  assert.deepEqual(errors, []);
  console.log("PASS confirmation reset and failed-artwork retry; no browser exceptions or database writes");
} finally {
  await browser?.close();
  await server.close();
}
