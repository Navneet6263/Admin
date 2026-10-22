import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, KeyRound, Link2, Plus, Power, RefreshCw, Save, ShieldCheck, Trash2, X } from "lucide-react";
import { apiBaseUrl, request } from "@/lib/api";
import { ExcelExportButton } from "@/components/ExcelExportButton";
import type { ExportColumn } from "@/lib/excelExport";
import { SsoTestConsole } from "./SsoTestConsole";

type Mapping = { company: string; center_code: string; center_name?: string };
type Client = { id: number; name: string; key_prefix: string; is_active: boolean; created_at: string; rotated_at: string | null;
  last_used_at: string | null; created_by_name: string; user_count: number; companies: Mapping[] };
type SsoEvent = { id: number; event: string; employee_code: string | null; detail: string | null; ip: string | null;
  created_at: string; client_name: string | null; user_name: string | null };
type Company = { code: string; name: string };
type Center = { code: string; name: string; company: string; is_active?: boolean };

const when = (value: string | null) => value ? new Date(value).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "Never";
const eventLabels: Record<string, string> = { link_issued: "Link issued", user_created: "New employee created", login: "Signed in",
  blocked_admin: "Blocked: admin account", blocked_inactive: "Blocked: disabled account", rejected: "Request rejected",
  invalid_key: "Invalid API key", ticket_rejected: "Expired / reused link" };
const eventColumns: ExportColumn<SsoEvent>[] = [
  { key: "at", label: "When", value: (row) => row.created_at, type: "datetime" },
  { key: "event", label: "Event", value: (row) => eventLabels[row.event] ?? row.event },
  { key: "client", label: "Integration", value: (row) => row.client_name },
  { key: "emp", label: "Employee ID", value: (row) => row.employee_code },
  { key: "user", label: "User", value: (row) => row.user_name },
  { key: "detail", label: "Detail", value: (row) => row.detail },
  { key: "ip", label: "IP", value: (row) => row.ip },
];

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return <button type="button" onClick={() => { void navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }); }}
    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50">
    {done ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}{done ? "Copied" : "Copy"}</button>;
}

function KeyDialog({ apiKey, onClose }: { apiKey: string; onClose: () => void }) {
  return <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm">
    <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
      <p className="flex items-center gap-2 text-base font-bold text-slate-900"><KeyRound className="h-4 w-4 text-indigo-600" /> Your new API key</p>
      <p className="mt-1 text-xs text-rose-700">Copy it now and share it securely with the Green HR team. It will <b>never be shown again</b>.</p>
      <div className="mt-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <code className="flex-1 break-all font-mono text-xs text-slate-900">{apiKey}</code><CopyButton text={apiKey} />
      </div>
      <p className="mt-3 text-[11px] text-slate-500">Keep it on the Green HR server only — never in a browser, mobile app or email body.</p>
      <div className="mt-5 flex justify-end"><button type="button" onClick={onClose} className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white">I have saved it</button></div>
    </div>
  </div>;
}

