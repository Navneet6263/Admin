// Local UI-only smoke test: no production credentials or database writes.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";

const root = fileURLToPath(new URL("../", import.meta.url));
const out = path.resolve(root, "../scratch/request-studio-preview");
await mkdir(out, { recursive: true });
const { chromium } = await import(process.env.REQUESTHUB_PLAYWRIGHT_MODULE || "playwright");
const entry = `
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {NewRequestDialog} from '/src/components/NewRequestDialog';
import '/src/styles.css';
const centers=[{code:'A11NOIDA',name:'A-11',city:'Noida'},{code:'TEST',name:'Test Center',city:'Delhi'}];
const profile={id:123,name:'Navneet Kumar',employee_code:'EMP-0123',company:'GreenCall',dept:'Operations',email:'test@example.com',center_code:'A11NOIDA'};
function App(){const [open,setOpen]=useState(true);return React.createElement(React.Fragment,null,
React.createElement('button',{onClick:()=>setOpen(true)},'Open request'),
React.createElement(NewRequestDialog,{open,centers,employeeProfile:profile,homeCenter:'A11NOIDA',onClose:()=>setOpen(false),onSubmit:async(draft)=>{window.testDraft=draft;}}));}
createRoot(document.getElementById('root')).render(React.createElement(App));`;
const server = await createServer({ root, configFile: false, logLevel: "error",
  resolve: { alias: { "@": path.join(root, "src") } },
  plugins: [react(), tailwind(), { name: "request-studio-smoke",
    resolveId(id) { if (id === "virtual:request-studio-test") return "\0request-studio-test.js"; },
    load(id) { if (id === "\0request-studio-test.js") return entry; },
    configureServer(instance) { instance.middlewares.use(async (req, res, next) => {
      if (req.url !== "/") return next();
      res.setHeader("Content-Type", "text/html");
      res.end(await instance.transformIndexHtml("/", '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/@id/virtual:request-studio-test"></script></body></html>'));
    }); } }], server: { host: "127.0.0.1", port: 0 } });
