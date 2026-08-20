import { RequestRow } from "@/components/RequestRow";
import { RequestDetail } from "@/components/RequestDetail";
import {
  TypeFilter, PriorityFilter, CompanyFilter, SortFilter, AgeFilter, type SortKey, type AgeFilterKey,
} from "@/components/hq-admin/AdminFilters";
import type { RequestItem, RequestType, Priority } from "@/components/models";

interface Props {
  filtered: RequestItem[];
  selected?: RequestItem;
  checked: Set<string>;
  typeFilter: RequestType | "all";
  priorityFilter: Priority | "all";
  companyFilter: string;
  ageFilter: AgeFilterKey;
  sortBy: SortKey;
  query: string;
  onTypeFilter: (v: RequestType | "all") => void;
  onPriorityFilter: (v: Priority | "all") => void;
  onCompanyFilter: (v: string) => void;
  onAgeFilter: (v: AgeFilterKey) => void;
  onSortBy: (v: SortKey) => void;
  onQuery: (q: string) => void;
  onToggleAll: () => void;
  onToggleCheck: (id: string) => void;
  onSelect: (id: string) => void;
  onClearChecked: () => void;
  onBatchQueue: () => void;
  onBatchApprove: () => void;
  onDetailAction: (id: string, action: "approve" | "reject" | "queue" | "info" | "verify" | "send_back", note: string) => void;
}

export function HqQueuePanel({
  filtered, selected, checked,
  typeFilter, priorityFilter, companyFilter, ageFilter, sortBy, query,
  onTypeFilter, onPriorityFilter, onCompanyFilter, onAgeFilter, onSortBy, onQuery,
  onToggleAll, onToggleCheck, onSelect, onClearChecked,
  onBatchQueue, onBatchApprove, onDetailAction,
}: Props) {
  const actionable = filtered.filter((request) => request.canAct);
  return (
    <div className="mx-4 sm:mx-6 mt-4 grid grid-cols-1 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-4 h-[calc(100vh-16rem)] min-h-[600px]">
      <div className="bg-white border border-slate-200 rounded-lg flex flex-col overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-100 flex flex-wrap items-center gap-2">
          <input
            type="checkbox"
            checked={actionable.length > 0 && checked.size === actionable.length}
            disabled={actionable.length === 0}
            onChange={onToggleAll}
            className="w-3.5 h-3.5 rounded border-slate-300 accent-slate-900"
          />
          {checked.size > 0 ? (
            <div className="flex items-center gap-2 flex-1">
              <span className="text-xs text-slate-600 font-medium">{checked.size} selected</span>
              <button type="button" onClick={onBatchQueue}
                className="px-3 py-1 text-[11px] font-semibold bg-indigo-600 text-white rounded hover:bg-indigo-700">
                Queue for Super Admin
              </button>
              <button type="button" onClick={onBatchApprove}
                className="px-3 py-1 text-[11px] font-semibold bg-emerald-600 text-white rounded hover:bg-emerald-700">
                Approve all
              </button>
              <button type="button" onClick={onClearChecked} className="text-[11px] text-slate-500 hover:text-slate-900 ml-auto">
                Clear
              </button>
            </div>
          ) : (
            <>
              <TypeFilter value={typeFilter} onChange={onTypeFilter} />
              <PriorityFilter value={priorityFilter} onChange={onPriorityFilter} />
              <CompanyFilter value={companyFilter} onChange={onCompanyFilter} />
              <AgeFilter value={ageFilter} onChange={onAgeFilter} />
              <SortFilter value={sortBy} onChange={onSortBy} />
              <input
                value={query}
                onChange={(e) => onQuery(e.target.value)}
                placeholder="Filter by ID, subject, employee…"
                className="flex-1 min-w-[160px] text-xs bg-slate-50 border border-slate-200 rounded px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:bg-white"
              />
              <span className="text-[11px] text-slate-400 tabular-nums shrink-0">{filtered.length} results</span>
            </>
          )}
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
          {filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-400">Nothing here. Inbox zero.</div>
          ) : filtered.map((r) => (
            <RequestRow
              key={r.id}
              request={r}
              selected={selected?.id === r.id}
              checked={checked.has(r.id)}
              onToggleCheck={onToggleCheck}
              onSelect={onSelect}
              checkDisabled={!r.canAct}
            />
          ))}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {selected ? (
          <RequestDetail request={selected} onAction={onDetailAction} readOnly={!selected.canAct} />
        ) : (
          <div className="h-full grid place-items-center text-sm text-slate-400">Select a request to review.</div>
        )}
      </div>
    </div>
  );
}
