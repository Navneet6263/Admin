import { useState } from "react";
import type { RequestItem } from "./models";
import { typeLabels } from "./models";
import { typeIcon, priorityTone, statusTone, fmtDateTime, fmtINR, relTime } from "./requestMeta";
import { detailRows } from "./RequestForms";
import { Check, X, Send as SendIcon, MessageCircle, User2, Building2, Clock, ShieldCheck, Undo2, Download } from "lucide-react";
import { BusinessCardPreview } from "./business-card/BusinessCardPreview";
import { downloadBusinessCardPdf } from "./business-card/businessCardPdf";
import type { BusinessCardDetails } from "./business-card/businessCardTemplates";
import { VisionIndiaIdCardPreview } from "./id-card/VisionIndiaIdCardPreview";
import { downloadIdCardPdf } from "./id-card/idCardPdf";
import type { IdCardDetails } from "./id-card/visionIndiaIdCard";

interface Props {
  request: RequestItem;
  onAction?: (id: string, action: "approve" | "reject" | "queue" | "info" | "verify" | "send_back", note: string) => void;
  readOnly?: boolean;
  /** When true, show verifier-only actions (Verify & Close / Send back to Admin). */
  mode?: "admin" | "verifier" | "finance";
}

type Mode = null | "approve" | "reject" | "queue" | "info" | "verify" | "send_back";