let browser;
try {
  await server.listen(); browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  const errors = [], apiCalls = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/**", async (route) => { apiCalls.push(route.request().method()); await route.fulfill({json: []}); });
  await page.goto(server.resolvedUrls.local[0]);
  await page.locator(".request-studio-panel").waitFor();
  await page.evaluate(() => document.fonts.ready);
  const body = page.locator(".request-studio-body");
  const story = page.locator(".request-studio-story");
  assert.equal(await page.locator(".request-studio").evaluate((el) => Number(getComputedStyle(el).zoom)), .8);
  assert.equal(await page.evaluate(() => Number(getComputedStyle(document.documentElement).zoom)), 1);
  assert.equal(Math.round((await page.locator(".request-studio-panel").boundingBox()).width), 672, "840px form rendered at 80% density");
  await page.getByRole("combobox").first().focus();
  const centerBox = await page.getByRole("combobox").first().boundingBox();
  const listBox = await page.getByRole("listbox").boundingBox();
  assert.ok(Math.abs(centerBox.x - listBox.x) < 2 && Math.abs(centerBox.width - listBox.width) < 2, "Portal dropdown follows scaled input");
  await page.getByRole("option",{name:/TEST/}).click();
  await page.getByRole("combobox").first().focus();
  await page.getByRole("option",{name:/A11NOIDA/}).click();
  const footerVisible = async () => {
    const box = await page.locator(".request-studio-footer").boundingBox();
    assert.ok(box.y >= 0 && box.y + box.height <= page.viewportSize().height + 1);
  };
  assert.equal(await page.locator(".request-card-gallery--id button").count(), 7);
  await page.getByRole("button",{name:"Choose GreenCall ID card",exact:true}).click();
  assert.equal(await page.locator(".request-card-gallery").count(), 0, "Other designs disappear");
  assert.equal(await story.locator(".selected-card-preview").count(), 1);
  assert.equal(await story.locator("svg").count(), 2, "Only selected front/back shown");
  assert.equal(await page.getByRole("button",{name:/Continue|Back|Download PDF preview/}).count(), 0);
  assert.equal(await page.locator(".card-step-progress").count(), 0);
  await body.locator('input[type="tel"]').fill("9876543210");
  await body.locator("select").nth(1).selectOption("AB+");
  assert.ok((await story.textContent()).includes("9876543210"));
  const photo = await page.evaluate(() => { const c=document.createElement("canvas"); c.width=200; c.height=240; const x=c.getContext("2d"); x.fillStyle="#567"; x.fillRect(0,0,200,240); return c.toDataURL("image/png").split(",")[1]; });
  await page.locator('input[type="file"]').setInputFiles({name:"test-photo.png",mimeType:"image/png",buffer:Buffer.from(photo,"base64")});
  await page.getByAltText("Crop source").waitFor();
  assert.equal(await page.getByAltText("Crop source").evaluate((el) => el.closest(".request-studio")), null, "Cropper is outside scaled panel");
  const cropAction = await page.getByRole("button",{name:"Use this crop",exact:true}).boundingBox();
  assert.ok(cropAction.y + cropAction.height <= page.viewportSize().height);
  await page.getByRole("button",{name:"Use this crop",exact:true}).click();
  assert.ok(await story.locator('svg image').evaluateAll((images) => images.some((img) => img.getAttribute("href")?.startsWith("data:image/jpeg"))));
  await body.locator("textarea").fill("New employee card needed");
  await page.getByLabel("Details verified").check();
  assert.equal(await page.getByRole("button",{name:"Submit request",exact:true}).isEnabled(), true);
  await page.setViewportSize({width:1366,height:768}); await footerVisible();
  await page.screenshot({path:path.join(out,"id-card-single-form.png")});
  for (const brand of ["vision_india","talent_foundation","north_star_avantika","north_star_bgcl","north_star_ioag","north_star_iocl","green_call"]) {
    await page.getByLabel("ID-card format",{exact:true}).selectOption(brand);
    assert.equal(await story.locator(".selected-card-preview").count(), 1);
    assert.equal(await story.locator("svg").count(), 2);
    assert.equal(await page.locator(".request-card-gallery").count(), 0);
    assert.equal(await page.getByLabel("Details verified").isChecked(), false);
  }
  await page.getByRole("button",{name:"Visiting Card",exact:true}).click();
  assert.equal(await page.locator(".request-card-gallery--visiting button").count(), 4);
  await page.getByRole("button",{name:"Choose Talent Foundation visiting card",exact:true}).click();
  assert.equal(await page.locator(".request-card-gallery").count(), 0);
  assert.equal(await story.locator("svg").count(), 2);
  await page.getByLabel("Full name",{exact:true}).fill("Navneet Kumar");
  await page.getByLabel("Designation",{exact:true}).fill("Operations Manager");
  await page.getByLabel("Phone",{exact:true}).fill("9876543210");
  await page.getByLabel("Work email",{exact:true}).fill("test@example.com");
  assert.ok((await story.textContent()).includes("Operations Manager"));
  assert.ok(await body.evaluate((el) => el.scrollHeight - el.clientHeight <= 1), "Visiting form fits laptop without scrolling");
  await page.getByLabel("I verified all card details").check();
  await page.screenshot({path:path.join(out,"visiting-card-single-form.png")});
  await page.getByLabel("Company card",{exact:true}).selectOption("green_call");
  assert.equal(await page.getByLabel("Full name",{exact:true}).inputValue(), "Navneet Kumar");
  assert.equal(await page.getByLabel("I verified all card details").isChecked(), false);
  for (const name of ["Stationery","Travel Booking","Courier / Dispatch","Meeting Room","Food / Catering","ID Card"]) {
    await page.getByRole("button",{name,exact:true}).click(); await footerVisible();
  }
  for (const viewport of [{width:1024,height:768},{width:390,height:844},{width:320,height:640}]) {
    await page.setViewportSize(viewport); await footerVisible();
    assert.equal(await page.locator(".request-studio").evaluate((el) => Number(getComputedStyle(el).zoom)), 1, "Tablet/mobile keep normal-sized touch targets");
    assert.equal(await page.locator(".selected-card-mobile").isVisible(), true);
    assert.ok(await body.evaluate((el) => el.scrollWidth - el.clientWidth <= 1));
    await body.evaluate((el) => el.scrollTop=el.scrollHeight);
    await page.screenshot({path:path.join(out,`single-form-${viewport.width}.png`)});
  }
  await page.getByRole("button",{name:"Close new request",exact:true}).click();
  assert.notEqual(await page.evaluate(() => document.body.style.overflow), "hidden");
  await page.getByRole("button",{name:"Open request",exact:true}).click();
  assert.equal(await page.locator(".request-card-gallery--id button").count(), 7, "Fresh request restores gallery");
  await page.getByRole("button",{name:"Visiting Card",exact:true}).click();
  await page.getByLabel("Company card",{exact:true}).selectOption("talent_foundation");
  await page.getByLabel("Full name",{exact:true}).fill("Test Employee");
  await page.getByLabel("Designation",{exact:true}).fill("Developer");
  await page.getByLabel("Phone",{exact:true}).fill("9876543210");
  await page.getByLabel("Work email",{exact:true}).fill("test@example.com");
  await page.getByLabel("I verified all card details").check();
  await page.getByRole("button",{name:"Submit request",exact:true}).click();
  const draft = await page.evaluate(() => window.testDraft);
  assert.equal(draft.type,"visiting_card");
  assert.equal(draft.details.brand,"talent_foundation");
  assert.equal(draft.details.name,"Test Employee");
  assert.equal(draft.details.confirmed,true);
  assert.ok(apiCalls.every((method) => method === "GET"));
  assert.deepEqual(errors, []);
  console.log("PASS: gallery collapses to selected live front/back; all ID formats; photo and text sync; single-form submission; confirmation resets; mobile inline preview; fixed footer; fresh-open reset; no production writes");
} finally { await browser?.close(); await server.close(); }
