import { useEffect, useState } from "react";
import { ExternalLink, FlaskConical, Loader2, Play } from "lucide-react";
import { apiBaseUrl } from "@/lib/api";

type Result = { status: number; ms: number; request: Record<string, unknown>; response: unknown };

/**
 * Lets a Super Admin call the SSO API exactly as Green HR would and inspect request/response.
 * The key is used for this call only and is never stored.
 */
export function SsoTestConsole({ companies }: { companies: { code: string; name: string }[] }) {
  const [apiKey, setApiKey] = useState("");
  const [form, setForm] = useState({ employee_code: "TEST-001", name: "Test Employee", company: "", department: "Operations",
    designation: "Executive", mobile: "", email: "" });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  useEffect(() => { if (!form.company && companies[0]) setForm((current) => ({ ...current, company: companies[0].name })); }, [companies, form.company]);
  useEffect(() => {
    if (!secondsLeft) return;
    const timer = window.setTimeout(() => setSecondsLeft((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [secondsLeft]);
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const run = async () => {
    setBusy(true); setResult(null);
    // Optional fields are sent only when filled, like a real HRMS would.
    const body = Object.fromEntries(Object.entries(form).filter(([, value]) => value.trim() !== ""));
    const started = performance.now();
    try {
      const response = await fetch(`${apiBaseUrl}/api/sso/v1/login-link`, { method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey.trim()}` }, body: JSON.stringify(body) });
      const data = await response.json().catch(() => ({}));
      setResult({ status: response.status, ms: Math.round(performance.now() - started), request: body, response: data });
      if (response.ok && (data as { login_url?: string }).login_url) setSecondsLeft(60);
    } catch (error) {
      setResult({ status: 0, ms: Math.round(performance.now() - started), request: body,
        response: { error: "NETWORK", message: error instanceof Error ? error.message : "Request failed" } });
    } finally { setBusy(false); }
  };
  const loginUrl = (result?.response as { login_url?: string } | undefined)?.login_url;
  const input = "w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs";
  const label = "mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500";

  return <section className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-5 shadow-sm">
    <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><FlaskConical className="h-4 w-4 text-indigo-600" /> Test console — act as Green HR</h3>
    <p className="mt-1 text-xs text-slate-600">Paste the API key, fill an employee, and press <b>Call API</b>. You'll see exactly what Green HR sends and receives.</p>
    <div className="mt-4 grid gap-3 md:grid-cols-4">
      <label className="md:col-span-4"><span className={label}>API key (not saved)</span>
        <input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} className={`${input} font-mono`} placeholder="amsso_xxxxxxxx_…" autoComplete="off" /></label>
      <label><span className={label}>employee_code *</span><input value={form.employee_code} onChange={(event) => set("employee_code", event.target.value.toUpperCase())} className={`${input} font-mono`} /></label>
      <label><span className={label}>name *</span><input value={form.name} onChange={(event) => set("name", event.target.value)} className={input} /></label>
      <label><span className={label}>company *</span>
        <select value={form.company} onChange={(event) => set("company", event.target.value)} className={input}>
          {companies.map((company) => <option key={company.code} value={company.name}>{company.name}</option>)}
          <option value="Unknown Co">Unknown Co (should fail)</option>
        </select></label>
      <label><span className={label}>department</span><input value={form.department} onChange={(event) => set("department", event.target.value)} className={input} /></label>
      <label><span className={label}>designation</span><input value={form.designation} onChange={(event) => set("designation", event.target.value)} className={input} /></label>
      <label><span className={label}>mobile</span><input value={form.mobile} onChange={(event) => set("mobile", event.target.value)} className={input} placeholder="optional" /></label>
      <label className="md:col-span-2"><span className={label}>email</span><input value={form.email} onChange={(event) => set("email", event.target.value)} className={input} placeholder="optional — try an admin's email to see the block" /></label>
    </div>
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <button type="button" disabled={busy} onClick={() => void run()} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} Call API</button>
      <span className="text-[11px] text-slate-500">POST {apiBaseUrl || window.location.origin}/api/sso/v1/login-link</span>
    </div>
    {result && <div className="mt-4 grid gap-3 lg:grid-cols-2">
      <div><span className={label}>Request body sent</span>
        <pre className="max-h-64 overflow-auto rounded-lg bg-slate-900 p-3 text-[11px] leading-5 text-slate-100">{JSON.stringify(result.request, null, 2)}</pre></div>
      <div><span className={label}>Response · <span className={result.status >= 200 && result.status < 300 ? "text-emerald-700" : "text-rose-700"}>HTTP {result.status || "—"}</span> · {result.ms} ms</span>
        <pre className={`max-h-64 overflow-auto rounded-lg p-3 text-[11px] leading-5 ${result.status >= 200 && result.status < 300 ? "bg-slate-900 text-emerald-200" : "bg-slate-900 text-rose-200"}`}>{JSON.stringify(result.response, null, 2)}</pre></div>
    </div>}
    {loginUrl && <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
      <p><b>Open this link in an Incognito / Private window</b> (Ctrl + Shift + N). In this window it would sign you out of Super Admin and sign you in as the employee.</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <code className="max-w-full flex-1 truncate rounded bg-white px-2 py-1 font-mono text-[11px] text-slate-700">{loginUrl}</code>
        <button type="button" onClick={() => void navigator.clipboard?.writeText(loginUrl)} className="rounded-md border border-amber-300 bg-white px-2.5 py-1 font-semibold">Copy link</button>
        <span className={`font-semibold ${secondsLeft ? "text-amber-800" : "text-rose-700"}`}>{secondsLeft ? `Valid for ${secondsLeft}s · one use only` : "Expired — call the API again"}</span>
        <a href={loginUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-amber-800 underline"><ExternalLink className="h-3 w-3" /> open here anyway</a>
      </div>
    </div>}
  </section>;
}