function MappingEditor({ client, companies, centers, onSaved }: { client: Client; companies: Company[]; centers: Center[]; onSaved: () => void }) {
  const [rows, setRows] = useState<Mapping[]>(client.companies.map(({ company, center_code }) => ({ company, center_code })));
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [saved, setSaved] = useState(false);
  useEffect(() => setRows(client.companies.map(({ company, center_code }) => ({ company, center_code }))), [client]);
  const used = new Set(rows.map((row) => row.company));
  const save = async () => {
    setBusy(true); setError(""); setSaved(false);
    try { await request(`/api/super-admin/sso/${client.id}/companies`, { method: "PUT", body: { companies: rows } }); setSaved(true); onSaved(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Mapping could not be saved"); }
    finally { setBusy(false); }
  };
  const select = "w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs";
  return <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Companies allowed + default center</p>
    <p className="mb-2 text-[11px] text-slate-500">Employees of these companies land in this center. Admins can move them later.</p>
    <div className="space-y-2">
      {rows.map((row, index) => <div key={index} className="grid grid-cols-[1fr_1fr_28px] gap-2">
        <select value={row.company} onChange={(event) => setRows(rows.map((item, i) => i === index ? { company: event.target.value, center_code: "" } : item))} className={select}>
          <option value="">Select company</option>
          {companies.filter((company) => company.name === row.company || !used.has(company.name)).map((company) => <option key={company.code} value={company.name}>{company.name} ({company.code})</option>)}
        </select>
        <select value={row.center_code} onChange={(event) => setRows(rows.map((item, i) => i === index ? { ...item, center_code: event.target.value } : item))} className={select}>
          <option value="">Default center</option>
          {centers.filter((center) => !row.company || center.company === row.company).map((center) => <option key={center.code} value={center.code}>{center.name} ({center.code})</option>)}
        </select>
        <button type="button" onClick={() => setRows(rows.filter((_, i) => i !== index))} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>)}
      {!rows.length && <p className="text-xs text-slate-400">No company enabled yet — SSO requests will be rejected until you add one.</p>}
    </div>
    {error && <p className="mt-2 text-xs text-rose-700">{error}</p>}
    <div className="mt-3 flex items-center gap-2">
      <button type="button" onClick={() => setRows([...rows, { company: "", center_code: "" }])} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700"><Plus className="h-3 w-3" /> Add company</button>
      <button type="button" disabled={busy || rows.some((row) => !row.company || !row.center_code)} onClick={() => void save()}
        className="ml-auto inline-flex items-center gap-1 rounded-md bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-40"><Save className="h-3 w-3" /> {busy ? "Saving…" : "Save mapping"}</button>
      {saved && <span className="text-[11px] font-semibold text-emerald-700">Saved</span>}
    </div>
  </div>;
}

function IntegrationGuide() {
  const endpoint = `${apiBaseUrl || window.location.origin}/api/sso/v1/login-link`;
  const curl = `curl -X POST "${endpoint}" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: amsso_xxxxxxxx_<secret>" \\
  -d '{
    "employee_code": "GC-1042",
    "name": "Navneet Kumar",
    "company": "GreenCall",
    "department": "Operations",
    "designation": "Executive",
    "mobile": "9876543210",
    "email": "navneet@greencall.com"
  }'`;
  const response = `{ "login_url": "https://<portal>/sso?ticket=…", "expires_in": 60, "account": "created | existing | admin_account | inactive" }`;
  return <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Link2 className="h-4 w-4 text-indigo-600" /> Integration guide for the Green HR team</h3>
    <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-xs leading-5 text-slate-700">
      <li>When an employee clicks <b>Admin Portal</b> in Green HR, the <b>Green HR server</b> (never the browser) calls the API below with the API key.</li>
      <li>Required: <code>employee_code</code>, <code>name</code>, <code>company</code> (our company name or code). Optional: <code>department</code>, <code>designation</code>, <code>mobile</code>, <code>email</code>.</li>
      <li>Green HR redirects the employee's browser to the returned <code>login_url</code>. It works <b>once</b> and expires in <b>60 seconds</b>.</li>
      <li>New employees are created automatically as <b>Employee</b>; existing ones are updated. HQ / Super Admin / center accounts are never signed in through SSO — they see "use your admin login".</li>
    </ol>
    <div className="mt-4 grid gap-3 lg:grid-cols-2">
      <div><div className="mb-1 flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Request</span><CopyButton text={curl} /></div>
        <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 text-[11px] leading-5 text-slate-100">{curl}</pre></div>
      <div className="space-y-3">
        <div><span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Success (200)</span>
          <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 text-[11px] leading-5 text-emerald-200">{response}</pre></div>
        <div><span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Errors</span>
          <table className="w-full text-[11px]"><tbody className="divide-y divide-slate-100">
            {[["401", "INVALID_API_KEY", "Key missing, wrong or disabled"], ["422", "COMPANY_NOT_MAPPED", "Company not enabled below"],
              ["422", "INVALID_EMPLOYEE_CODE / NAME_REQUIRED …", "Bad or missing field"], ["409", "EMAIL_IN_USE", "Email belongs to another employee ID"],
              ["429", "RATE_LIMITED", "Too many calls — retry after a minute"]].map(([status, code, meaning]) =>
              <tr key={code}><td className="py-1 pr-2 font-mono text-slate-500">{status}</td><td className="py-1 pr-2 font-mono text-slate-800">{code}</td><td className="py-1 text-slate-600">{meaning}</td></tr>)}
          </tbody></table></div>
      </div>
    </div>
    <p className="mt-3 text-[11px] text-slate-500">Employees can also open the portal directly and sign in with <b>Employee ID + email OTP</b> once their email is on record.</p>
  </section>;
}

/** Super Admin → SSO: HRMS integrations, keys, company mapping, guide and activity. */
export function SsoTab() {
  const [clients, setClients] = useState<Client[]>([]);
  const [events, setEvents] = useState<SsoEvent[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [name, setName] = useState("Green HR");
  const [newKey, setNewKey] = useState("");
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setError("");
    try {
      const [settings, log, companyRows, centerRows] = await Promise.all([
        request<{ clients: Client[] }>("/api/super-admin/sso"), request<SsoEvent[]>("/api/super-admin/sso/events?limit=200"),
        request<Company[]>("/api/companies"), request<Center[]>("/api/centers")]);
      setClients(settings.clients); setEvents(log); setCompanies(companyRows); setCenters(centerRows.filter((center) => center.is_active !== false));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "SSO settings could not be loaded"); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const create = async () => {
    setBusy(true); setError("");
    try { const result = await request<{ api_key: string }>("/api/super-admin/sso", { method: "POST", body: { name } }); setNewKey(result.api_key); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Integration could not be created"); }
    finally { setBusy(false); }
  };
  const rotate = async (client: Client) => {
    if (!window.confirm(`Generate a new key for ${client.name}? The current key stops working immediately.`)) return;
    try { const result = await request<{ api_key: string }>(`/api/super-admin/sso/${client.id}/rotate`, { method: "POST" }); setNewKey(result.api_key); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Key could not be rotated"); }
  };
  const toggle = async (client: Client) => {
    if (client.is_active && !window.confirm(`Disable ${client.name}? Employees will not be able to come in from it until you enable it again.`)) return;
    try { await request(`/api/super-admin/sso/${client.id}`, { method: "PATCH", body: { is_active: !client.is_active } }); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Status could not be changed"); }
  };
  const stats = useMemo(() => ({ logins: events.filter((event) => event.event === "login").length,
    created: events.filter((event) => event.event === "user_created").length,
    blocked: events.filter((event) => ["blocked_admin", "blocked_inactive", "invalid_key", "rejected"].includes(event.event)).length }), [events]);

  return <div className="mt-5 space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 via-white to-indigo-50/60 px-5 py-4">
      <div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-600">Single sign-on</p>
        <h2 className="mt-1 font-display text-xl font-semibold text-slate-900">Green HR → Admin Portal</h2>
        <p className="mt-1 text-xs text-slate-500">Employees click “Admin Portal” in Green HR and arrive here already signed in.</p></div>
      <div className="flex items-center gap-2">
        <input value={name} onChange={(event) => setName(event.target.value)} className="h-9 rounded-lg border border-slate-200 px-3 text-xs" placeholder="Integration name" />
        <button type="button" disabled={busy || !name.trim()} onClick={() => void create()} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-xs font-semibold text-white disabled:opacity-40"><Plus className="h-3.5 w-3.5" /> New integration</button>
      </div>
    </div>
    {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
    <div className="grid gap-3 sm:grid-cols-3">
      {[["Recent sign-ins", stats.logins], ["New employees created", stats.created], ["Blocked / rejected", stats.blocked]].map(([label, value]) =>
        <div key={label} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p></div>)}
    </div>
    {clients.map((client) => <section key={client.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-[220px] flex-1">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-900"><ShieldCheck className={`h-4 w-4 ${client.is_active ? "text-emerald-600" : "text-slate-400"}`} />{client.name}
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${client.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{client.is_active ? "Active" : "Disabled"}</span></p>
          <p className="mt-1 font-mono text-[11px] text-slate-500">Key: amsso_{client.key_prefix}_••••••••</p>
          <p className="mt-0.5 text-[11px] text-slate-400">Last used {when(client.last_used_at)} · {client.user_count} employees · created by {client.created_by_name}{client.rotated_at ? ` · key rotated ${when(client.rotated_at)}` : ""}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void rotate(client)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"><RefreshCw className="h-3 w-3" /> New key</button>
          <button type="button" onClick={() => void toggle(client)} className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold ${client.is_active ? "border-rose-200 text-rose-700 hover:bg-rose-50" : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"}`}>
            <Power className="h-3 w-3" /> {client.is_active ? "Disable" : "Enable"}</button>
        </div>
      </div>
      <MappingEditor client={client} companies={companies} centers={centers} onSaved={() => void load()} />
    </section>)}
    {!clients.length && <div className="rounded-xl border border-dashed border-slate-300 bg-white py-12 text-center text-sm text-slate-500">
      No integration yet. Click <b>New integration</b> to generate the API key for Green HR.</div>}
    <SsoTestConsole companies={companies} />
    <IntegrationGuide />
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
        <h3 className="text-sm font-semibold text-slate-900">SSO activity</h3>
        <div className="ml-auto"><ExcelExportButton exportKey="sso-events" title="SSO activity" columns={eventColumns} rows={events} dateKey="at" /></div>
      </div>
      <div className="max-h-[420px] overflow-y-auto"><table className="w-full text-xs"><tbody className="divide-y divide-slate-100">
        {events.map((event) => <tr key={event.id} className="hover:bg-slate-50/70">
          <td className="whitespace-nowrap px-4 py-2 text-slate-500">{when(event.created_at)}</td>
          <td className="px-4 py-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${["login", "link_issued", "user_created"].includes(event.event) ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{eventLabels[event.event] ?? event.event}</span></td>
          <td className="px-4 py-2 font-mono text-[11px] text-slate-700">{event.employee_code || "—"}</td>
          <td className="px-4 py-2 text-slate-700">{event.user_name || "—"}</td>
          <td className="px-4 py-2 text-[11px] text-slate-500">{event.detail || ""}</td>
          <td className="px-4 py-2 font-mono text-[10px] text-slate-400">{event.ip}</td>
        </tr>)}
        {!events.length && <tr><td className="px-4 py-10 text-center text-slate-400"><X className="mx-auto mb-1 h-4 w-4" />No SSO activity yet.</td></tr>}
      </tbody></table></div>
    </section>
    {newKey && <KeyDialog apiKey={newKey} onClose={() => setNewKey("")} />}
  </div>;
}
