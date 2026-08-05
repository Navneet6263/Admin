import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { RequestRow } from "@/components/RequestRow";
import { RequestDetail } from "@/components/RequestDetail";
import { priorityRank, typeLabels, type RequestItem, type RequestStatus, type RequestType, type Priority } from "@/components/models";
import { getRequests, request, session } from "@/lib/api";
import { useCompanies } from "@/lib/directory";
import { ShieldCheck, Inbox, CheckCircle2, Undo2, Filter, ChevronDown } from "lucide-react";

export const Route = createFileRoute("/verifier")({
  head: () => ({
    meta: [
      { title: "Verifier Desk — RequestHub" },
      { name: "description", content: "Two-stage verification console — verify claims and bills after admin approval before closing requests." },
    ],
  }),
  component: VerifierConsole,
});

type Tab = "queue" | "verified" | "sent_back" | "all";
type SortKey = "priority" | "newest" | "oldest" | "amount";
const autoNote = (actor: string, action: "verify" | "send_back", userNote: string) => {
  const ts = new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  const verb = action === "verify" ? "Verified & closed" : "Sent back to Admin";
  const head = `${verb} by ${actor} · ${ts} IST`;
  return userNote?.trim() ? `${head}\n— ${userNote.trim()}` : head;
};

function VerifierConsole() {
  const [sessionUser, setSessionUser] = useState(session.user);
  const companies = useCompanies();
  useEffect(() => { void session.me().then(setSessionUser); }, []);
  const actor = sessionUser ? `${sessionUser.name} (USR-${sessionUser.id})` : "Authenticated verifier";
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [tab, setTab] = useState<Tab>("queue");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<RequestType | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "all">("all");
  const [sortBy, setSortBy] = useState<SortKey>("priority");
  const [query, setQuery] = useState("");
  const refresh = useCallback(async () => { try { setRequests(await getRequests('/api/verifier/queue')); } catch (error) { console.error(error); } }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const counts = useMemo(() => ({
    queue: requests.filter((r) => r.status === "awaiting_verification").length,
    verified: requests.filter((r) => r.status === "approved" && r.audit.some((a) => a.action === "verified")).length,
    sent_back: requests.filter((r) => r.audit.some((a) => a.action === "sent_back")).length,
    all: requests.length,
  }), [requests]);

  const filtered = useMemo(() => {
    const byTab = (r: RequestItem) =>
      tab === "queue" ? r.status === "awaiting_verification" :
      tab === "verified" ? (r.status === "approved" && r.audit.some((a) => a.action === "verified")) :
      tab === "sent_back" ? r.audit.some((a) => a.action === "sent_back") :
      true;
    const q = query.trim().toLowerCase();
    const sorter = (a: RequestItem, b: RequestItem) => {
      if (sortBy === "newest") return +new Date(b.updatedAt) - +new Date(a.updatedAt);
      if (sortBy === "oldest") return +new Date(a.updatedAt) - +new Date(b.updatedAt);
      if (sortBy === "amount") return (b.amount ?? 0) - (a.amount ?? 0);
      return priorityRank[a.priority] - priorityRank[b.priority] || +new Date(b.updatedAt) - +new Date(a.updatedAt);
    };
    return requests
      .filter(byTab)
      .filter((r) => companyFilter === "all" || r.company === companyFilter)
      .filter((r) => typeFilter === "all" || r.type === typeFilter)
      .filter((r) => priorityFilter === "all" || r.priority === priorityFilter)
      .filter((r) => !q || r.id.toLowerCase().includes(q) || r.subject.toLowerCase().includes(q) || r.employeeName.toLowerCase().includes(q))
      .sort(sorter);
  }, [requests, tab, companyFilter, typeFilter, priorityFilter, sortBy, query]);

  const [selectedId, setSelectedId] = useState<string>(() => requests.find((r) => r.status === "awaiting_verification")?.id ?? "");
  const selected = requests.find((r) => r.id === selectedId) ?? filtered[0];

  const onDetailAction = useCallback(async (id: string, action: "approve" | "reject" | "queue" | "info" | "verify" | "send_back", note: string) => {
    if (action !== "verify" && action !== "send_back") return;
    setRequests((prev) => prev.map((r) => {
      if (r.id !== id) return r;
      const at = new Date().toISOString();
      const nextStatus: RequestStatus = action === "verify" ? "approved" : "pending";
      return {
        ...r, status: nextStatus, updatedAt: at,
        audit: [...r.audit, { at, actor, action: action === "verify" ? "verified" : "sent_back", note: autoNote(actor, action, note) }],
      };
    }));
    const target = requests.find(r => r.id === id);
    if (target?.dbId) { await request(`/api/verifier/requests/${target.dbId}/${action === 'verify' ? 'verify' : 'send-back'}`, { method: 'POST', body: { note } }); await refresh(); }
  }, [actor, refresh, requests]);

  const tabs: { id: Tab; label: string; icon: typeof Inbox; count: number }[] = [
    { id: "queue", label: "Awaiting verification", icon: Inbox, count: counts.queue },
    { id: "verified", label: "Verified & closed", icon: CheckCircle2, count: counts.verified },
    { id: "sent_back", label: "Sent back", icon: Undo2, count: counts.sent_back },
    { id: "all", label: "All", icon: Filter, count: counts.all },
  ];

  return (
    <DashboardLayout workspace="Verifier Desk" currentUser={sessionUser?.name ?? ""} role={sessionUser?.dept || "Verifier"}>
      <div className="px-4 sm:px-6 pt-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">Stage 2 · Claim Verification</p>
            <h1 className="font-display text-2xl font-semibold text-slate-900">Verification Queue</h1>
            <div className="flex items-center gap-2 mt-2">
              <span className="inline-flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium rounded border border-violet-100 bg-violet-50 text-violet-700">
                <ShieldCheck className="w-3 h-3" /> Signed in as {sessionUser?.name ?? "Loading…"}
                {sessionUser && <span className="font-mono text-violet-600/80">· USR-{sessionUser.id}</span>}
              </span>
              <span className="text-[11px] text-slate-500">Every verification is signed and locked to the audit trail.</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <KpiTile label="In queue" value={counts.queue} tone="violet" />
            <KpiTile label="Verified" value={counts.verified} tone="emerald" />
            <KpiTile label="Sent back" value={counts.sent_back} tone="amber" />
          </div>
        </div>

        <div className="flex items-center gap-1 border-b border-slate-200 -mx-4 sm:-mx-6 px-4 sm:px-6 overflow-x-auto">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-3 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                tab === t.id ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"
              }`}>
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
              <span className={`px-1.5 py-0.5 rounded text-[10px] tabular-nums ${tab === t.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"}`}>{t.count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mx-4 sm:mx-6 mt-4 grid grid-cols-1 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-4 h-[calc(100vh-16rem)] min-h-[600px]">
        <div className="bg-white border border-slate-200 rounded-lg flex flex-col overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2 flex-wrap">
            <SelectFilter value={companyFilter} onChange={setCompanyFilter} options={[
              { v: "all", label: "All companies" },
              ...companies.map((c) => ({ v: c.code, label: `${c.name} (${c.code})` })),
            ]} />
            <SelectFilter value={typeFilter} onChange={(v) => setTypeFilter(v as RequestType | "all")} options={[
              { v: "all", label: "All categories" },
              ...Object.entries(typeLabels).map(([v, label]) => ({ v, label })),
            ]} />
            <SelectFilter value={priorityFilter} onChange={(v) => setPriorityFilter(v as Priority | "all")} options={[
              { v: "all", label: "Any priority" },
              { v: "urgent", label: "Urgent" }, { v: "high", label: "High" },
              { v: "normal", label: "Normal" }, { v: "low", label: "Low" },
            ]} />
            <SelectFilter value={sortBy} onChange={(v) => setSortBy(v as SortKey)} options={[
              { v: "priority", label: "Sort: Priority" },
              { v: "newest", label: "Sort: Newest" },
              { v: "oldest", label: "Sort: Oldest" },
              { v: "amount", label: "Sort: Amount ↓" },
            ]} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter by ID, subject, employee…"
              className="flex-1 min-w-[160px] text-xs bg-slate-50 border border-slate-200 rounded px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:bg-white" />
            <span className="text-[11px] text-slate-400 tabular-nums shrink-0">{filtered.length} results</span>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
            {filtered.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-400">Nothing to verify. All clear.</div>
            ) : filtered.map((r) => (
              <RequestRow key={r.id} request={r} selected={selected?.id === r.id}
                checked={false} onToggleCheck={() => {}} onSelect={setSelectedId} />
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          {selected ? <RequestDetail request={selected} onAction={onDetailAction} mode="verifier" /> : (
            <div className="h-full grid place-items-center text-sm text-slate-400">Select a request to verify.</div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

function SelectFilter({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { v: string; label: string }[] }) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="appearance-none text-xs bg-slate-50 border border-slate-200 rounded pl-2.5 pr-7 py-1 focus:outline-none focus:ring-2 focus:ring-slate-300">
        {options.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
      </select>
      <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  );
}

const kpiTone = {
  violet: "border-l-violet-400",
  emerald: "border-l-emerald-400",
  amber: "border-l-amber-400",
} as const;

function KpiTile({ label, value, tone }: { label: string; value: number; tone: keyof typeof kpiTone }) {
  return (
    <div className={`px-3.5 py-2.5 bg-white border border-slate-200 border-l-4 rounded-md min-w-[130px] ${kpiTone[tone]}`}>
      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">{label}</p>
      <p className="text-xl font-display font-semibold text-slate-900 tabular-nums mt-0.5">{value}</p>
    </div>
  );
}
