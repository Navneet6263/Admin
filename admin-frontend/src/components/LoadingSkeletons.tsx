import { Skeleton } from "@/components/ui/skeleton";

export function PageLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50" role="status" aria-label="Loading page">
      <div className="flex h-14 items-center gap-4 border-b border-slate-200 bg-white px-4 sm:px-6">
        <Skeleton className="h-8 w-8 bg-slate-200" />
        <div className="space-y-1.5"><Skeleton className="h-3 w-28 bg-slate-200" /><Skeleton className="h-2 w-20 bg-slate-100" /></div>
        <Skeleton className="ml-6 hidden h-8 max-w-lg flex-1 bg-slate-100 md:block" />
        <Skeleton className="ml-auto h-8 w-8 rounded-full bg-slate-200" />
      </div>
      <div className="border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <Skeleton className="h-7 w-full max-w-xl bg-slate-100" />
      </div>
      <main className="space-y-6 px-4 py-6 sm:px-6">
        <div className="space-y-2"><Skeleton className="h-3 w-32 bg-slate-200" /><Skeleton className="h-8 w-72 max-w-full bg-slate-200" /></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-28 bg-white shadow-sm ring-1 ring-slate-200" />)}
        </div>
        <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
          <TableLoadingSkeleton rows={7} columns={5} />
          <PanelLoadingSkeleton />
        </div>
      </main>
      <span className="sr-only">Loading RequestHub</span>
    </div>
  );
}

export function TableLoadingSkeleton({ rows = 6, columns = 6 }: { rows?: number; columns?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white" role="status" aria-label="Loading table">
      <div className="flex gap-3 border-b border-slate-100 p-4">
        {Array.from({ length: Math.min(columns, 4) }, (_, index) => <Skeleton key={index} className="h-8 flex-1 bg-slate-100" />)}
      </div>
      <div className="divide-y divide-slate-100 px-4">
        {Array.from({ length: rows }, (_, row) => (
          <div key={row} className="grid gap-4 py-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
            {Array.from({ length: columns }, (_, column) => (
              <Skeleton key={column} className={column === 0 ? "h-3 bg-slate-200" : "h-3 bg-slate-100"} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function PanelLoadingSkeleton() {
  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5" role="status" aria-label="Loading dashboard data">
      <Skeleton className="h-5 w-44 bg-slate-200" />
      <Skeleton className="h-3 w-64 max-w-full bg-slate-100" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-20 bg-slate-100" />)}
      </div>
      <Skeleton className="h-44 w-full bg-slate-100" />
    </div>
  );
}

export function MasterDetailLoadingSkeleton() {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]" aria-label="Loading records">
      <TableLoadingSkeleton rows={8} columns={4} />
      <PanelLoadingSkeleton />
    </div>
  );
}
