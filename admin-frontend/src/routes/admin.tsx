import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { InventoryPanel } from "@/components/InventoryPanel";
import { inventoryStore, useInventory, isLow } from "@/components/liveInventory";
import { priorityRank, type RequestItem, type RequestStatus, type RequestType, type Priority } from "@/components/models";
import { KpiTile, type SortKey, type AgeFilterKey } from "@/components/hq-admin/AdminFilters";
import { HqQueuePanel } from "@/components/hq-admin/HqQueuePanel";
import { HqAnalyticsPanel } from "@/components/hq-admin/HqAnalyticsPanel";
import { ExpenseAnalytics } from "@/components/analytics/ExpenseAnalytics";
import { CenterCombobox, type CenterOption } from "@/components/CenterCombobox";
import { TeamTab } from "@/components/super-admin/TeamTab";
import { getPagedRequests, request } from "@/lib/api";
import { useSessionUser } from "@/lib/useSessionUser";
import { Filter, Inbox, Send, CheckCircle2, XCircle, ShieldCheck, Package, AlertTriangle, CircleDollarSign, Users, LineChart } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "HQ Admin Console — RequestHub" },
      { name: "description", content: "HQ request queue. Review, approve, reject and escalate to Super Admin." },
    ],
  }),
  component: HqAdminConsole,
});

type Tab = "inbox" | "queued" | "approved" | "rejected" | "all";

