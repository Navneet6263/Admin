import { ChevronLeft, ChevronRight } from "lucide-react";

export function TablePagination({ page, pageSize, total, onPage, onPageSize }: {
  page: number; pageSize: number; total: number; onPage: (page: number) => void; onPageSize: (size: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize)); const start = total ? (page - 1) * pageSize + 1 : 0;
  const end = Math.min(total, page * pageSize);
  return <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 bg-white px-4 py-2.5 text-[11px] text-slate-500">
    <span>Showing <b className="text-slate-800">{start}–{end}</b> of <b className="text-slate-800">{total}</b></span>
    <label className="ml-auto flex items-center gap-1.5">Rows<select value={pageSize} onChange={(event) => onPageSize(Number(event.target.value))} className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700">
      {[15, 25, 50].map((size) => <option key={size} value={size}>{size}</option>)}</select></label>
    <div className="inline-flex items-center overflow-hidden rounded-md border border-slate-200">
      <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)} className="border-r border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35"><ChevronLeft className="h-3.5 w-3.5" /></button>
      <span className="min-w-[86px] px-3 text-center font-medium text-slate-700">Page {page} of {pages}</span>
      <button type="button" aria-label="Next page" disabled={page >= pages} onClick={() => onPage(page + 1)} className="border-l border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35"><ChevronRight className="h-3.5 w-3.5" /></button>
    </div>
  </div>;
}
