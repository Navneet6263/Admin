import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  TrendingUp, TrendingDown, Wallet, CheckCircle2, Clock, AlertTriangle,
  Download, ShieldCheck, Crown, Gauge, Building2, LineChart, Boxes, UserPlus, KeyRound
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { CenterCombobox } from "@/components/CenterCombobox";
import { type RequestItem, type RequestStatus } from "@/components/models";
import { getRequests, request } from "@/lib/api";
import { useSessionUser } from "@/lib/useSessionUser";

import { autoNote, buildHistory, fmtINR, type Tab, type UserRow, type CenterRow } from "@/components/super-admin/shared";
import { StatChip } from "@/components/super-admin/widgets";
import { OverviewTab } from "@/components/super-admin/OverviewTab";
import { AnalyticsTab } from "@/components/super-admin/AnalyticsTab";
import { OverrideTab } from "@/components/super-admin/OverrideTab";
import { AnomaliesTab } from "@/components/super-admin/AnomaliesTab";
import { InventoryTab } from "@/components/super-admin/InventoryTab";
import { TeamTab } from "@/components/super-admin/TeamTab";
import { CentersAssignmentPanel } from "@/components/super-admin/CentersPanel";
import { PolicyTab } from "@/components/super-admin/PolicyTab";

export const Route = createFileRoute("/super-admin")({
  head: () => ({
    meta: [
      { title: "Super Admin — RequestHub · Vision India" },
      { name: "description", content: "Group-wide executive console — insights, advanced analytics, override center and anomaly signals for Vision India Group." },
    ],
  }),
  component: SuperAdmin,
});

