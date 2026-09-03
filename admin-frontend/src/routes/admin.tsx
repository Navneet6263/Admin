import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { InventoryPanel } from "@/components/InventoryPanel";
import { useInventory, isLow } from "@/components/liveInventory";
import { priorityRank, type RequestItem, type RequestStatus, type RequestType, type Priority } from "@/components/models";
import { KpiTile, type SortKey, type AgeFilterKey } from "@/components/hq-admin/AdminFilters";
import { HqQueuePanel } from "@/components/hq-admin/HqQueuePanel";
import { HqAnalyticsPanel } from "@/components/hq-admin/HqAnalyticsPanel";
import { ExpenseAnalytics } from "@/components/analytics/ExpenseAnalytics";
import { CenterCombobox, type CenterOption } from "@/components/CenterCombobox";
import { TeamTab } from "@/components/super-admin/TeamTab";
import { getPagedRequests, request, toRequest } from "@/lib/api";
import { useSessionUser } from "@/lib/useSessionUser";
import { Filter, Inbox, Send, CheckCircle2, XCircle, ShieldCheck, Package, AlertTriangle, CircleDollarSign, Users, LineChart, Undo2 } from "lucide-react";
import { protectedRoute } from "@/components/ProtectedRoute";
import { MasterDetailLoadingSkeleton } from "@/components/LoadingSkeletons";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "HQ Admin Console — RequestHub" },
      { name: "description", content: "HQ request queue. Review, approve, reject and escalate to Super Admin." },
    ],
  }),
  component: protectedRoute(HqAdminConsole, ['hq_admin']),
});

type Tab = "inbox" | "queued" | "ready_to_assign" | "delivery_issues" | "approved" | "rejected" | "withdrawn" | "all";
type QueueSummary = Record<Tab, number>;
type QueuePage = { data: RequestItem[]; total: number; summary?: QueueSummary };

