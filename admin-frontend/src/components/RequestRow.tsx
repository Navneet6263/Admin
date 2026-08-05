import type { RequestItem } from "./models";
import { typeLabels } from "./models";
import { typeIcon, priorityTone, statusTone, relTime, fmtINR } from "./requestMeta";
import { companyByCode } from "./company";

interface Props {
  request: RequestItem;
  selected: boolean;
  checked: boolean;
  onToggleCheck: (id: string) => void;
  onSelect: (id: string) => void;
}

export function RequestRow({ request, selected, checked, onToggleCheck, onSelect }: Props) {
  const Icon = typeIcon[request.type];
  const pri = priorityTone[request.priority];
  const st = statusTone[request.status];
  const comp = companyByCode(request.company);

  return (
    <div
      onClick={() => onSelect(request.id)}
      className={`flex items-center justify-between gap-3 px-3.5 py-3 border-l-2 cursor-pointer transition-colors ${
        selected
          ? "bg-sky-50/60 border-l-sky-500"
          : "border-l-transparent hover:bg-slate-50/70"
      }`}
    >
      <div className="flex items-start gap-2.5 min-w-0 flex-1">
        <input
          type="checkbox"
          checked={checked}
          onClick={(e) => e.stopPropagation()}
          onChange={() => onToggleCheck(request.id)}
          className="mt-1 w-3.5 h-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-400 accent-slate-900 shrink-0"
        />
        <div className={`mt-0.5 w-6 h-6 grid place-items-center rounded-lg ${pri.bg} border shrink-0`}>
          <Icon className="w-3.5 h-3.5 text-slate-700" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <span className="font-mono text-[10px] text-slate-400 tabular-nums shrink-0">{request.id}</span>
            <span className={`shrink-0 px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider rounded border ${comp.tone}`}>
              {comp.code}
            </span>
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${pri.text} shrink-0`}>
              <span className={`w-1.5 h-1.5 rounded-full ${pri.dot}`} /> {pri.label}
            </span>
          </div>
          <p className="text-xs font-bold text-slate-900 truncate mt-1 leading-snug">{request.subject}</p>
          <p className="text-[11px] text-slate-500 truncate mt-0.5">
            {[request.employeeName, request.employeeDept, typeLabels[request.type]].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1.5 shrink-0 text-right pl-1">
        <div className="flex items-center gap-1.5">
          {request.amount != null && (
            <span className="font-mono text-xs font-bold text-slate-800 tabular-nums">{fmtINR(request.amount)}</span>
          )}
          <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-full border ${st.bg} ${st.text}`}>
            {st.label}
          </span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-slate-400 tabular-nums">
          <span>{relTime(request.updatedAt)}</span>
          <span className="text-slate-300">›</span>
        </div>
      </div>
    </div>
  );
}