export function RequestDetail({ request, onAction, readOnly, mode: viewMode = "admin" }: Props) {
  const [mode, setMode] = useState<Mode>(null);
  const [note, setNote] = useState("");
  const Icon = typeIcon[request.type];
  const pri = priorityTone[request.priority];
  const st = statusTone[request.status];
  const isVerifierStage = request.status === "awaiting_verification";
  const isAdminStage = request.status === "pending" || request.status === "queued" || request.status === "info_requested";
  const canActAdmin = viewMode === "admin" && isAdminStage;
  const canActFinance = viewMode === "finance" && isAdminStage;
  const canActVerifier = viewMode === "verifier" && isVerifierStage;
  const isOpen = !readOnly && !!onAction && (canActAdmin || canActFinance || canActVerifier);

  const submit = () => {
    if (!mode || !onAction) return;
    if ((mode === "reject" || mode === "send_back") && !note.trim()) return;
    onAction(request.id, mode, note.trim());
    setNote(""); setMode(null);
  };

  const cfg: Record<Exclude<Mode, null>, { title: string; hint: string; cta: string; required: boolean; ctaCls: string }> = {
    approve:   { title: "Approve request", hint: "Notes optional. Sends to Verifier for claim check.", cta: "Approve → send to Verifier", required: false, ctaCls: "bg-emerald-600 hover:bg-emerald-700" },
    reject:    { title: "Reject request", hint: "Reason is mandatory and shared with the employee.", cta: "Confirm rejection", required: true, ctaCls: "bg-rose-600 hover:bg-rose-700" },
    queue:     { title: "Queue for Super Admin", hint: "Add context for Super Admin review.", cta: "Forward to Super Admin", required: false, ctaCls: "bg-indigo-600 hover:bg-indigo-700" },
    info:      { title: "Request more info", hint: "Ask the employee to clarify.", cta: "Send to employee", required: false, ctaCls: "bg-slate-900 hover:bg-black" },
    verify:    { title: "Verify & close", hint: "Confirm bills / delivery match the approved request.", cta: "Verify & close request", required: false, ctaCls: "bg-violet-600 hover:bg-violet-700" },
    send_back: { title: "Send back to Admin", hint: "Reason mandatory — admin will re-review.", cta: "Return to Admin", required: true, ctaCls: "bg-amber-600 hover:bg-amber-700" },
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* header */}
      <div className="px-6 py-5 border-b border-slate-100">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span className="font-mono tabular-nums">{request.id}</span>
              <span>·</span>
              <span>{typeLabels[request.type]}</span>
            </div>
            <h2 className="font-display text-xl font-medium text-slate-900 mt-1 leading-snug">{request.subject}</h2>
          </div>
          <div className={`w-10 h-10 grid place-items-center rounded-lg ${pri.bg} border shrink-0`}>
            <Icon className="w-4 h-4 text-slate-700" strokeWidth={1.75} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-4">
          <span className={`px-2 py-0.5 text-[10px] font-medium rounded border ${st.bg} ${st.text}`}>{st.label}</span>
          {request.company && <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded border border-slate-200 bg-slate-50 text-slate-700">
            <Building2 className="w-3 h-3" /> {request.company}
          </span>}
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded border ${pri.bg} ${pri.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${pri.dot}`} /> {pri.label} priority
          </span>
          {request.amount != null && (
            <span className="px-2 py-0.5 text-[10px] font-mono tabular-nums rounded border border-slate-200 bg-slate-50 text-slate-700">
              {fmtINR(request.amount)}
            </span>
          )}
        </div>
      </div>

      {/* body */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        <section className="grid grid-cols-2 gap-4">
          <MetaField icon={User2} label="Requester" value={request.employeeName} sub={`EMP-${request.employeeId.toString().padStart(4, "0")}`} />
          <MetaField icon={Building2} label="Department" value={request.employeeDept} />
          <MetaField icon={Clock} label="Raised" value={fmtDateTime(request.createdAt)} sub={relTime(request.createdAt)} />
          <MetaField icon={Clock} label="Last update" value={fmtDateTime(request.updatedAt)} sub={relTime(request.updatedAt)} />
        </section>

        {request.type === "visiting_card" && Boolean(request.details?.brand) && (
          <section className="rounded-xl bg-slate-950 p-4">
            <BusinessCardPreview details={request.details as unknown as BusinessCardDetails} />
            <button type="button" onClick={() => void downloadBusinessCardPdf(request.details as unknown as BusinessCardDetails)}
              className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-100">
              <Download className="h-3.5 w-3.5" /> Download print PDF
            </button>
          </section>
        )}

        {request.type === "id_card" && request.details?.brand === "vision_india" && (
          <section className="rounded-xl bg-slate-950 p-4">
            <VisionIndiaIdCardPreview details={request.details as unknown as IdCardDetails} />
            <button type="button" onClick={() => void downloadIdCardPdf(request.details as unknown as IdCardDetails)}
              className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-100">
              <Download className="h-3.5 w-3.5" /> Download print PDF
            </button>
          </section>
        )}

        {(() => {
          const rows = detailRows(request.type, request.details);
          if (rows.length === 0) return null;
          return (
            <section>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Details</p>
              <dl className="grid grid-cols-[130px_1fr] gap-x-3 gap-y-1.5 text-xs">
                {rows.map((r) => (
                  <div key={r.label} className="contents">
                    <dt className="text-slate-500">{r.label}</dt>
                    <dd className="text-slate-800 break-words whitespace-pre-wrap">{r.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          );
        })()}

        <section>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Description</p>
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{request.description || <em className="text-slate-400">No description provided.</em>}</p>
        </section>

        <section>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-3">Activity · Audit Trail</p>
          <ol className="space-y-3">
            {request.audit.map((e, i) => (
              <li key={i} className="flex gap-3">
                <div className="mt-1 w-2 h-2 rounded-full bg-slate-300 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-800">
                    <span className="font-medium">{e.actor}</span>{" "}
                    <span className="text-slate-500">{describeAction(e.action)}</span>
                  </p>
                  {e.note && <p className="text-xs text-slate-500 mt-0.5 border-l-2 border-slate-100 pl-2">{e.note}</p>}
                  <p className="text-[10px] text-slate-400 mt-0.5 tabular-nums">{fmtDateTime(e.at)}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {/* action bar */}
      {isOpen && (
        <div className="border-t border-slate-100 bg-slate-50/50">
          {mode ? (
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-800">{cfg[mode].title}</p>
                <button onClick={() => { setMode(null); setNote(""); }} className="text-[11px] text-slate-500 hover:text-slate-800">Cancel</button>
              </div>
              <p className="text-[11px] text-slate-500 mb-2">{cfg[mode].hint}</p>
              <textarea
                autoFocus value={note} onChange={(e) => setNote(e.target.value)} rows={3}
                placeholder={cfg[mode].required ? "Reason (required)…" : "Add a note (optional)…"}
                className="w-full text-sm border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white"
              />
              <button
                onClick={submit}
                disabled={cfg[mode].required && !note.trim()}
                className={`mt-2 w-full py-2.5 text-xs font-semibold text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${cfg[mode].ctaCls}`}
              >
                {cfg[mode].cta}
              </button>
            </div>
          ) : canActVerifier ? (
            <div className="grid grid-cols-2 gap-1.5 p-3">
              <ActionBtn icon={ShieldCheck} label="Verify & close" onClick={() => setMode("verify")} tone="violet" />
              <ActionBtn icon={Undo2} label="Send back" onClick={() => setMode("send_back")} tone="amber" />
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-1.5 p-3">
              <ActionBtn icon={Check} label="Approve" onClick={() => setMode("approve")} tone="emerald" />
              <ActionBtn icon={X} label="Reject" onClick={() => setMode("reject")} tone="rose" />
              <ActionBtn icon={SendIcon} label="Queue" onClick={() => setMode("queue")} tone="indigo" />
              <ActionBtn icon={MessageCircle} label="Info" onClick={() => setMode("info")} tone="slate" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function describeAction(a: string) {
  switch (a) {
    case "created":
    case "raised": return "raised this request";
    case "withdrawn": return "withdrew this request";
    case "approved": return "approved · sent to Verifier";
    case "rejected": return "rejected / withdrew the request";
    case "queued": return "queued for Super Admin review";
    case "info_requested": return "requested more information";
    case "commented": return "added a note";
    case "verified": return "verified · closed the request";
    case "sent_back": return "sent back to Admin";
    default: return a;
  }
}

function MetaField({ icon: Icon, label, value, sub }: { icon: typeof User2; label: string; value: string; sub?: string }) {
  return (
    <div className="flex gap-2.5">
      <Icon className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-slate-400">{label}</p>
        <p className="text-xs text-slate-800 font-medium truncate">{value}</p>
        {sub && <p className="text-[10px] text-slate-400 tabular-nums">{sub}</p>}
      </div>
    </div>
  );
}

const toneMap = {
  emerald: "text-emerald-700 hover:bg-emerald-50 border-emerald-100",
  rose: "text-rose-700 hover:bg-rose-50 border-rose-100",
  indigo: "text-indigo-700 hover:bg-indigo-50 border-indigo-100",
  slate: "text-slate-700 hover:bg-slate-100 border-slate-200",
  violet: "text-violet-700 hover:bg-violet-50 border-violet-100",
  amber: "text-amber-700 hover:bg-amber-50 border-amber-100",
} as const;

function ActionBtn({ icon: Icon, label, onClick, tone }: { icon: typeof Check; label: string; onClick: () => void; tone: keyof typeof toneMap }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center gap-1 py-2.5 bg-white border rounded-lg text-[11px] font-semibold transition-colors ${toneMap[tone]}`}>
      <Icon className="w-4 h-4" strokeWidth={2} />
      {label}
    </button>
  );
}