function HqAdminConsole() {
  const sessionUser = useSessionUser();

  const currentAdmin = useMemo(() => ({
    id: sessionUser?.id ? `USR-${sessionUser.id}` : "",
    name: sessionUser?.name || "Authenticated HQ Admin",
    role: sessionUser?.dept || "HQ Admin",
  }), [sessionUser]);

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
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<QueueSummary>({ inbox: 0, queued: 0, ready_to_assign: 0, delivery_issues: 0,
    approved: 0, rejected: 0, withdrawn: 0, all: 0 });
  const [actionError, setActionError] = useState("");
  const [initialLoading, setInitialLoading] = useState(true);
  const [selectedDetail, setSelectedDetail] = useState<RequestItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const queueRequest = useRef<AbortController | null>(null);
  const queueCache = useRef(new Map<string, { at: number; page: QueuePage }>());
  const hasLoadedQueue = useRef(false);
  const detailCache = useRef(new Map<number, { updatedAt: string; request: RequestItem }>());
  const pageSize = 25;
  const inventory = useInventory(view === "inventory");
  const lowStockCount = inventory.filter(isLow).length;

  const refresh = useCallback(async (showLoading = false) => {
    if (showLoading && !hasLoadedQueue.current) setInitialLoading(true);
    const cacheKey = `${tab}:${page}:${centerFilter || "all"}`;
    const cached = queueCache.current.get(cacheKey);
    if (showLoading && cached && Date.now() - cached.at < 15_000) {
      setRequests(cached.page.data); setTotal(cached.page.total);
      if (cached.page.summary) setSummary(cached.page.summary);
      hasLoadedQueue.current = true;
      setInitialLoading(false);
      return;
    }
    queueRequest.current?.abort();
    const controller = new AbortController();
    queueRequest.current = controller;
    const center = centerFilter ? `&center_code=${encodeURIComponent(centerFilter)}` : "";
    try {
      const result = await getPagedRequests<QueueSummary>(`/api/workflow/queue?status=${tab}&page=${page}&page_size=${pageSize}&compact=1${center}`,
        { signal: controller.signal });
      if (controller.signal.aborted) return;
      setRequests(result.data); setTotal(result.total);
      if (result.summary) setSummary(result.summary);
      queueCache.current.set(cacheKey, { at: Date.now(), page: result });
    } catch (e) { if (!controller.signal.aborted) console.error(e); }
    finally {
      if (queueRequest.current === controller) {
        queueRequest.current = null;
        hasLoadedQueue.current = true;
        setInitialLoading(false);
      }
    }
  }, [centerFilter, page, tab]);
  useEffect(() => {
    void refresh(true);
    const refreshWhenVisible = () => { if (!document.hidden) void refresh(); };
    const timer = window.setInterval(refreshWhenVisible, 30_000);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      queueRequest.current?.abort();
    };
  }, [refresh]);
  useEffect(() => { void request<CenterOption[]>("/api/centers").then(setCenters).catch(console.error); }, []);

  const counts = summary;

  const filtered = useMemo(() => {
    const byTab = (r: RequestItem) =>
      tab === "all" ? true :
      tab === "inbox" ? (r.status === "pending" || r.status === "info_requested") :
      tab === "ready_to_assign" ? r.fulfillmentStatus === "ready_to_assign" :
      tab === "delivery_issues" ? r.receiptStatus === "disputed" :
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

  const selectedSummary = filtered.find((r) => r.id === selectedId) ?? filtered[0];
  const selected = selectedDetail?.dbId === selectedSummary?.dbId
    && selectedDetail.updatedAt === selectedSummary?.updatedAt ? selectedDetail : selectedSummary;

  useEffect(() => {
    if (!selectedSummary?.dbId) { setSelectedDetail(null); setDetailLoading(false); return; }
    const requestId = selectedSummary.dbId;
    const cached = detailCache.current.get(requestId);
    if (cached?.updatedAt === selectedSummary.updatedAt) {
      setSelectedDetail(cached.request);
      setDetailLoading(false);
      return;
    }
    const controller = new AbortController();
    setSelectedDetail(null);
    setDetailLoading(true);
    void request<Record<string, unknown>>(`/api/workflow/requests/${requestId}`, { signal: controller.signal })
      .then((row) => {
        if (controller.signal.aborted) return;
        const detail = toRequest(row);
        detailCache.current.set(requestId, { updatedAt: selectedSummary.updatedAt, request: detail });
        setSelectedDetail(detail);
      })
      .catch((cause) => { if (!controller.signal.aborted) setActionError(cause instanceof Error ? cause.message : "Request details unavailable"); })
      .finally(() => { if (!controller.signal.aborted) setDetailLoading(false); });
    return () => controller.abort();
  }, [selectedSummary?.dbId, selectedSummary?.updatedAt]);

  const applyAction = useCallback(async (ids: string[], action: "approve" | "reject" | "queue" | "info", note: string) => {
    queueCache.current.clear();
    setChecked(new Set());
    setPage(1);
    try {
      setActionError("");
      await Promise.all(ids.map((id) =>
        request(`/api/workflow/requests/${requests.find((r) => r.id === id)?.dbId}/${action}`, { method: "POST", body: { remarks: note } }),
      ));
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "HQ action failed");
    } finally {
      if (page === 1) await refresh();
    }
  }, [refresh, requests, page]);

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

  const assignItem = useCallback(async (item: RequestItem) => {
    if (!item.dbId) return;
    if (!window.confirm(`Confirm ${item.id} has been handed over to ${item.employeeName}?`)) return;
    try {
      setActionError("");
      await request(`/api/workflow/requests/${item.dbId}/assign`, { method: "POST", body: { remarks: "Item handed over to employee" } });
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Handover could not be saved");
    } finally { await refresh(); }
  }, [refresh]);

  const resolveIssue = useCallback(async (item: RequestItem) => {
    if (!item.dbId) return;
    if (!window.confirm(`Mark ${item.id} delivery issue as resolved and ask the employee to confirm again?`)) return;
    try {
      setActionError("");
      await request(`/api/workflow/requests/${item.dbId}/resolve-delivery`, { method: "POST",
        body: { remarks: "Delivery issue resolved. Employee asked to confirm receipt again." } });
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Delivery issue could not be resolved");
    } finally { await refresh(); }
  }, [refresh]);

  const kpis = [
    { label: "In your inbox", value: counts.inbox, tone: "amber" as const },
    { label: "Ready to Assign", value: counts.ready_to_assign, tone: "indigo" as const,
      onClick: () => { setView("requests"); setTab("ready_to_assign"); setPage(1); } },
    { label: "Delivery Issues", value: counts.delivery_issues, tone: "rose" as const,
      onClick: () => { setView("requests"); setTab("delivery_issues"); setPage(1); } },
    { label: "Awaiting Super Admin", value: counts.queued, tone: "indigo" as const },
    { label: "Approved (all time)", value: counts.approved, tone: "emerald" as const },
    { label: "Rejected (all time)", value: counts.rejected, tone: "rose" as const },
  ];

  const tabs: { id: Tab; label: string; icon: typeof Inbox; count: number }[] = [
    { id: "inbox", label: "Inbox", icon: Inbox, count: counts.inbox },
    { id: "queued", label: "Queued · Super Admin", icon: Send, count: counts.queued },
    { id: "ready_to_assign", label: "Ready to Assign", icon: Package, count: counts.ready_to_assign },
    { id: "delivery_issues", label: "Delivery Issues", icon: AlertTriangle, count: counts.delivery_issues },
    { id: "approved", label: "Approved", icon: CheckCircle2, count: counts.approved },
    { id: "rejected", label: "Rejected", icon: XCircle, count: counts.rejected },
    { id: "withdrawn", label: "Withdrawn", icon: Undo2, count: counts.withdrawn },
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
          <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
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
              <button key={t.id} type="button" onClick={() => { setTab(t.id); setPage(1); setChecked(new Set()); }}
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
      ) : initialLoading ? (
        <div className="mx-4 mt-4 sm:mx-6"><MasterDetailLoadingSkeleton /></div>
      ) : (
        <>{actionError && <div className="mx-4 mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700 sm:mx-6">{actionError}</div>}<HqQueuePanel
          filtered={filtered} selected={selected} detailLoading={detailLoading} checked={checked}
          page={page} pageSize={pageSize} total={total} onPageChange={setPage}
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
          onAssign={(item) => void assignItem(item)}
          onResolveIssue={(item) => void resolveIssue(item)}
          onDetailAction={onDetailAction}
        /></>
      )}
    </DashboardLayout>
  );
}
