import { ShieldCheck, Crown, CheckCircle2, Ban, RotateCcw } from "lucide-react";
import { RequestRow } from "@/components/RequestRow";
import { RequestDetail } from "@/components/RequestDetail";
import { companies } from "@/components/company";
import { type RequestItem, type RequestStatus } from "@/components/models";

interface Props {
  list: RequestItem[];
  selected: RequestItem | undefined;
  companyFilter: string;
  setCompanyFilter: (v: string) => void;
  statusFilter: RequestStatus | "all";
  setStatusFilter: (v: RequestStatus | "all") => void;
  onSelect: (id: string) => void;
  onAction: (id: string, action: "approve"|"reject"|"queue"|"info"|"verify"|"send_back", note: string) => void;
}

export function OverrideTab({
  list, selected, companyFilter, setCompanyFilter,
  statusFilter, setStatusFilter, onSelect, onAction,
}: Props) {
  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="mb-3 p-3 bg-indigo-50 border border-indigo-100 rounded-md flex items-start gap-2">
        <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
        <div className="text-xs text-indigo-900">
          <b>Override authority.</b> You can force any request into any state — force-approve, force-reject, close, or send back to Admin.
          Every action is signed as <span className="font-mono">SA-001</span> and appears in the audit trail.
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] gap-4 h-[calc(100vh-20rem)] min-h-[560px]">
        {/* Left — request list */}
        <div className="bg-white border border-slate-200 rounded-lg flex flex-col overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2 flex-wrap">
            <select value={companyFilter} onChange={e => setCompanyFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-slate-300">
              <option value="all">All companies</option>
              {companies.map(c => <option key={c.code} value={c.code}>{c.code} · {c.name}</option>)}
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as RequestStatus | "all")}
              className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-slate-300">
              <option value="all">Any status</option>
              <option value="pending">Pending</option>
              <option value="queued">Queued</option>
              <option value="awaiting_verification">Awaiting verification</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="info_requested">Info requested</option>
            </select>
            <span className="text-[11px] text-slate-400 tabular-nums ml-auto">{list.length} requests</span>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
            {list.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-400">No requests match.</div>
            ) : list.map(r => (
              <RequestRow key={r.id} request={r} selected={selected?.id === r.id}
                checked={false} onToggleCheck={() => {}} onSelect={onSelect} />
            ))}
          </div>
        </div>

        {/* Right — detail panel */}
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col">
          {selected ? (
            <>
              <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 flex items-center gap-2 text-[11px] text-amber-900">
                <Crown className="w-3.5 h-3.5 text-amber-600" />
                <span><b>Super Admin override</b> — you can act on this request regardless of its current stage.</span>
              </div>
              <div className="flex-1 overflow-hidden">
                <RequestDetail request={selected} onAction={onAction} />
              </div>
              <div className="px-4 py-2.5 border-t border-slate-100 flex flex-wrap items-center gap-2 bg-slate-50">
                <span className="text-[10px] uppercase tracking-widest text-slate-500 mr-1">Quick override:</span>
                <button onClick={() => onAction(selected.id, "approve", "")}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-emerald-600 text-white rounded hover:bg-emerald-700">
                  <CheckCircle2 className="w-3 h-3" /> Force approve
                </button>
                <button onClick={() => onAction(selected.id, "reject", "Overridden by Super Admin")}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-rose-600 text-white rounded hover:bg-rose-700">
                  <Ban className="w-3 h-3" /> Force reject
                </button>
                <button onClick={() => onAction(selected.id, "send_back", "Returned to Admin queue")}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-white border border-slate-300 text-slate-700 rounded hover:bg-slate-100">
                  <RotateCcw className="w-3 h-3" /> Send back to Admin
                </button>
              </div>
            </>
          ) : (
            <div className="h-full grid place-items-center text-sm text-slate-400">Select a request to override.</div>
          )}
        </div>
      </div>
    </div>
  );
}
