import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { RequestRow } from "@/components/RequestRow";
import { RequestDetail } from "@/components/RequestDetail";
import { priorityRank, typeLabels, type RequestItem, type RequestStatus, type RequestType, type Priority } from "@/components/models";
import { getRequests, request } from "@/lib/api";
import { fmtINR } from "@/components/requestMeta";
import { Filter, Inbox, CheckCircle2, XCircle, ChevronDown, Landmark, Wallet, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/finance")({
  head: () => ({
    meta: [
      { title: "Finance Console — RequestHub" },
      { name: "description", content: "Finance approval console. Verify budgets, release funds, sign off on travel and capex." },
    ],
  }),
  component: FinanceConsole,
});

const FINANCIAL: RequestType[] = ["travel", "courier"];
const isFinancial = (r: RequestItem) =>
  FINANCIAL.includes(r.type) || (r.amount ?? 0) > 0;

type Tab = "queue" | "approved" | "rejected" | "all";
type SortKey = "amount" | "priority" | "newest" | "oldest";
const CURRENT = { id: "FIN-014", name: "Anjali Mehta", role: "Finance Controller" };
const tag = () => `${CURRENT.name} (${CURRENT.id})`;

const autoNote = (action: "approve" | "reject" | "info", userNote: string) => {
  const ts = new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  const verb = action === "approve" ? "Funds released & approved" : action === "reject" ? "Rejected by Finance" : "Clarification requested";
  const head = `${verb} by ${tag()} · ${ts} IST`;
  return userNote?.trim() ? `${head}\n— ${userNote.trim()}` : head;
};