function HqAdminConsole() {
  const sessionUser = useSessionUser();

  const currentAdmin = useMemo(() => ({
    id: sessionUser?.id ? `USR-${sessionUser.id}` : "",
    name: sessionUser?.name || "Authenticated HQ Admin",
    role: sessionUser?.dept || "HQ Admin",
  }), [sessionUser]);

  const actorTag = useCallback(() => `${currentAdmin.name} (${currentAdmin.id})`, [currentAdmin]);
  const autoNote = useCallback((action: "approve" | "reject" | "queue" | "info", userNote: string) => {
    const ts = new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
    const verb =
      action === "approve" ? "Approved · sent to Verifier" :
      action === "reject" ? "Rejected" :
      action === "queue" ? "Queued for Super Admin" : "Info requested";
    const head = `${verb} by ${actorTag()} · ${ts} IST`;
    return userNote?.trim() ? `${head}\n— ${userNote.trim()}` : head;
  }, [actorTag]);

  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [view, setView] = useState<"requests" | "analytics" | "inventory" | "expenses" | "team">("requests");
  const [tab, setTab] = useState<Tab>("inbox");
  const [typeFilter, setTypeFilter] = useState<RequestType | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "all">("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [ageFilter, setAgeFilter] = useState<AgeFilterKey>("today");
  const [sortBy, setSortBy] = useState<SortKey>("priority");
  const [query, setQuery] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState("");
  const [centers, setCenters] = useState<CenterOption[]>([]);
  const [centerFilter, setCenterFilter] = useState("");
  const inventory = useInventory();
  const lowStockCount = inventory.filter(isLow).length;

  const refresh = useCallback(async () => {
    const center = centerFilter ? `&center_code=${encodeURIComponent(centerFilter)}` : "";
    try { setRequests((await getPagedRequests(`/api/workflow/queue?status=all&page_size=100${center}`)).data); } catch (e) { console.error(e); }
  }, [centerFilter]);
  useEffect(() => {
    void refresh();
    void request<CenterOption[]>("/api/centers").then(setCenters).catch(console.error);
    const timer = window.setInterval(() => void refresh(), 15_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

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
    const today = new Date().toDateString();
    return requests.filter(byTab)
      .filter((r) => typeFilter === "all" || r.type === typeFilter)
      .filter((r) => priorityFilter === "all" || r.priority === priorityFilter)
      .filter((r) => companyFilter === "all" || r.company === companyFilter)
      .filter((r) => ageFilter === "all" || (new Date(r.createdAt).toDateString() === today) === (ageFilter === "today"))
      .filter((r) => !q || r.id.toLowerCase().includes(q) || r.subject.toLowerCase().includes(q) || r.employeeName.toLowerCase().includes(q))
      .sort((a, b) => {
        if (sortBy === "newest") return +new Date(b.updatedAt) - +new Date(a.updatedAt);
        if (sortBy === "oldest") return +new Date(a.updatedAt) - +new Date(b.updatedAt);
        if (sortBy === "amount") return (b.amount ?? 0) - (a.amount ?? 0);
        return priorityRank[a.priority] - priorityRank[b.priority] || +new Date(b.updatedAt) - +new Date(a.updatedAt);
      });
  }, [requests, tab, typeFilter, priorityFilter, companyFilter, ageFilter, sortBy, query]);

  const selected = requests.find((r) => r.id === selectedId) ?? filtered[0];

  const applyAction = useCallback(async (ids: string[], action: "approve" | "reject" | "queue" | "info", note: string) => {
    setRequests((prev) => prev.map((r) => {
      if (!ids.includes(r.id)) return r;
      const at = new Date().toISOString();
      const nextStatus: RequestStatus =
        action === "approve" ? "awaiting_verification" :
        action === "reject" ? "rejected" :
        action === "queue" ? "queued" : "info_requested";
      const auditAction = action === "info" ? "info_requested" : action === "approve" ? "approved" : action === "reject" ? "rejected" : "queued";
      let deductNote = "";
      if (action === "approve" && r.type === "stationery" && r.items?.length) {
        deductNote = `\nInventory adjusted: ${r.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}.`;
      }
      return {
        ...r, status: nextStatus, updatedAt: at,
        audit: [...r.audit, { at, actor: actorTag(), action: auditAction, note: autoNote(action, note) + deductNote }],
      };
    }));
    void inventoryStore.deduct();
    setChecked(new Set());
    try {
      await Promise.all(ids.map((id) =>
        request(`/api/workflow/requests/${requests.find((r) => r.id === id)?.dbId}/${action}`, { method: "POST", body: { remarks: note } }),
      ));
    } catch (cause) {
      console.error("HQ action failed:", cause instanceof Error ? cause.message : cause);
    } finally {
      await refresh();
    }
  }, [refresh, requests, actorTag, autoNote]);

  const onDetailAction = useCallback((id: string, action: "approve" | "reject" | "queue" | "info" | "verify" | "send_back", note: string) => {
    if (action === "verify" || action === "send_back") return;
    void applyAction([id], action, note);
  }, [applyAction]);

  const toggleCheck = useCallback((id: string) => {
    if (!requests.find((requestItem) => requestItem.id === id)?.canAct) return;
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, [requests]);

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
    <DashboardLayout
      workspace="HQ Admin Console"
      role={currentAdmin.role}
      currentUser={`${currentAdmin.name} · ${currentAdmin.id}`}
      searchQuery={query}
      onSearchChange={setQuery}
    >
      <div className="px-4 sm:px-6 pt-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">HQ Admin · Request Operations</p>
            <h1 className="font-display text-2xl font-semibold text-slate-900">
              {view === "requests" ? "Approval Queue" : view === "analytics" ? "Advanced Analytics" : view === "inventory" ? "Stationery Inventory" : view === "expenses" ? "Expense Analytics" : "Team & Roles"}
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <span className="inline-flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium rounded border border-emerald-100 bg-emerald-50 text-emerald-700">
                <ShieldCheck className="w-3 h-3" /> Signed in as {currentAdmin.name}
                <span className="font-mono text-emerald-600/80">· {currentAdmin.id}</span>
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {kpis.map((k) => <KpiTile key={k.label} {...k} />)}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <button type="button" onClick={() => setView("requests")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border ${
              view === "requests" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200"
            }`}>
            <Inbox className="w-3.5 h-3.5" /> Requests
          </button>
          <button type="button" onClick={() => setView("inventory")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border ${
              view === "inventory" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200"
            }`}>
            <Package className="w-3.5 h-3.5" /> Inventory
            {lowStockCount > 0 && (
              <span className={`ml-1 px-1.5 py-0.5 text-[9px] font-bold rounded ${view === "inventory" ? "bg-white/20 text-white" : "bg-rose-100 text-rose-700"}`}>
                <AlertTriangle className="w-2.5 h-2.5 inline" /> {lowStockCount}
              </span>
            )}
          </button>
          <button type="button" onClick={() => setView("analytics")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border ${
              view === "analytics" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200"
            }`}><LineChart className="w-3.5 h-3.5" /> Advanced Analytics</button>
          <button type="button" onClick={() => setView("expenses")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border ${
              view === "expenses" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200"
            }`}><CircleDollarSign className="w-3.5 h-3.5" /> Expenses</button>
          <button type="button" onClick={() => setView("team")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border ${
              view === "team" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200"
            }`}><Users className="w-3.5 h-3.5" /> Team & Roles</button>
          {view !== "team" && <div className="ml-auto flex items-center gap-2">
            {centerFilter && <button type="button" onClick={() => setCenterFilter("")}
              className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800">All Centers</button>}
            <CenterCombobox centers={centers} value={centerFilter} onChange={setCenterFilter}
              placeholder="All centers · search to filter…" className="w-64" />
          </div>}
        </div>

        {view === "requests" && (
          <div className="flex items-center gap-1 border-b border-slate-200 -mx-4 sm:-mx-6 px-4 sm:px-6 overflow-x-auto">
            {tabs.map((t) => (
              <button key={t.id} type="button" onClick={() => { setTab(t.id); setChecked(new Set()); }}
                className={`flex items-center gap-2 px-3 py-2.5 text-xs font-medium border-b-2 -mb-px whitespace-nowrap ${
                  tab === t.id ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500"
                }`}>
                <t.icon className="w-3.5 h-3.5" /> {t.label}
                <span className={`px-1.5 py-0.5 rounded text-[10px] tabular-nums ${tab === t.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"}`}>{t.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {view === "inventory" ? (
        <div className="mx-4 sm:mx-6 mt-4 h-[calc(100vh-13rem)] min-h-[560px]"><InventoryPanel /></div>
      ) : view === "analytics" ? (
        <div className="mx-4 sm:mx-6 mt-4 pb-10"><HqAnalyticsPanel requests={requests} centerCode={centerFilter} /></div>
      ) : view === "expenses" ? (
        <div className="mx-4 sm:mx-6 mt-4"><ExpenseAnalytics centerCode={centerFilter} /></div>
      ) : view === "team" ? (
        <div className="mx-4 sm:mx-6 mt-4"><TeamTab mode="hq" /></div>
      ) : (
        <HqQueuePanel
          filtered={filtered} selected={selected} checked={checked}
          typeFilter={typeFilter} priorityFilter={priorityFilter} companyFilter={companyFilter} ageFilter={ageFilter}
          sortBy={sortBy} query={query}
          onTypeFilter={setTypeFilter} onPriorityFilter={setPriorityFilter}
          onCompanyFilter={setCompanyFilter} onAgeFilter={setAgeFilter} onSortBy={setSortBy} onQuery={setQuery}
          onToggleAll={() => {
            const actionableIds = filtered.filter((r) => r.canAct).map((r) => r.id);
            setChecked(checked.size === actionableIds.length ? new Set() : new Set(actionableIds));
          }}
          onToggleCheck={toggleCheck} onSelect={setSelectedId} onClearChecked={() => setChecked(new Set())}
          onBatchQueue={() => void applyAction([...checked], "queue", `Batch-forwarded ${checked.size} requests to Super Admin`)}
          onBatchApprove={() => void applyAction([...checked], "approve", "")}
          onDetailAction={onDetailAction}
        />
      )}
    </DashboardLayout>
  );
}
