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

  return (
    <div
      onClick={() => onSelect(request.id)}
      className={`grid grid-cols-[24px_20px_1fr_100px_90px_80px_16px] items-center gap-3 px-4 py-3 border-l-2 cursor-pointer transition-colors ${
        selected
          ? "bg-sky-50/50 border-l-sky-500"
          : "border-l-transparent hover:bg-slate-50/70"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onClick={(e) => e.stopPropagation()}
        onChange={() => onToggleCheck(request.id)}
        className="w-3.5 h-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-400 accent-slate-900"
      />
      <div className={`w-5 h-5 grid place-items-center rounded ${pri.bg} border`}>
        <Icon className="w-3 h-3 text-slate-600" strokeWidth={1.75} />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-[10px] text-slate-400 tabular-nums shrink-0">{request.id}</span>
          <span className={`shrink-0 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider rounded border ${companyByCode(request.company).tone}`}>
            {request.company}
          </span>
          <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${pri.text} shrink-0`}>
            <span className={`w-1.5 h-1.5 rounded-full ${pri.dot}`} /> {pri.label}
          </span>
        </div>
        <p className="text-sm font-medium text-slate-900 truncate mt-0.5">{request.subject}</p>
        <p className="text-xs text-slate-500 truncate">
          {request.employeeName} · {request.employeeDept} · {typeLabels[request.type]}
        </p>
      </div>
      <div className="text-right text-xs">
        {request.amount != null ? (
          <span className="font-mono tabular-nums text-slate-800">{fmtINR(request.amount)}</span>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </div>
      <div className="text-right">
        <span className={`inline-block px-2 py-0.5 text-[10px] font-medium rounded border ${st.bg} ${st.text}`}>
          {st.label}
        </span>
      </div>
      <div className="text-right text-[11px] text-slate-500 tabular-nums">{relTime(request.updatedAt)}</div>
      <div className="text-slate-300 text-xs">›</div>
    </div>
  );
}