function FinanceConsole() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [tab, setTab] = useState<Tab>("queue");
  const [typeFilter, setTypeFilter] = useState<RequestType | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "all">("all");
  const [sortBy, setSortBy] = useState<SortKey>("amount");
  const [query, setQuery] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const refresh = useCallback(async () => { try { setRequests(await getRequests('/api/requests')); } catch (error) { console.error(error); } }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const finRequests = useMemo(() => requests.filter(isFinancial), [requests]);

  const counts = useMemo(() => ({
    queue: finRequests.filter((r) => r.status === "queued" || r.status === "pending").length,
    approved: finRequests.filter((r) => r.status === "approved").length,
    rejected: finRequests.filter((r) => r.status === "rejected").length,
    all: finRequests.length,
  }), [finRequests]);

  const money = useMemo(() => {
    const sum = (s: RequestStatus[]) => finRequests
      .filter((r) => s.includes(r.status))
      .reduce((a, r) => a + (r.amount ?? 0), 0);
    return {
      pending: sum(["queued", "pending"]),
      approved: sum(["approved"]),
      thisMonth: finRequests
        .filter((r) => r.status === "approved" && new Date(r.updatedAt).getMonth() === new Date().getMonth())
        .reduce((a, r) => a + (r.amount ?? 0), 0),
    };
  }, [finRequests]);

  const filtered = useMemo(() => {
    const byTab = (r: RequestItem) =>
      tab === "all" ? true :
      tab === "queue" ? (r.status === "queued" || r.status === "pending") :
      r.status === (tab as RequestStatus);
    const q = query.trim().toLowerCase();
    const sorter = (a: RequestItem, b: RequestItem) => {
      if (sortBy === "amount") return (b.amount ?? 0) - (a.amount ?? 0);
      if (sortBy === "newest") return +new Date(b.updatedAt) - +new Date(a.updatedAt);
      if (sortBy === "oldest") return +new Date(a.updatedAt) - +new Date(b.updatedAt);
      return priorityRank[a.priority] - priorityRank[b.priority];
    };
    return finRequests
      .filter(byTab)
      .filter((r) => typeFilter === "all" || r.type === typeFilter)
      .filter((r) => priorityFilter === "all" || r.priority === priorityFilter)
      .filter((r) => !q || r.id.toLowerCase().includes(q) || r.subject.toLowerCase().includes(q) || r.employeeName.toLowerCase().includes(q))
      .sort(sorter);
  }, [finRequests, tab, typeFilter, priorityFilter, sortBy, query]);

  const [selectedId, setSelectedId] = useState<string>(() => finRequests[0]?.id ?? "");
  const selected = requests.find((r) => r.id === selectedId) ?? filtered[0];

  const applyAction = useCallback(async (ids: string[], action: "approve" | "reject" | "info", note: string) => {
    setRequests((prev) => prev.map((r) => {
      if (!ids.includes(r.id)) return r;
      const at = new Date().toISOString();
      const nextStatus: RequestStatus = action === "approve" ? "approved" : action === "reject" ? "rejected" : "info_requested";
      const auditAction = action === "approve" ? "approved" : action === "reject" ? "rejected" : "info_requested";
      return {
        ...r, status: nextStatus, updatedAt: at,
        audit: [...r.audit, { at, actor: tag(), action: auditAction, note: autoNote(action, note) }],
      };
    }));
    setChecked(new Set());
    await Promise.all(ids.map(id => request(`/api/admin/requests/${requests.find(r => r.id === id)?.dbId}/${action === 'info' ? 'info' : action}`, { method: 'POST', body: { remarks: note } })));
    await refresh();
  }, [refresh, requests]);

  const onDetailAction = useCallback((id: string, action: "approve" | "reject" | "queue" | "info" | "verify" | "send_back", note: string) => {
    if (action === "verify" || action === "send_back") return;
    const mapped = action === "queue" ? "info" : action;
    void applyAction([id], mapped as "approve" | "reject" | "info", note);
  }, [applyAction]);

  const toggleCheck = useCallback((id: string) => {
    setChecked((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);
  const toggleAll = () => setChecked(checked.size === filtered.length ? new Set() : new Set(filtered.map((r) => r.id)));

  const selectedTotal = [...checked].reduce((a, id) => a + (requests.find((r) => r.id === id)?.amount ?? 0), 0);

  const tabs: { id: Tab; label: string; icon: typeof Inbox; count: number }[] = [
    { id: "queue", label: "Awaiting release", icon: Inbox, count: counts.queue },
    { id: "approved", label: "Released", icon: CheckCircle2, count: counts.approved },
    
    { id: "rejected", label: "Rejected", icon: XCircle, count: counts.rejected },
    { id: "all", label: "All financial", icon: Filter, count: counts.all },
  ];

  return (
    <DashboardLayout workspace="Finance Desk" currentUser={`${CURRENT.name} · ${CURRENT.id}`} role={CURRENT.role}>
      <div className="px-4 sm:px-6 pt-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">Finance · Fund Release Console</p>
            <h1 className="font-display text-2xl font-semibold text-slate-900">Treasury Queue</h1>
            <div className="flex items-center gap-2 mt-2">
              <span className="inline-flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium rounded border border-indigo-100 bg-indigo-50 text-indigo-700">
                <Landmark className="w-3 h-3" /> Signed in as {CURRENT.name}
                <span className="font-mono text-indigo-600/80">· {CURRENT.id}</span>
              </span>
              <span className="text-[11px] text-slate-500">Every release is signed and logged.</span>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <MoneyTile label="Pending release" value={money.pending} tone="amber" icon={Wallet} />
            <MoneyTile label="Released (all)" value={money.approved} tone="emerald" icon={CheckCircle2} />
            <MoneyTile label="Released · this month" value={money.thisMonth} tone="indigo" icon={TrendingUp} />
          </div>
        </div>

        <div className="flex items-center gap-1 border-b border-slate-200 -mx-4 sm:-mx-6 px-4 sm:px-6 overflow-x-auto">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => { setTab(t.id); setChecked(new Set()); }}
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


      <div className="mx-4 sm:mx-6 mt-4 grid grid-cols-1 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-4 h-[calc(100vh-14rem)] min-h-[600px]">
        <div className="bg-white border border-slate-200 rounded-lg flex flex-col overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-3 flex-wrap">
            <input type="checkbox" checked={filtered.length > 0 && checked.size === filtered.length} onChange={toggleAll}
              className="w-3.5 h-3.5 rounded border-slate-300 accent-slate-900" />
            {checked.size > 0 ? (
              <div className="flex items-center gap-2 flex-1 flex-wrap">
                <span className="text-xs text-slate-600 font-medium">
                  {checked.size} selected · <span className="font-mono tabular-nums text-slate-900">{fmtINR(selectedTotal)}</span>
                </span>
                <button onClick={() => void applyAction([...checked], "approve", `Batch release · ${fmtINR(selectedTotal)}`)}
                  className="px-3 py-1 text-[11px] font-semibold bg-emerald-600 text-white rounded hover:bg-emerald-700">
                  Release funds
                </button>
                <button onClick={() => setChecked(new Set())} className="text-[11px] text-slate-500 hover:text-slate-900 ml-auto">Clear</button>
              </div>
            ) : (
              <>
                <FinTypeFilter value={typeFilter} onChange={setTypeFilter} />
                <PriorityFilter value={priorityFilter} onChange={setPriorityFilter} />
                <SortFilter value={sortBy} onChange={setSortBy} />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter by ID, subject, employee…"
                  className="flex-1 min-w-[160px] text-xs bg-slate-50 border border-slate-200 rounded px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:bg-white" />
                <span className="text-[11px] text-slate-400 tabular-nums shrink-0">{filtered.length} results</span>
              </>
            )}
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
            {filtered.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-400">Treasury clear. Nothing awaiting release.</div>
            ) : filtered.map((r) => (
              <RequestRow key={r.id} request={r} selected={selected?.id === r.id}
                checked={checked.has(r.id)} onToggleCheck={toggleCheck} onSelect={setSelectedId} />
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          {selected ? <RequestDetail request={selected} onAction={onDetailAction} /> : (
            <div className="h-full grid place-items-center text-sm text-slate-400">Select a request to review.</div>
          )}
        </div>
      </div>

    </DashboardLayout>
  );
}

function FinTypeFilter({ value, onChange }: { value: RequestType | "all"; onChange: (v: RequestType | "all") => void }) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value as RequestType | "all")}
        className="appearance-none text-xs bg-slate-50 border border-slate-200 rounded pl-2.5 pr-7 py-1 focus:outline-none focus:ring-2 focus:ring-slate-300">
        <option value="all">All financial types</option>
        {FINANCIAL.map((t) => <option key={t} value={t}>{typeLabels[t]}</option>)}
      </select>
      <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  );
}

