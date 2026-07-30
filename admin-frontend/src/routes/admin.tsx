import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { RequestRow } from "@/components/RequestRow";
import { RequestDetail } from "@/components/RequestDetail";
import { InventoryPanel } from "@/components/InventoryPanel";
import { inventoryStore, useInventory, isLow } from "@/components/liveInventory";
import { priorityRank, typeLabels, type RequestItem, type RequestStatus, type RequestType, type Priority } from "@/components/models";
import { companies } from "@/components/company";
import { getRequests, request } from "@/lib/api";
import { Filter, Inbox, Send, CheckCircle2, XCircle, ChevronDown, ShieldCheck, Package, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Console — RequestHub" },
      { name: "description", content: "Enterprise request queue for the admin team. Review, approve, reject and escalate to Super Admin." },
    ],
  }),
  component: AdminConsole,
});

type Tab = "inbox" | "queued" | "approved" | "rejected" | "all";
type SortKey = "priority" | "newest" | "oldest" | "amount";
const CURRENT_ADMIN = { id: "ADM-001", name: "John Admin", role: "Admin" };
const actorTag = () => `${CURRENT_ADMIN.name} (${CURRENT_ADMIN.id})`;

const autoNote = (action: "approve" | "reject" | "queue" | "info", userNote: string) => {
  const ts = new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  const verb =
    action === "approve" ? "Approved · sent to Verifier" :
    action === "reject" ? "Rejected" :
    action === "queue" ? "Queued for Super Admin" : "Info requested";
  const head = `${verb} by ${actorTag()} · ${ts} IST`;
  return userNote?.trim() ? `${head}\n— ${userNote.trim()}` : head;
};