function SuperAdmin() {
  const sessionUser = useSessionUser();
  const [authenticated, setAuthenticated] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<RequestStatus | "all">("all");

  // Centers state
  const [centerUsers, setCenterUsers] = useState<UserRow[]>([]);
  const [centers, setCenters] = useState<CenterRow[]>([]);
  const [centerSearch, setCenterSearch] = useState("");
  const [scopeCenter, setScopeCenter] = useState("");

  const loadCentersData = useCallback(async () => {
    try {
      const [users, ctrs] = await Promise.all([
        request<UserRow[]>('/api/super-admin/users'),
        request<CenterRow[]>('/api/centers'),
      ]);
      setCenterUsers(users);
      setCenters(ctrs);
    } catch (e) { console.error(e); }
  }, []);

  const refresh = useCallback(async () => {
    const center = scopeCenter ? `?center_code=${encodeURIComponent(scopeCenter)}` : "";
    try { setRequests(await getRequests(`/api/requests${center}`)); } catch (error) { console.error(error); }
  }, [scopeCenter]);

  useEffect(() => { if (sessionUser) setAuthenticated(true); }, [sessionUser]);
  useEffect(() => { if (authenticated) void refresh(); }, [authenticated, refresh]);
  useEffect(() => { if (authenticated) void loadCentersData(); }, [authenticated, loadCentersData]);

  const history = useMemo(() => buildHistory(requests), [requests]);
  const actor = sessionUser ? `${sessionUser.name} (USR-${sessionUser.id})` : "Authenticated Super Admin";
  const monthDelta = history.lastMonth > 0
    ? ((history.thisMonth - history.lastMonth) / history.lastMonth) * 100
    : 0;

  const kpis = useMemo(() => {
    const approved = requests.filter(r => r.status === "approved").length;
    const rejected = requests.filter(r => r.status === "rejected").length;
    const closed = requests.filter(r => r.status === "approved" || r.status === "rejected");
    const avgTat = closed.length ? Math.round(
      closed.reduce((a, r) => a + (+new Date(r.updatedAt) - +new Date(r.createdAt))/3_600_000, 0) / closed.length
    ) : 0;
    const rate = approved + rejected > 0 ? Math.round((approved/(approved+rejected))*100) : 0;
    return { approved, rejected, avgTat, rate, total: requests.length };
  }, [requests]);

  const overrideList = useMemo(() => requests
    .filter(r => companyFilter === "all" || r.company === companyFilter)
    .filter(r => statusFilter === "all" || r.status === statusFilter)
    .sort((a,b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)),
    [requests, companyFilter, statusFilter]);

  const selected = requests.find(r => r.id === selectedId) ?? overrideList[0];

  const override = useCallback(async (id: string, next: RequestStatus, verb: string, note: string) => {
    setRequests(prev => prev.map(r => {
      if (r.id !== id) return r;
      const at = new Date().toISOString();
      const action = next === "approved" ? "approved" : next === "rejected" ? "rejected" : next === "queued" ? "queued" : "commented";
      return {
        ...r, status: next, updatedAt: at,
        audit: [...r.audit, { at, actor, action, note: autoNote(actor, verb, note) }],
      };
    }));
    const target = requests.find(r => r.id === id);
    if (target?.dbId) {
      await request(`/api/super-admin/requests/${target.dbId}/override`, { method: 'POST', body: { next_status: next, note } });
      await refresh();
    }
  }, [actor, refresh, requests]);

  const onDetailAction = useCallback((id: string, action: string, note: string) => {
    if (action === "approve") void override(id, "approved", "Force-approved", note);
    else if (action === "reject") void override(id, "rejected", "Force-rejected", note);
    else if (action === "queue") void override(id, "queued", "Held for review", note);
    else if (action === "verify") void override(id, "approved", "Force-closed", note);
    else if (action === "send_back") void override(id, "pending", "Sent back to Admin", note);
  }, [override]);

  const tabs: { id: Tab; label: string; icon: typeof Gauge }[] = [
    { id: "overview", label: "Overview", icon: Gauge },
    { id: "analytics", label: "Advance Analytics", icon: LineChart },
    { id: "inventory", label: "Inventory", icon: Boxes },
    { id: "override", label: "Override Center", icon: ShieldCheck },
    { id: "anomalies", label: "Anomalies & Signals", icon: AlertTriangle },
    { id: "team", label: "Team & Roles", icon: UserPlus },
    { id: "centers", label: "Centers & Locations", icon: Building2 },
    { id: "policies", label: "Approval Policies", icon: KeyRound },
  ];

  return (
    <DashboardLayout workspace="Executive Console" role={sessionUser?.dept || "Super Admin"} currentUser={sessionUser?.name ?? ""} searchQuery={centerSearch} onSearchChange={setCenterSearch}>
      <div className="px-4 sm:px-6 pt-6 pb-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">Vision India Group · Executive</p>
            <h1 className="font-display text-2xl font-semibold text-slate-900 flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-500" /> Super Admin Console
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <span className="inline-flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium rounded border border-indigo-100 bg-indigo-50 text-indigo-700">
                <ShieldCheck className="w-3 h-3" /> Signed in as {sessionUser?.name ?? "Loading…"}
                {sessionUser && <span className="font-mono text-indigo-600/80">· USR-{sessionUser.id}</span>}
              </span>
              <span className="text-[11px] text-slate-500">Full override authority · every action signed.</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-2">
              {scopeCenter && <button type="button" onClick={() => setScopeCenter("")}
                className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800">All Centers</button>}
              <CenterCombobox centers={centers} value={scopeCenter} onChange={setScopeCenter}
                placeholder="All centers · filter scope…" className="w-64" />
            </div>
            <StatChip icon={Wallet} label="Rolling 12M spend" value={fmtINR(history.grandTotal)} />
            <StatChip icon={monthDelta >= 0 ? TrendingUp : TrendingDown} label="This month"
              value={fmtINR(history.thisMonth)} sub={`${monthDelta>=0?"▲":"▼"} ${Math.abs(monthDelta).toFixed(1)}%`}
              tone={monthDelta >= 0 ? "rose" : "emerald"} />
            <StatChip icon={CheckCircle2} label="Approval rate" value={`${kpis.rate}%`} sub={`${kpis.approved}/${kpis.total}`} />
            <StatChip icon={Clock} label="Avg TAT" value={`${kpis.avgTat}h`} />
          </div>
        </div>

        {/* Tabs */}
        <div className="-mx-4 mt-5 border-b border-slate-200 sm:-mx-6">
          <div className="request-scrollbar flex min-h-11 items-stretch gap-1 overflow-x-auto px-4 sm:px-6">
            {tabs.map((t) => {
              const isActive = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`relative flex h-11 shrink-0 items-center gap-1.5 px-3 text-xs font-medium leading-none whitespace-nowrap transition-colors duration-150 ${
                    isActive ? "text-slate-900" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <t.icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                  {t.label}
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none absolute inset-x-2 bottom-0 h-0.5 rounded-full ${
                      isActive ? "bg-slate-900" : "bg-transparent"
                    }`}
                  />
                </button>
              );
            })}
            <button className="ml-auto inline-flex h-11 shrink-0 items-center gap-1.5 px-2.5 text-[11px] font-medium leading-none whitespace-nowrap text-slate-600 transition-colors duration-150 hover:text-slate-900">
              <Download className="h-3 w-3 shrink-0" /> Export CSV
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 pb-10">
        {tab === "overview" && <OverviewTab requests={requests} centerCode={scopeCenter} />}
        {tab === "analytics" && <AnalyticsTab requests={requests} history={history} centerCode={scopeCenter} />}
        {tab === "inventory" && <InventoryTab />}
        {tab === "override" && (
          <OverrideTab
            list={overrideList} selected={selected}
            companyFilter={companyFilter} setCompanyFilter={setCompanyFilter}
            statusFilter={statusFilter} setStatusFilter={setStatusFilter}
            onSelect={setSelectedId} onAction={onDetailAction}
          />
        )}
        {tab === "anomalies" && <AnomaliesTab requests={requests} />}
        {tab === "team" && <TeamTab />}
        {tab === "policies" && <PolicyTab />}
        {tab === "centers" && (
          <CentersAssignmentPanel
            users={centerUsers} centers={centers}
            onLoad={loadCentersData}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
