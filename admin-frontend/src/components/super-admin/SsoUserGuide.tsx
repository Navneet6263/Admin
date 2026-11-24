import { useState } from "react";
import { ArrowRight, BookOpen, Check, Copy, ShieldCheck, TriangleAlert } from "lucide-react";
import { apiBaseUrl } from "@/lib/api";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return <button type="button" onClick={() => { void navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }); }}
    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50">
    {done ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}{done ? "Copied" : label}</button>;
}

function Code({ code, title, tone = "text-slate-100" }: { code: string; title?: string; tone?: string }) {
  return <div>
    {title && <div className="mb-1 flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{title}</span><CopyButton text={code} /></div>}
    <pre className={`overflow-x-auto rounded-lg bg-slate-900 p-3 text-[11px] leading-5 ${tone}`}>{code}</pre>
  </div>;
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return <li className="flex gap-3">
    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-indigo-600 text-[11px] font-bold text-white">{n}</span>
    <div className="min-w-0 flex-1 pb-1"><p className="text-[13px] font-semibold text-slate-900">{title}</p>
      <div className="mt-1 space-y-2 text-xs leading-5 text-slate-600">{children}</div></div>
  </li>;
}

function Table({ head, rows }: { head: string[]; rows: (string | React.ReactNode)[][] }) {
  return <div className="overflow-x-auto rounded-lg border border-slate-200">
    <table className="w-full min-w-[560px] text-[11px]">
      <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr>{head.map((title) => <th key={title} className="px-3 py-2 text-left font-semibold">{title}</th>)}</tr></thead>
      <tbody className="divide-y divide-slate-100">{rows.map((row, index) => <tr key={index}>{row.map((cell, i) =>
        <td key={i} className={`px-3 py-2 align-top ${i === 0 ? "font-mono text-slate-800" : "text-slate-600"}`}>{cell}</td>)}</tr>)}</tbody>
    </table>
  </div>;
}

const Note = ({ tone = "info", children }: { tone?: "info" | "warn"; children: React.ReactNode }) =>
  <div className={`flex gap-2 rounded-lg border px-3 py-2 text-xs leading-5 ${tone === "warn" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-indigo-100 bg-indigo-50 text-indigo-900"}`}>
    {tone === "warn" ? <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />}<div>{children}</div></div>;

type Section = "flow" | "admin" | "developer" | "test" | "help";

/** Full step-by-step SSO guide shown inside Super Admin → SSO, for admins and the Green HR developers. */
export function SsoUserGuide() {
  const [section, setSection] = useState<Section>("flow");
  const [lang, setLang] = useState<"node" | "php" | "python" | "curl">("node");
  const portal = (apiBaseUrl || window.location.origin).replace(/\/+$/, "");
  const endpoint = `${portal}/api/sso/v1/login-link`;

  const samples: Record<typeof lang, { label: string; code: string }> = {
    node: { label: "Node.js (Express)", code: `// Green HR backend — the "Admin Portal" button opens this route.
// Store the key in an environment variable, never in frontend code.
app.get('/admin-portal', requireLogin, async (req, res) => {
  const emp = req.user; // the employee logged in to Green HR

  const response = await fetch('${endpoint}', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': process.env.ADMIN_PORTAL_SSO_KEY,
    },
    body: JSON.stringify({
      employee_code: emp.employeeCode,   // required
      name: emp.fullName,                // required
      company: emp.companyName,          // required (e.g. "Sapling Global" or "SAP")
      center_code: emp.branchCode,       // optional (e.g. "A43")
      department: emp.department,        // optional
      designation: emp.designation,      // optional
      mobile: emp.mobile,                // optional
      email: emp.officialEmail,          // optional
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error('Admin Portal SSO failed', response.status, data.error);
    return res.status(502).send('Admin Portal is not available right now: ' + data.message);
  }
  return res.redirect(data.login_url); // valid for 60 seconds, one use only
});` },
    php: { label: "PHP", code: `<?php
// Green HR backend — admin-portal.php (the "Admin Portal" button opens this page).
$emp = current_employee(); // the employee logged in to Green HR

$payload = json_encode([
  'employee_code' => $emp['employee_code'],   // required
  'name'          => $emp['full_name'],       // required
  'company'       => $emp['company_name'],    // required
  'center_code'   => $emp['branch_code'],     // optional
  'department'    => $emp['department'],      // optional
  'designation'   => $emp['designation'],     // optional
  'mobile'        => $emp['mobile'],          // optional
  'email'         => $emp['official_email'],  // optional
]);

$ch = curl_init('${endpoint}');
curl_setopt_array($ch, [
  CURLOPT_POST           => true,
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_TIMEOUT        => 10,
  CURLOPT_HTTPHEADER     => [
    'Content-Type: application/json',
    'X-API-Key: ' . getenv('ADMIN_PORTAL_SSO_KEY'),
  ],
  CURLOPT_POSTFIELDS     => $payload,
]);
$body   = curl_exec($ch);
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$data = json_decode($body, true);
if ($status !== 200) {
  http_response_code(502);
  exit('Admin Portal is not available right now: ' . ($data['message'] ?? 'unknown error'));
}
header('Location: ' . $data['login_url']); // valid for 60 seconds, one use only
exit;` },
    python: { label: "Python (Flask)", code: `# Green HR backend — the "Admin Portal" button opens this route.
import os, requests
from flask import redirect

@app.get("/admin-portal")
@login_required
def admin_portal():
    emp = current_employee()  # the employee logged in to Green HR
    response = requests.post(
        "${endpoint}",
        headers={"X-API-Key": os.environ["ADMIN_PORTAL_SSO_KEY"]},
        json={
            "employee_code": emp.employee_code,  # required
            "name": emp.full_name,               # required
            "company": emp.company_name,         # required
            "center_code": emp.branch_code,      # optional
            "department": emp.department,        # optional
            "designation": emp.designation,      # optional
            "mobile": emp.mobile,                # optional
            "email": emp.official_email,         # optional
        },
        timeout=10,
    )
    data = response.json()
    if response.status_code != 200:
        return f"Admin Portal is not available right now: {data.get('message')}", 502
    return redirect(data["login_url"])  # valid for 60 seconds, one use only` },
    curl: { label: "cURL (quick test)", code: `curl -X POST "${endpoint}" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: amsso_xxxxxxxx_<secret>" \\
  -d '{
    "employee_code": "GC-1042",
    "name": "Navneet Kumar",
    "company": "Sapling Global",
    "center_code": "A43",
    "department": "Operations",
    "designation": "Executive",
    "mobile": "9876543210",
    "email": "navneet@example.com"
  }'` },
  };

  const tabs: { key: Section; label: string }[] = [
    { key: "flow", label: "1. How it works" }, { key: "admin", label: "2. Admin setup" },
    { key: "developer", label: "3. Developer guide (Green HR)" }, { key: "test", label: "4. Test & demo" }, { key: "help", label: "5. Troubleshooting" },
  ];
  const flow = [
    ["Employee", "Clicks “Admin Portal” inside Green HR."],
    ["Green HR server", "Calls our API with the API key and the employee's details."],
    ["Admin Portal API", "Checks the key, creates or updates the employee, returns a one-time login_url."],
    ["Green HR server", "Redirects the employee's browser to login_url."],
    ["Employee", "Lands on their Admin Portal dashboard — already signed in."],
  ];

  return <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
    <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-4">
      <BookOpen className="h-5 w-5 text-indigo-600" />
      <div><h3 className="text-sm font-semibold text-slate-900">SSO user guide</h3>
        <p className="text-[11px] text-slate-500">Everything needed to connect Green HR to the Admin Portal, step by step.</p></div>
    </div>
    <div className="flex gap-1 overflow-x-auto overflow-y-hidden border-b border-slate-100 px-3">
      {tabs.map((tab) => <button key={tab.key} type="button" onClick={() => setSection(tab.key)}
        className={`shrink-0 border-b-2 px-3 py-2.5 text-xs font-semibold ${section === tab.key ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>{tab.label}</button>)}
    </div>

    <div className="space-y-5 p-5">
      {section === "flow" && <>
        <p className="text-xs leading-5 text-slate-700">An employee who is logged in to Green HR opens the Admin Portal with one click. No password and no registration. Green HR's server vouches for the employee using a secret API key.</p>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch">
          {flow.map(([who, what], index) => <div key={index} className="flex flex-1 items-center gap-2 lg:flex-col lg:items-stretch">
            <div className="flex-1 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Step {index + 1} · {who}</p>
              <p className="mt-1 text-xs leading-5 text-slate-700">{what}</p>
            </div>
            {index < flow.length - 1 && <ArrowRight className="h-4 w-4 shrink-0 rotate-90 self-center text-slate-400 lg:rotate-0" />}
          </div>)}
        </div>
        <Table head={["Rule", "What it means"]} rows={[
          ["One-time link", "login_url works once and expires after 60 seconds. A copied or reused link shows “link expired”."],
          ["Key stays on the server", "Only Green HR's backend holds the API key. It is never sent to a browser or mobile app."],
          ["Employees only", "SSO creates and signs in Employees. HQ Admin, Super Admin and center accounts are blocked and asked to use their admin login."],
          ["Auto account", "First visit creates the employee; later visits update name, department, mobile and email."],
          ["Center", "Existing center is kept. Otherwise: center_code sent by Green HR → default center in the mapping → the company's only center."],
          ["Direct login", "An employee can also open the portal directly and sign in with Employee ID + an OTP sent to their email."],
        ]} />
      </>}

      {section === "admin" && <ol className="space-y-4">
        <Step n={1} title="Open this SSO tab as Super Admin">Only Super Admin can create keys and choose companies. HQ Admin cannot open this tab.</Step>
        <Step n={2} title="Create the integration">At the top of this tab type a name (for example <b>Green HR</b>) and press <b>New integration</b>.</Step>
        <Step n={3} title="Copy the API key immediately">
          <p>The key starts with <code>amsso_</code> and is shown <b>only once</b>. Copy it and give it to the Green HR developer through a secure channel (password manager or direct message — not a group email).</p>
          <Note tone="warn">Lost the key? Press <b>New key</b> on the integration card. A new key is shown and the old one stops working at once — Green HR must update it.</Note>
        </Step>
        <Step n={4} title="Allow the companies">On the integration card press <b>Add company</b>, pick each company whose employees will come from Green HR, leave the center on <b>Auto (match existing center)</b>, then press <b>Save mapping</b>. Employees of companies not listed here are rejected.</Step>
        <Step n={5} title="Share the developer guide">Send the Green HR developer this page's <b>Developer guide</b> tab (or a screenshot of it) together with the key and the API address below.
          <div className="flex flex-wrap items-center gap-2"><code className="rounded bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-800">{endpoint}</code><CopyButton text={endpoint} label="Copy API address" /></div>
        </Step>
        <Step n={6} title="Watch the activity">The <b>SSO activity</b> list at the bottom shows every sign-in, every new employee, blocked admins and wrong keys — with time and IP. It can be exported to Excel.</Step>
        <Step n={7} title="Turn it off if needed">Press <b>Disable</b> on the card to stop all Green HR sign-ins instantly. <b>Enable</b> turns them back on with the same key.</Step>
      </ol>}

      {section === "developer" && <>
        <Note>Audience: the Green HR backend developer. You need two things from the Admin Portal team: the <b>API key</b> and the <b>API address</b> <code>{endpoint}</code>.</Note>
        <ol className="space-y-4">
          <Step n={1} title="Store the key on your server">Save it as an environment variable, e.g. <code>ADMIN_PORTAL_SSO_KEY</code>. Never put it in HTML, JavaScript, a mobile app or the database in plain text.</Step>
          <Step n={2} title="Add an “Admin Portal” button that opens a backend route">The button must point to <b>your own backend</b> (e.g. <code>/admin-portal</code>), not to our API. Browsers cannot call our API directly — the key must stay on your server.</Step>
          <Step n={3} title="In that route, call our API when the button is clicked">
            <p>Send a <code>POST</code> to <code>{endpoint}</code> with header <code>X-API-Key: &lt;your key&gt;</code> and a JSON body describing the logged-in employee. Call it at click time — a link made earlier will have expired.</p>
            <Table head={["Field", "Required", "Example", "Notes"]} rows={[
              ["employee_code", "Yes", "GC-1042", "Green HR employee ID. Identifies the person. 2–40 letters, numbers, - _ . /"],
              ["name", "Yes", "Navneet Kumar", "Full name, up to 100 characters"],
              ["company", "Yes", "Sapling Global", "Our company name or code (SAP). Must be allowed by Super Admin"],
              ["center_code", "No", "A43", "Our center code or name. Used only when the employee has no center yet"],
              ["department", "No", "Operations", "Up to 80 characters"],
              ["designation", "No", "Executive", "Up to 100 characters"],
              ["mobile", "No", "9876543210", "7–15 digits, + allowed"],
              ["email", "No", "navneet@example.com", "Official email. Without it the employee is asked to add one after login"],
            ]} />
          </Step>
          <Step n={4} title="Redirect the employee to login_url">
            <p>On HTTP <b>200</b> always redirect the browser to <code>login_url</code> — even when <code>account</code> is <code>admin_account</code> or <code>inactive</code>; our page then shows the right message.</p>
            <Code title="Success response (HTTP 200)" tone="text-emerald-200" code={`{
  "login_url": "${window.location.origin}/sso?ticket=…",
  "expires_in": 60,
  "account": "created"
}`} />
            <Table head={["account", "Meaning"]} rows={[
              ["created", "New employee was created and will be signed in"],
              ["existing", "Employee already existed; profile updated and signed in"],
              ["admin_account", "Same employee ID or email belongs to an admin — they see “please use your admin login”"],
              ["inactive", "Account was disabled by an admin — they see “account disabled”"],
            ]} />
          </Step>
          <Step n={5} title="Handle errors">
            <p>On any non-200 response, do not redirect. Log <code>error</code> and show the employee a short message such as “Admin Portal is not available right now”. Every error body looks like <code>{`{ "error": "CODE", "message": "…" }`}</code>.</p>
            <Table head={["HTTP", "error", "Why", "Fix"]} rows={[
              ["401", "INVALID_API_KEY", "Key missing, wrong, replaced or integration disabled", "Check the X-API-Key header; ask for the current key"],
              ["422", "COMPANY_NOT_MAPPED", "Company not allowed in SSO settings", "Send our exact company name/code, or ask Super Admin to add it"],
              ["422", "CENTER_NOT_FOUND", "Company has several centers and none matched", "Send center_code, or ask Super Admin to set a default center"],
              ["422", "INVALID_EMPLOYEE_CODE · NAME_REQUIRED · COMPANY_REQUIRED · INVALID_EMAIL · INVALID_MOBILE · FIELD_TOO_LONG", "A field is missing or malformed", "Fix the field named in message"],
              ["409", "EMAIL_IN_USE", "This email already belongs to a different employee ID", "Correct the email or employee ID in Green HR"],
              ["429", "RATE_LIMITED", "Too many calls in one minute", "Retry after a minute"],
              ["5xx", "SERVER_ERROR / UNAVAILABLE", "Temporary problem on our side", "Retry once; if it continues, contact the Admin Portal team"],
            ]} />
          </Step>
          <Step n={6} title="Copy the ready-made code">
            <div className="flex flex-wrap gap-1">{(Object.keys(samples) as (typeof lang)[]).map((key) =>
              <button key={key} type="button" onClick={() => setLang(key)} className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${lang === key ? "bg-slate-900 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{samples[key].label}</button>)}</div>
            <Code title={samples[lang].label} code={samples[lang].code} />
          </Step>
          <Step n={7} title="Go live checklist">
            <ul className="list-disc space-y-1 pl-4">
              <li>Key is in an environment variable on the server only.</li>
              <li>The button calls your backend route; the route calls our API and redirects.</li>
              <li>Tested with a new employee, an existing employee and a wrong key (see the <b>Test &amp; demo</b> tab).</li>
              <li>HTTPS everywhere; request timeout of about 10 seconds.</li>
            </ul>
          </Step>
        </ol>
      </>}

      {section === "test" && <>
        <Note>Use the <b>Test console</b> above — it sends exactly what Green HR's server will send. Open login links in an <b>Incognito / Private window</b> (Ctrl + Shift + N); in this window they would sign you out of Super Admin.</Note>
        <ol className="space-y-4">
          <Step n={1} title="Paste the API key">In the Test console paste the full key (starts with <code>amsso_</code>). The Call API button stays disabled while the key box is empty or incomplete.</Step>
          <Step n={2} title="Fill a test employee">e.g. <code>employee_code</code> DEMO-001, <code>name</code> Demo Employee, <code>company</code> Sapling Global. Other fields are optional.</Step>
          <Step n={3} title="Press Call API and read the result">Left side: what was sent. Right side: HTTP status and response. Expect <b>HTTP 200</b>, a <code>login_url</code> and <code>account: "created"</code>.</Step>
          <Step n={4} title="Open the link within 60 seconds">Press <b>Copy link</b>, paste it in an Incognito window. You should see “Signing you in from Green HR…” and then the employee dashboard with their name and center.</Step>
          <Step n={5} title="Show the email prompt">With no email sent, a yellow bar asks the employee to add an email; they confirm it with a 6-digit code.</Step>
          <Step n={6} title="Check SSO activity">Back in Super Admin, <b>SSO activity</b> shows “New employee created” and “Signed in”.</Step>
        </ol>
        <Table head={["Try this", "Expected result"]} rows={[
          ["Same employee_code again, changed name", "HTTP 200, account \"existing\"; name updated after login"],
          ["Email of an HQ / Super Admin user", "HTTP 200, account \"admin_account\"; link shows “You already have an admin account”"],
          ["Company “Unknown Co”", "HTTP 422 COMPANY_NOT_MAPPED"],
          ["Wrong or old API key", "HTTP 401 INVALID_API_KEY"],
          ["Open the same link twice, or after 60 s", "“This link has expired”"],
          ["Login page → “Sign in with Employee ID & OTP”", "Code sent to the employee's email (after they have added one)"],
        ]} />
      </>}

      {section === "help" && <Table head={["Problem", "Cause and fix"]} rows={[
        ["401 INVALID_API_KEY", "Key box empty, key cut short, or a New key was generated. Paste the current full key."],
        ["422 COMPANY_NOT_MAPPED", "Add the company on the integration card and press Save mapping. Name or code must match ours."],
        ["422 CENTER_NOT_FOUND", "Company has more than one center: send center_code from Green HR, or pick a default center in the mapping."],
        ["“This link has expired”", "Links work once and for 60 seconds. Click Admin Portal in Green HR again (or Call API again)."],
        ["“You already have an admin account”", "That employee ID/email belongs to an admin. Admins sign in with email and password on the normal login page."],
        ["“Your account has been disabled”", "An admin disabled the user. Re-enable them in Team & Roles."],
        ["OTP email not received", "SMTP settings are missing on the server (SMTP_HOST, SMTP_USER, SMTP_PASSWORD, SMTP_FROM). Also check spam."],
        ["Login link opens the wrong website", "Set APP_PUBLIC_URL in the backend .env to the portal address (HTTPS) and restart the backend."],
        ["Super Admin got logged out after testing", "The test link was opened in the same browser window. Use an Incognito window."],
      ]} />}
    </div>
  </section>;
}
