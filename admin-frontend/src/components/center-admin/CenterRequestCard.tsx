import { AlertCircle, CheckCircle2, Clock3, PackageCheck, XCircle } from 'lucide-react';
import { useState } from 'react';

export interface CenterRequest {
  id: number;
  ref_id: string;
  type: string;
  subject: string;
  amount: number | null;
  priority: string;
  status: string;
  workflow_status?: string;
  created_at: string;
  employeeName: string;
  email: string;
  employeeDept: string;
  home_center_code: string;
  request_center_code?: string;
  charge_center_code?: string;
  assignment_type?: string;
  can_act?: boolean;
  fulfillment_status?: string;
  receipt_status?: string;
  audit?: string | Array<{ actor?: string; action?: string; at?: string }>;
}

function approvedBy(request: CenterRequest) {
  try {
    const rows = typeof request.audit === 'string' ? JSON.parse(request.audit) : request.audit;
    if (!Array.isArray(rows)) return '';
    return [...rows].reverse().find((row) => row.action === 'approved')?.actor || '';
  } catch { return ''; }
}

const priorityTone: Record<string, string> = {
  urgent: 'bg-rose-50 text-rose-700 border-rose-100',
  high: 'bg-orange-50 text-orange-700 border-orange-100',
  normal: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  low: 'bg-slate-50 text-slate-600 border-slate-200',
};

const statusTone: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  awaiting_approval: 'bg-amber-50 text-amber-700',
  approved: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-rose-50 text-rose-700',
  queued: 'bg-indigo-50 text-indigo-700',
  awaiting_verification: 'bg-violet-50 text-violet-700',
  withdrawn: 'bg-orange-50 text-orange-700',
};

export function CenterRequestCard({ req, onApprove, onReject, onAssign, onResolve }: {
  req: CenterRequest;
  onApprove: (id: number) => Promise<void>;
  onReject: (id: number) => Promise<void>;
  onAssign: (id: number) => Promise<void>;
  onResolve: (id: number) => Promise<void>;
}) {
  const [busy, setBusy] = useState<'approve' | 'reject' | 'assign' | 'resolve' | null>(null);
  const workflow = req.workflow_status || req.status;
  const actionable = req.can_act !== false && ['pending', 'awaiting_approval'].includes(workflow);
  const assignable = req.fulfillment_status === 'ready_to_assign';
  const disputed = req.receipt_status === 'disputed';
  const approver = assignable ? approvedBy(req) : '';
  const act = async (action: 'approve' | 'reject') => {
    setBusy(action);
    try { await (action === 'approve' ? onApprove(req.id) : onReject(req.id)); }
    finally { setBusy(null); }
  };
  const assign = async () => {
    setBusy('assign');
    try { await onAssign(req.id); } finally { setBusy(null); }
  };
  const resolve = async () => {
    setBusy('resolve');
    try { await onResolve(req.id); } finally { setBusy(null); }
  };
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/30 transition hover:border-slate-300 hover:shadow-md">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600"><Clock3 className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] font-semibold text-indigo-600">{req.ref_id}</span>
            <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase ${priorityTone[req.priority] || priorityTone.low}`}>{req.priority}</span>
            <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold capitalize ${statusTone[workflow] || 'bg-slate-100 text-slate-600'}`}>{workflow.replaceAll('_', ' ')}</span>
          </div>
          <h3 className="mt-2 text-sm font-semibold text-slate-900">{req.subject}</h3>
          <p className="mt-1 text-[11px] text-slate-500">{req.employeeName} - {req.employeeDept} - {req.type.replaceAll('_', ' ')}</p>
        </div>
        {assignable && <span className="shrink-0 rounded-md bg-cyan-50 px-2 py-1 text-[10px] font-semibold text-cyan-700"><PackageCheck className="mr-1 inline h-3.5 w-3.5" />Ready to assign</span>}
        {disputed && <span className="shrink-0 rounded-md bg-rose-50 px-2 py-1 text-[10px] font-semibold text-rose-700"><AlertCircle className="mr-1 inline h-3.5 w-3.5" />Delivery issue</span>}
        {req.amount != null && <span className="shrink-0 font-mono text-sm font-semibold text-slate-900">Rs {Number(req.amount).toLocaleString('en-IN')}</span>}
      </div>
      {actionable && <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3">
        <button type="button" disabled={busy !== null} onClick={() => void act('approve')}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
          <CheckCircle2 className="h-3.5 w-3.5" /> {busy === 'approve' ? 'Approving...' : 'Approve'}
        </button>
        <button type="button" disabled={busy !== null} onClick={() => void act('reject')}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">
          <XCircle className="h-3.5 w-3.5" /> {busy === 'reject' ? 'Rejecting...' : 'Reject'}
        </button>
      </div>}
      {assignable && <button type="button" disabled={busy !== null} onClick={() => void assign()}
        className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-700 disabled:opacity-50">
        <PackageCheck className="h-3.5 w-3.5" /> {busy === 'assign' ? 'Saving handover...' : 'Mark as handed over'}
      </button>}
      {disputed && <button type="button" disabled={busy !== null} onClick={() => void resolve()}
        className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
        <CheckCircle2 className="h-3.5 w-3.5" /> {busy === 'resolve' ? 'Saving resolution...' : 'Mark issue resolved'}
      </button>}
      {assignable && approver && <p className="mt-2 text-center text-[10px] text-slate-500">Approved by <span className="font-semibold text-slate-700">{approver}</span></p>}
      {!actionable && workflow === 'awaiting_approval' && <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-[10px] text-amber-700"><AlertCircle className="h-3.5 w-3.5" /> {req.status === 'queued' ? 'Locked for Super Admin decision.' : 'This request is visible but assigned to another approver.'}</p>}
    </article>
  );
}