function PriorityFilter({ value, onChange }: { value: Priority | "all"; onChange: (v: Priority | "all") => void }) {
  const opts: { v: Priority | "all"; label: string }[] = [
    { v: "all", label: "Any priority" }, { v: "urgent", label: "Urgent" },
    { v: "high", label: "High" }, { v: "normal", label: "Normal" }, { v: "low", label: "Low" },
  ];
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value as Priority | "all")}
        className="appearance-none text-xs bg-slate-50 border border-slate-200 rounded pl-2.5 pr-7 py-1 focus:outline-none focus:ring-2 focus:ring-slate-300">
        {opts.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
      </select>
      <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  );
}

function SortFilter({ value, onChange }: { value: SortKey; onChange: (v: SortKey) => void }) {
  const opts: { v: SortKey; label: string }[] = [
    { v: "amount", label: "Sort: Amount ↓" },
    { v: "priority", label: "Sort: Priority" },
    { v: "newest", label: "Sort: Newest" },
    { v: "oldest", label: "Sort: Oldest" },
  ];
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value as SortKey)}
        className="appearance-none text-xs bg-slate-50 border border-slate-200 rounded pl-2.5 pr-7 py-1 focus:outline-none focus:ring-2 focus:ring-slate-300">
        {opts.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
      </select>
      <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  );
}

const tones = {
  amber: "border-l-amber-400 text-amber-700",
  emerald: "border-l-emerald-400 text-emerald-700",
  indigo: "border-l-indigo-400 text-indigo-700",
} as const;

function MoneyTile({ label, value, tone, icon: Icon }: { label: string; value: number; tone: keyof typeof tones; icon: typeof Wallet }) {
  return (
    <div className={`px-3.5 py-2.5 bg-white border border-slate-200 border-l-4 rounded-md min-w-[150px] ${tones[tone].split(" ")[0]}`}>
      <div className="flex items-center gap-1.5">
        <Icon className={`w-3 h-3 ${tones[tone].split(" ")[1]}`} />
        <p className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">{label}</p>
      </div>
      <p className="text-lg font-display font-semibold text-slate-900 tabular-nums mt-0.5">{fmtINR(value)}</p>
    </div>
  );
}
