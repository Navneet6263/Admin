import { ChevronLeft, ChevronRight } from "lucide-react";

export function PaginationBar({ page, pageSize, total, onPageChange }: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);
  return <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-white px-4 py-2.5">
    <span className="text-[11px] tabular-nums text-slate-500">{start}–{end} of {total}</span>
    <div className="flex items-center gap-2">
      <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)}
        className="grid h-7 w-7 place-items-center rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35"
        aria-label="Previous page"><ChevronLeft className="h-3.5 w-3.5" /></button>
      <span className="min-w-16 text-center text-[11px] font-medium tabular-nums text-slate-600">Page {page} / {pages}</span>
      <button type="button" disabled={page >= pages} onClick={() => onPageChange(page + 1)}
        className="grid h-7 w-7 place-items-center rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35"
        aria-label="Next page"><ChevronRight className="h-3.5 w-3.5" /></button>
    </div>
  </div>;
}