function AdminConsole() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [view, setView] = useState<"requests" | "inventory">("requests");
  const [tab, setTab] = useState<Tab>("inbox");
  const [typeFilter, setTypeFilter] = useState<RequestType | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "all">("all");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortKey>("priority");
  const [query, setQuery] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string>("");
  const inventory = useInventory();
  const lowStockCount = inventory.filter(isLow).length;
  const refresh = useCallback(async () => {
    try { setRequests(await getRequests('/api/requests')); } catch (error) { console.error(error); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const counts = useMemo(() => ({
    inbox: requests.filter((r) => r.status === "pending" || r.status === "info_requested").length,
    queued: requests.filter((r) => r.status === "queued").length,
    approved: requests.filter((r) => r.status === "approved").length,
    rejected: requests.filter((r) => r.status === "rejected").length,
    all: requests.length,
  }), [requests]);

  const filtered = useMemo(() => {
    const byTab = (r: RequestItem) =>
      tab === "all" ? true :
      tab === "inbox" ? (r.status === "pending" || r.status === "info_requested") :
      r.status === (tab as RequestStatus);
    const q = query.trim().toLowerCase();
    const sorter = (a: RequestItem, b: RequestItem) => {
      if (sortBy === "newest") return +new Date(b.updatedAt) - +new Date(a.updatedAt);
      if (sortBy === "oldest") return +new Date(a.updatedAt) - +new Date(b.updatedAt);
      if (sortBy === "amount") return (b.amount ?? 0) - (a.amount ?? 0);
      return priorityRank[a.priority] - priorityRank[b.priority] || +new Date(b.updatedAt) - +new Date(a.updatedAt);
    };
    return requests
      .filter(byTab)
      .filter((r) => typeFilter === "all" || r.type === typeFilter)
      .filter((r) => priorityFilter === "all" || r.priority === priorityFilter)
      .filter((r) => companyFilter === "all" || r.company === companyFilter)
      .filter((r) => !q || r.id.toLowerCase().includes(q) || r.subject.toLowerCase().includes(q) || r.employeeName.toLowerCase().includes(q))
      .sort(sorter);
  }, [requests, tab, typeFilter, priorityFilter, companyFilter, sortBy, query]);


  const selected = requests.find((r) => r.id === selectedId) ?? filtered[0];

  const applyAction = useCallback(async (ids: string[], action: "approve" | "reject" | "queue" | "info", note: string) => {
    const approvedGroups: { refId: string; picks: { sku: string; qty: number }[] }[] = [];
    setRequests((prev) => prev.map((r) => {
      if (!ids.includes(r.id)) return r;
      const at = new Date().toISOString();
      const nextStatus: RequestStatus =
        action === "approve" ? "awaiting_verification" :
        action === "reject" ? "rejected" :
        action === "queue" ? "queued" : "info_requested";
      const auditAction =
        action === "approve" ? "approved" :
        action === "reject" ? "rejected" :
        action === "queue" ? "queued" : "info_requested";
      // Deduct stationery inventory on approve
      let deductNote = "";
      if (action === "approve" && r.type === "stationery" && r.items?.length) {
        approvedGroups.push({ refId: r.id, picks: r.items.map((i) => ({ sku: i.sku, qty: i.qty })) });
        deductNote = `\nInventory adjusted: ${r.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}.`;
      }
      return {
        ...r,
        status: nextStatus,
        updatedAt: at,
        audit: [...r.audit, { at, actor: actorTag(), action: auditAction, note: autoNote(action, note) + deductNote }],
      };
    }));
    approvedGroups.forEach((g) => inventoryStore.deduct(g.picks, { refId: g.refId, actor: actorTag() }));
    setChecked(new Set());
    await Promise.all(ids.map(id => request(`/api/admin/requests/${requests.find(r => r.id === id)?.dbId}/${action}`, { method: 'POST', body: { remarks: note } })));
    await refresh();
  }, [refresh, requests]);


  const onDetailAction = useCallback((id: string, action: "approve" | "reject" | "queue" | "info" | "verify" | "send_back", note: string) => {
    if (action === "verify" || action === "send_back") return;
    void applyAction([id], action, note);
  }, [applyAction]);

  const toggleCheck = useCallback((id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = () => {
    if (checked.size === filtered.length) setChecked(new Set());
    else setChecked(new Set(filtered.map((r) => r.id)));
  };

  const kpis = [
    { label: "In your inbox", value: counts.inbox, tone: "amber" as const },
    { label: "Awaiting Super Admin", value: counts.queued, tone: "indigo" as const },
    { label: "Approved (all time)", value: counts.approved, tone: "emerald" as const },
    { label: "Rejected (all time)", value: counts.rejected, tone: "rose" as const },
  ];

  const tabs: { id: Tab; label: string; icon: typeof Inbox; count: number }[] = [
    { id: "inbox", label: "Inbox", icon: Inbox, count: counts.inbox },
    { id: "queued", label: "Queued · Super Admin", icon: Send, count: counts.queued },
    { id: "approved", label: "Approved", icon: CheckCircle2, count: counts.approved },
    { id: "rejected", label: "Rejected", icon: XCircle, count: counts.rejected },
    { id: "all", label: "All", icon: Filter, count: counts.all },
  ];

  return (
    <DashboardLayout workspace="Admin Console" role="Administrator" currentUser={`${CURRENT_ADMIN.name} · ${CURRENT_ADMIN.id}`}>
      <div className="px-4 sm:px-6 pt-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">Admin · Request Operations</p>
            <h1 className="font-display text-2xl font-semibold text-slate-900">{view === "requests" ? "Approval Queue" : "Stationery Inventory"}</h1>
            <div className="flex items-center gap-2 mt-2">
              <span className="inline-flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium rounded border border-emerald-100 bg-emerald-50 text-emerald-700">
                <ShieldCheck className="w-3 h-3" /> Signed in as {CURRENT_ADMIN.name}
                <span className="font-mono text-emerald-600/80">· {CURRENT_ADMIN.id}</span>
              </span>
              <span className="text-[11px] text-slate-500">Every action is signed and logged.</span>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {kpis.map((k) => <KpiTile key={k.label} {...k} />)}
          </div>
        </div>

        {/* View switcher */}
        <div className="flex items-center gap-2 mb-3">
          <button onClick={() => setView("requests")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors ${
              view === "requests" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
            }`}>
            <Inbox className="w-3.5 h-3.5" /> Requests
          </button>
          <button onClick={() => setView("inventory")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors ${
              view === "inventory" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
            }`}>
            <Package className="w-3.5 h-3.5" /> Inventory
            {lowStockCount > 0 && (
              <span className={`ml-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-bold rounded ${
                view === "inventory" ? "bg-white/20 text-white" : "bg-rose-100 text-rose-700"
              }`}>
                <AlertTriangle className="w-2.5 h-2.5" /> {lowStockCount}
              </span>
            )}
          </button>
          {lowStockCount > 0 && view === "requests" && (
            <button onClick={() => setView("inventory")} className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-rose-700 bg-rose-50 border border-rose-100 rounded-md hover:bg-rose-100 transition-colors">
              <AlertTriangle className="w-3 h-3" /> {lowStockCount} stationery item{lowStockCount > 1 ? "s" : ""} running low
            </button>
          )}
        </div>

        {/* Tabs */}
        {view === "requests" && (
          <div className="flex items-center gap-1 border-b border-slate-200 -mx-4 sm:-mx-6 px-4 sm:px-6 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.id} onClick={() => { setTab(t.id); setChecked(new Set()); }}
                className={`flex items-center gap-2 px-3 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                  tab === t.id ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <t.icon className="w-3.5 h-3.5" />
                {t.label}
                <span className={`px-1.5 py-0.5 rounded text-[10px] tabular-nums ${tab === t.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"}`}>{t.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {view === "inventory" ? (
        <div className="mx-4 sm:mx-6 mt-4 h-[calc(100vh-13rem)] min-h-[560px]">
          <InventoryPanel />
        </div>
      ) : (
      <div className="mx-4 sm:mx-6 mt-4 grid grid-cols-1 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-4 h-[calc(100vh-16rem)] min-h-[600px]">
        {/* List panel */}
        <div className="bg-white border border-slate-200 rounded-lg flex flex-col overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-3">
            <input
              type="checkbox"
              checked={filtered.length > 0 && checked.size === filtered.length}
              onChange={toggleAll}
              className="w-3.5 h-3.5 rounded border-slate-300 accent-slate-900"
            />
            {checked.size > 0 ? (
              <div className="flex items-center gap-2 flex-1">
                <span className="text-xs text-slate-600 font-medium">{checked.size} selected</span>
                <button onClick={() => void applyAction([...checked], "queue", `Batch-forwarded ${checked.size} requests to Super Admin`)}
                  className="px-3 py-1 text-[11px] font-semibold bg-indigo-600 text-white rounded hover:bg-indigo-700">
                  Queue for Super Admin
                </button>
                <button onClick={() => void applyAction([...checked], "approve", "")}
                  className="px-3 py-1 text-[11px] font-semibold bg-emerald-600 text-white rounded hover:bg-emerald-700">
                  Approve all
                </button>
                <button onClick={() => setChecked(new Set())} className="text-[11px] text-slate-500 hover:text-slate-900 ml-auto">Clear</button>
              </div>
            ) : (
              <>
                <TypeFilter value={typeFilter} onChange={setTypeFilter} />
                <PriorityFilter value={priorityFilter} onChange={setPriorityFilter} />
                <CompanyFilter value={companyFilter} onChange={setCompanyFilter} />
                <SortFilter value={sortBy} onChange={setSortBy} />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter by ID, subject, employee…"
                  className="flex-1 min-w-[160px] text-xs bg-slate-50 border border-slate-200 rounded px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:bg-white" />
                <span className="text-[11px] text-slate-400 tabular-nums shrink-0">{filtered.length} results</span>
              </>
            )}
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
            {filtered.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-400">Nothing here. Inbox zero.</div>
            ) : filtered.map((r) => (
              <RequestRow key={r.id} request={r} selected={selected?.id === r.id}
                checked={checked.has(r.id)} onToggleCheck={toggleCheck} onSelect={setSelectedId} />
            ))}
          </div>
        </div>

        {/* Detail panel */}
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          {selected ? <RequestDetail request={selected} onAction={onDetailAction} /> : (
            <div className="h-full grid place-items-center text-sm text-slate-400">Select a request to review.</div>
          )}
        </div>
      </div>
      )}
    </DashboardLayout>
  );
}

function TypeFilter({ value, onChange }: { value: RequestType | "all"; onChange: (v: RequestType | "all") => void }) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value as RequestType | "all")}
        className="appearance-none text-xs bg-slate-50 border border-slate-200 rounded pl-2.5 pr-7 py-1 focus:outline-none focus:ring-2 focus:ring-slate-300">
        <option value="all">All categories</option>
        {(Object.keys(typeLabels) as RequestType[]).map((t) => (
          <option key={t} value={t}>{typeLabels[t]}</option>
        ))}
      </select>
      <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  );
}

function PriorityFilter({ value, onChange }: { value: Priority | "all"; onChange: (v: Priority | "all") => void }) {
  const opts: { v: Priority | "all"; label: string }[] = [
    { v: "all", label: "Any priority" },
    { v: "urgent", label: "Urgent" }, { v: "high", label: "High" },
    { v: "normal", label: "Normal" }, { v: "low", label: "Low" },
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

function CompanyFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="appearance-none text-xs bg-slate-50 border border-slate-200 rounded pl-2.5 pr-7 py-1 focus:outline-none focus:ring-2 focus:ring-slate-300">
        <option value="all">All companies</option>
        {companies.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.name}</option>)}
      </select>
      <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  );
}


function SortFilter({ value, onChange }: { value: SortKey; onChange: (v: SortKey) => void }) {
  const opts: { v: SortKey; label: string }[] = [
    { v: "priority", label: "Sort: Priority" },
    { v: "newest", label: "Sort: Newest" },
    { v: "oldest", label: "Sort: Oldest" },
    { v: "amount", label: "Sort: Amount ↓" },
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

const kpiTone = {
  amber: "border-l-amber-400",
  indigo: "border-l-indigo-400",
  emerald: "border-l-emerald-400",
  rose: "border-l-rose-400",
} as const;

function KpiTile({ label, value, tone }: { label: string; value: number; tone: keyof typeof kpiTone }) {
  return (
    <div className={`px-3.5 py-2.5 bg-white border border-slate-200 border-l-4 rounded-md min-w-[130px] ${kpiTone[tone]}`}>
      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">{label}</p>
      <p className="text-xl font-display font-semibold text-slate-900 tabular-nums mt-0.5">{value}</p>
    </div>
  );
}
