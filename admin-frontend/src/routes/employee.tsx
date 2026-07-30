import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { RequestRow } from "@/components/RequestRow";
import { RequestDetail } from "@/components/RequestDetail";
import { NewRequestDialog } from "@/components/NewRequestDialog";
import { priorityRank, typeLabels, type Priority, type RequestItem, type RequestStatus, type RequestType } from "@/components/models";
import { typeIcon } from "@/components/requestMeta";
import { getRequests, request, session } from "@/lib/api";
import { Plus, Inbox, Send, CheckCircle2, XCircle, Sparkles } from "lucide-react";

export const Route = createFileRoute("/employee")({
  head: () => ({
    meta: [
      { title: "My Requests — RequestHub" },
      { name: "description", content: "Employee workspace to raise, track and manage admin requests." },
    ],
  }),
  component: EmployeeConsole,
});

type Tab = "active" | "approved" | "rejected" | "all";
const ME = { id: 1, name: "Rahul Kumar", dept: "Engineering", company: "VT" };

function EmployeeConsole() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [tab, setTab] = useState<Tab>("active");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [prefillType, setPrefillType] = useState<RequestType | null>(null);
  const [userId, setUserId] = useState(ME.id);
  const refresh = useCallback(async () => {
    try { const me = await request<{ id: number }>('/api/auth/me'); setUserId(me.id); setRequests(await getRequests(`/api/employee/requests/${me.id}`)); } catch (error) { console.error(error); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const mine = useMemo(() => requests.filter((r) => r.employeeId === userId), [requests, userId]);

  const counts = useMemo(() => ({
    active: mine.filter((r) => r.status === "pending" || r.status === "queued" || r.status === "info_requested" || r.status === "awaiting_verification").length,
    approved: mine.filter((r) => r.status === "approved").length,
    rejected: mine.filter((r) => r.status === "rejected").length,
    all: mine.length,
  }), [mine]);

  const filtered = useMemo(() => {
    const byTab = (r: RequestItem) =>
      tab === "all" ? true :
      tab === "active" ? (r.status === "pending" || r.status === "queued" || r.status === "info_requested" || r.status === "awaiting_verification") :
      r.status === (tab as RequestStatus);
    return mine.filter(byTab)
      .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority] || +new Date(b.updatedAt) - +new Date(a.updatedAt));
  }, [mine, tab]);

  const selected = filtered.find((r) => r.id === selectedId) ?? filtered[0] ?? null;

  const submitDraft = useCallback(async (draft: {
    type: RequestType; subject: string; description: string; amount: number | null; priority: Priority;
    items?: import("@/components/models").StationeryPick[];
    details?: Record<string, unknown>;
  }) => {
    await request('/api/employee/requests', { method: 'POST', body: { user_id: userId, ...draft, details: { ...draft.details, items: draft.items } } });
    await refresh(); setTab("active"); setDialogOpen(false); setPrefillType(null);
  }, [refresh, userId]);

  const cancelRequest = useCallback((id: string, note: string) => {
    // employee's "info" action = withdraw / add clarification; here we mark rejected by requester
    setRequests((prev) => prev.map((r) => {
      if (r.id !== id) return r;
      const at = new Date().toISOString();
      return {
        ...r, status: "rejected", updatedAt: at,
        audit: [...r.audit, { at, actor: ME.name, action: "rejected", note: note || "Withdrawn by requester" }],
      };
    }));
  }, []);

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
    <DashboardLayout workspace="Employee Portal" currentUser={ME.name} role={`${ME.dept} · Employee`}>
      <div className="px-4 sm:px-6 pt-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">Employee · My Workspace</p>
            <h1 className="font-display text-2xl font-semibold text-slate-900">Namaste, {ME.name.split(" ")[0]}.</h1>
            <p className="text-sm text-slate-500 mt-1">Raise a new request, or track what's already in flight.</p>
          </div>
          <button onClick={() => { setPrefillType(null); setDialogOpen(true); }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-semibold rounded-lg shadow-sm">
            <Plus className="w-4 h-4" strokeWidth={2.5} /> New Request
          </button>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
          {kpis.map((k) => <KpiTile key={k.label} {...k} />)}
        </div>

        {/* Quick launchers */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-slate-400" />
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-medium">Quick raise</p>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            {quickTypes.map((t) => {
              const Icon = typeIcon[t];
              return (
                <button key={t} onClick={() => { setPrefillType(t); setDialogOpen(true); }}
                  className="flex flex-col items-center gap-1.5 p-3 bg-white border border-slate-200 rounded-lg text-[10px] text-slate-600 hover:border-slate-900 hover:text-slate-900 hover:shadow-sm transition-all">
                  <Icon className="w-4 h-4" strokeWidth={1.75} />
                  <span className="leading-tight text-center">{typeLabels[t]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-slate-200 -mx-4 sm:-mx-6 px-4 sm:px-6 overflow-x-auto">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-3 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                tab === t.id ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"
              }`}>
              {t.label}
              <span className={`px-1.5 py-0.5 rounded text-[10px] tabular-nums ${tab === t.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"}`}>{t.count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mx-4 sm:mx-6 mt-4 grid grid-cols-1 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-4 h-[calc(100vh-22rem)] min-h-[520px]">
        <div className="bg-white border border-slate-200 rounded-lg flex flex-col overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
            <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">My submissions</p>
            <span className="text-[11px] text-slate-400 tabular-nums">{filtered.length} total</span>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
            {filtered.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-400">
                <p>No requests here.</p>
                <button onClick={() => setDialogOpen(true)} className="mt-3 text-xs text-slate-900 font-semibold underline underline-offset-2">Raise your first request →</button>
              </div>
            ) : filtered.map((r) => (
              <RequestRow key={r.id} request={r} selected={selected?.id === r.id}
                checked={false} onToggleCheck={() => {}} onSelect={setSelectedId} />
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col">
          {selected ? (
            <>
              <div className="flex-1 min-h-0"><RequestDetail request={selected} readOnly /></div>
              {selected.status === "pending" && (
                <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <p className="text-[11px] text-slate-500">You can withdraw while it's still pending.</p>
                  <button onClick={() => cancelRequest(selected.id, "Withdrawn by requester")}
                    className="px-3 py-1.5 text-[11px] font-semibold text-rose-700 border border-rose-200 rounded hover:bg-rose-50">
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

      <NewRequestDialog open={dialogOpen} initialType={prefillType}
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
