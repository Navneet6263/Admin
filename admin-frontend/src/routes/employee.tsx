import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { RequestRow } from "@/components/RequestRow";
import { RequestDetail } from "@/components/RequestDetail";
import { NewRequestDialog } from "@/components/NewRequestDialog";
import { priorityRank, typeLabels, type Priority, type RequestItem, type RequestStatus, type RequestType } from "@/components/models";
import { typeIcon } from "@/components/requestMeta";
import { getRequests, request, session } from "@/lib/api";
import { Plus, Inbox, Send, CheckCircle2, XCircle, Sparkles, AlertTriangle, X } from "lucide-react";
import { protectedRoute } from "@/components/ProtectedRoute";

export const Route = createFileRoute("/employee")({
  head: () => ({
    meta: [
      { title: "My Requests — RequestHub" },
      { name: "description", content: "Employee workspace to raise, track and manage admin requests." },
    ],
  }),
  component: protectedRoute(EmployeeConsole, ['employee']),
});

type Tab = "active" | "approved" | "rejected" | "all";

function EmployeeConsole() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [tab, setTab] = useState<Tab>("active");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [prefillType, setPrefillType] = useState<RequestType | null>(null);
  const [confirmWithdraw, setConfirmWithdraw] = useState<RequestItem | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: number; name: string; email: string; dept: string; company: string; center_code?: string | null }>({
    id: 0, name: "", email: "", dept: "", company: "", center_code: null
  });
  const [centers, setCenters] = useState<Array<{ code: string; name: string; city: string }>>([]);

  const refresh = useCallback(async () => {
    try {
      const me = await request<{ id: number; name: string; email: string; dept: string; company: string; center_code?: string | null }>('/api/auth/me');
      setCurrentUser(me);
      const [mine, centerList] = await Promise.allSettled([
        getRequests(`/api/employee/requests/${me.id}`),
        request<Array<{ code: string; name: string; city: string }>>('/api/centers/public'),
      ]);
      if (mine.status === "fulfilled") setRequests(mine.value);
      else console.error("Unable to refresh employee requests", mine.reason);
      if (centerList.status === "fulfilled") setCenters(centerList.value);
      else console.error("Unable to refresh centers", centerList.reason);
    } catch (error) { console.error(error); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const mine = useMemo(() => {
    if (!currentUser.id) return requests;
    return requests.filter((r) => !r.employeeId || r.employeeId === currentUser.id);
  }, [requests, currentUser.id]);

  const counts = useMemo(() => ({
    active: mine.filter((r) => r.status === "pending" || r.status === "queued" || r.status === "info_requested" || r.status === "awaiting_verification").length,
    approved: mine.filter((r) => r.status === "approved").length,
    rejected: mine.filter((r) => r.status === "rejected").length,
    all: mine.length,
  }), [mine]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const byTab = (r: RequestItem) =>
      tab === "all" ? true :
      tab === "active" ? (r.status === "pending" || r.status === "queued" || r.status === "info_requested" || r.status === "awaiting_verification") :
      r.status === (tab as RequestStatus);
    const bySearch = (r: RequestItem) =>
      !q ||
      r.id.toLowerCase().includes(q) ||
      r.subject.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      typeLabels[r.type].toLowerCase().includes(q) ||
      r.employeeName.toLowerCase().includes(q) ||
      r.company.toLowerCase().includes(q);

    return mine.filter((r) => byTab(r) && bySearch(r))
      .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority] || +new Date(b.updatedAt) - +new Date(a.updatedAt));
  }, [mine, tab, searchQuery]);

  const selected = filtered.find((r) => r.id === selectedId) ?? filtered[0] ?? null;

  const submitDraft = useCallback(async (draft: {
    type: RequestType; subject: string; description: string; amount: number | null; priority: Priority;
    items?: import("@/components/models").StationeryPick[];
    details?: Record<string, unknown>;
    request_center_code: string;
    client_request_id: string;
  }) => {
    const created = await request<{ id: number; ref_id: string }>('/api/employee/requests', {
      method: 'POST',
      body: { ...draft, details: { ...draft.details, items: draft.items } }
    });
    setTab("active");
    if (created?.ref_id) setSelectedId(created.ref_id);
    setSuccessToast(`Request ${created?.ref_id || 'submitted'} created and policy-routed successfully.`);
    setTimeout(() => setSuccessToast(null), 6000);
    setDialogOpen(false);
    setPrefillType(null);
    void refresh();
  }, [refresh]);

  const cancelRequest = useCallback(async (reqItem: RequestItem) => {
    try {
      await request(`/api/employee/requests/${reqItem.dbId}/cancel`, {
        method: 'PATCH',
        body: { user_id: currentUser.id, note: 'Withdrawn by requester' }
      });
      await refresh();
      setSuccessToast(`Request ${reqItem.id} has been withdrawn.`);
      setTimeout(() => setSuccessToast(null), 5000);
    } catch (err) {
      console.error(err);
    }
  }, [refresh, currentUser.id]);

  const kpis = [
    { label: "In progress", value: counts.active, icon: Inbox, tone: "amber" as const },
    { label: "With Super Admin", value: mine.filter((r) => r.status === "queued").length, icon: Send, tone: "indigo" as const },
    { label: "Approved", value: counts.approved, icon: CheckCircle2, tone: "emerald" as const },
    { label: "Rejected", value: counts.rejected, icon: XCircle, tone: "rose" as const },
  ];

  const quickTypes: RequestType[] = ["id_card", "visiting_card", "stationery", "travel", "courier", "meeting_room", "fooding"];

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "active", label: "Active", count: counts.active },
    { id: "approved", label: "Approved", count: counts.approved },
    { id: "rejected", label: "Rejected", count: counts.rejected },
    { id: "all", label: "All", count: counts.all },
  ];

  return (
    <DashboardLayout workspace="Employee Portal" currentUser={currentUser.name} role={`${currentUser.dept || 'Operations'} · Employee`} searchQuery={searchQuery} onSearchChange={setSearchQuery}>
      <div className="px-4 sm:px-6 pt-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">Employee · My Workspace</p>
            <h1 className="font-display text-2xl font-semibold text-slate-900">Namaste, {currentUser.name.split(" ")[0]}.</h1>
            <p className="text-sm text-slate-500 mt-1">Raise a new request, or track what's already in flight.</p>
          </div>
          <button onClick={() => { setPrefillType(null); setDialogOpen(true); }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-semibold rounded-lg shadow-sm">
            <Plus className="w-4 h-4" strokeWidth={2.5} /> New Request
          </button>
        </div>

        {/* Success confirmation toast */}
        {successToast && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top duration-300">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p className="text-xs font-bold">{successToast}</p>
                <p className="text-[11px] text-emerald-700 mt-0.5">Your request status has been updated in your portal.</p>
              </div>
            </div>
            <button onClick={() => setSuccessToast(null)} className="text-emerald-700 hover:text-emerald-900 text-xs font-bold px-2 py-1">
              ✕
            </button>
          </div>
        )}

        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
          {kpis.map((k) => <KpiTile key={k.label} {...k} />)}
        </div>

        {/* Quick launchers */}
        <div className="mb-6">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Quick raise</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
            {quickTypes.map((t) => {
              const Icon = typeIcon[t];
              return (
                <button key={t} onClick={() => { setPrefillType(t); setDialogOpen(true); }}
                  className="flex items-center gap-2 p-2.5 bg-white border border-slate-200/80 rounded-lg hover:border-slate-400 hover:shadow-sm text-left transition-all group">
                  <div className="w-7 h-7 rounded grid place-items-center bg-slate-100 group-hover:bg-slate-900 group-hover:text-white transition-colors shrink-0">
                    <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />
                  </div>
                  <span className="text-xs font-medium text-slate-700 group-hover:text-slate-900 truncate">
                    {typeLabels[t].split(" ")[0]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 mb-4">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`pb-2 px-1 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                tab === t.id ? "border-slate-900 text-slate-900 font-semibold" : "border-transparent text-slate-500 hover:text-slate-700"
              }`}>
              <span>{t.label}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                tab === t.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
              }`}>{t.count}</span>
            </button>
          ))}
        </div>

        {/* Main Master-Detail view */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[520px]">
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col">
            <div className="p-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>{filtered.length} requests</span>
              <span>Sorted by priority & date</span>
            </div>
            <div className="divide-y divide-slate-100 overflow-y-auto max-h-[560px]">
              {filtered.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  No requests found in this view.
                </div>
              ) : filtered.map((r) => (
                <RequestRow key={r.id} request={r} selected={selected?.id === r.id}
                  checked={false} onToggleCheck={() => {}} onSelect={setSelectedId} />
              ))}
            </div>
          </div>

          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col">
            {selected ? (
              <>
                <div className="flex-1 min-h-0"><RequestDetail request={selected} readOnly /></div>
                {(selected.status === "pending" || selected.status === "queued" || selected.status === "info_requested") && (
                  <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <p className="text-[11px] text-slate-500 font-medium">You can withdraw this request while it is in progress.</p>
                    <button onClick={() => setConfirmWithdraw(selected)}
                      className="px-3.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 hover:border-rose-300 transition-all shadow-sm">
                      Withdraw request
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="h-full grid place-items-center text-sm text-slate-400 p-8 text-center">
                Nothing selected. Raise a new request to get started.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Request Withdrawal */}
      {confirmWithdraw && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm grid place-items-center p-4 animate-in fade-in duration-200" onClick={() => setConfirmWithdraw(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-rose-600">
                <div className="w-8 h-8 rounded-full bg-rose-100 grid place-items-center shrink-0">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base text-slate-900">Withdraw Request?</h3>
                  <p className="text-[10px] text-slate-400 font-mono">{confirmWithdraw.id}</p>
                </div>
              </div>
              <button onClick={() => setConfirmWithdraw(null)} className="w-7 h-7 grid place-items-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-1 text-xs">
              <p className="font-bold text-slate-800">{confirmWithdraw.subject}</p>
              <p className="text-[11px] text-slate-500 line-clamp-2">{confirmWithdraw.description}</p>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to withdraw this request? Once confirmed, this request will be marked as withdrawn and removed from active processing.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                onClick={() => setConfirmWithdraw(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-100 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  void cancelRequest(confirmWithdraw);
                  setConfirmWithdraw(null);
                }}
                className="px-4 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-lg shadow-rose-600/30 transition-all"
              >
                Yes, Withdraw Request
              </button>
            </div>
          </div>
        </div>
      )}

      <NewRequestDialog open={dialogOpen} initialType={prefillType} centers={centers} homeCenter={currentUser.center_code || ""} employeeProfile={currentUser}
        onClose={() => { setDialogOpen(false); setPrefillType(null); }}
        onSubmit={submitDraft} />
    </DashboardLayout>
  );
}

const kpiTone = {
  amber: "border-l-amber-400",
  indigo: "border-l-indigo-400",
  emerald: "border-l-emerald-400",
  rose: "border-l-rose-400",
} as const;

function KpiTile({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof Inbox; tone: keyof typeof kpiTone }) {
  return (
    <div className={`px-3.5 py-2.5 bg-white border border-slate-200 border-l-4 rounded-md ${kpiTone[tone]}`}>
      <div className="flex items-center gap-1.5">
        <Icon className="w-3 h-3 text-slate-400" strokeWidth={2} />
        <p className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">{label}</p>
      </div>
      <p className="text-xl font-display font-semibold text-slate-900 tabular-nums mt-0.5">{value}</p>
    </div>
  );
}
