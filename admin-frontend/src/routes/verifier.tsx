import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, Filter, ShieldCheck, Undo2 } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PaginationBar } from "@/components/PaginationBar";
import { protectedRoute } from "@/components/ProtectedRoute";
import { RequestDetail } from "@/components/RequestDetail";
import { RequestRow } from "@/components/RequestRow";
import { priorityRank, typeLabels, type Priority, type RequestItem, type RequestType } from "@/components/models";
import { getPagedRequests } from "@/lib/api";
import { useCompanies } from "@/lib/directory";
import { useSessionUser } from "@/lib/useSessionUser";

export const Route = createFileRoute("/verifier")({
  head: () => ({ meta: [{ title: "Audit Review — RequestHub" },
    { name: "description", content: "Read-only history for legacy verification records." }] }),
  component: protectedRoute(VerifierConsole, ["verifier"]),
});

type Tab = "verified" | "sent_back" | "all";
type SortKey = "priority" | "newest" | "oldest" | "amount";
type Summary = Record<Tab, number>;

function VerifierConsole() {
  const user = useSessionUser();
  const companies = useCompanies();
  const [rows, setRows] = useState<RequestItem[]>([]);
  const [tab, setTab] = useState<Tab>("all");
  const [company, setCompany] = useState("all");
  const [type, setType] = useState<RequestType | "all">("all");
  const [priority, setPriority] = useState<Priority | "all">("all");
  const [sort, setSort] = useState<SortKey>("priority");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<Summary>({ verified: 0, sent_back: 0, all: 0 });
  const [error, setError] = useState("");
  const pageSize = 25;

  const refresh = useCallback(async () => {
    try {
      const result = await getPagedRequests<Summary>(`/api/verifier/queue?view=${tab}&page=${page}&page_size=${pageSize}`);
      setRows(result.data); setTotal(result.total); setError("");
      if (result.summary) setSummary(result.summary);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Verification queue could not be loaded"); }
  }, [page, tab]);
  useEffect(() => { void refresh(); }, [refresh]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => company === "all" || row.company === company)
      .filter((row) => type === "all" || row.type === type)
      .filter((row) => priority === "all" || row.priority === priority)
      .filter((row) => !q || `${row.id} ${row.subject} ${row.employeeName}`.toLowerCase().includes(q))
      .sort((a, b) => sort === "newest" ? +new Date(b.updatedAt) - +new Date(a.updatedAt)
        : sort === "oldest" ? +new Date(a.updatedAt) - +new Date(b.updatedAt)
        : sort === "amount" ? (b.amount ?? 0) - (a.amount ?? 0)
        : priorityRank[a.priority] - priorityRank[b.priority] || +new Date(b.updatedAt) - +new Date(a.updatedAt));
  }, [company, priority, query, rows, sort, type]);
  const selected = rows.find((row) => row.id === selectedId) ?? filtered[0];

  const tabs = [
    { id: "verified" as const, label: "Verified", icon: CheckCircle2 },
    { id: "sent_back" as const, label: "Sent back", icon: Undo2 },
    { id: "all" as const, label: "All", icon: Filter },
  ];
  return <DashboardLayout workspace="Audit Review" currentUser={user?.name ?? ""} role={user?.dept || "Audit Reviewer"}>
    <div className="px-4 pt-6 sm:px-6">
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div><p className="mb-1 text-[10px] uppercase tracking-widest text-slate-400">Historical review · Non-blocking</p>
          <h1 className="font-display text-2xl font-semibold text-slate-900">Legacy Audit History</h1>
          <span className="mt-2 inline-flex items-center gap-1.5 rounded border border-violet-100 bg-violet-50 px-2 py-1 text-[10px] font-medium text-violet-700">
            <ShieldCheck className="h-3 w-3" /> Signed in as {user?.name ?? "Loading…"}</span></div>
        <div className="grid grid-cols-2 gap-2"><Kpi label="Verified" value={summary.verified} tone="emerald" />
          <Kpi label="Sent back" value={summary.sent_back} tone="amber" /></div>
      </div>
      <div className="-mx-4 flex items-center gap-1 overflow-x-auto border-b border-slate-200 px-4 sm:-mx-6 sm:px-6">{tabs.map((item) =>
        <button key={item.id} onClick={() => { setTab(item.id); setPage(1); }} className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-xs font-medium ${tab === item.id ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500"}`}>
          <item.icon className="h-3.5 w-3.5" />{item.label}<span className={`rounded px-1.5 py-0.5 text-[10px] ${tab === item.id ? "bg-slate-900 text-white" : "bg-slate-100"}`}>{summary[item.id]}</span></button>)}</div>
    </div>
    <div className="mx-4 mt-4 grid min-h-[600px] grid-cols-1 gap-4 sm:mx-6 xl:h-[calc(100vh-16rem)] xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <div className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
        {error && <div className="border-b border-rose-100 bg-rose-50 px-4 py-2 text-xs text-rose-700">{error}</div>}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2.5">
          <Select value={company} set={setCompany} options={[{ v: "all", l: "All companies" },...companies.map((c) => ({ v: c.code, l: c.name }))]} />
          <Select value={type} set={(v) => setType(v as RequestType | "all")} options={[{ v: "all", l: "All categories" },...Object.entries(typeLabels).map(([v,l]) => ({ v,l }))]} />
          <Select value={priority} set={(v) => setPriority(v as Priority | "all")} options={[{ v: "all", l: "Any priority" },...(["urgent","high","normal","low"].map((v) => ({ v,l:v })))]} />
          <Select value={sort} set={(v) => setSort(v as SortKey)} options={[{ v:"priority",l:"Sort: Priority" },{ v:"newest",l:"Sort: Newest" },{ v:"oldest",l:"Sort: Oldest" },{ v:"amount",l:"Sort: Amount" }]} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter ID, subject, employee…" className="min-w-40 flex-1 rounded border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs outline-none" />
        </div>
        <div className="flex-1 divide-y divide-slate-50 overflow-y-auto">{filtered.length ? filtered.map((row) =>
          <RequestRow key={row.id} request={row} selected={selected?.id === row.id} checked={false} onToggleCheck={() => {}} onSelect={setSelectedId} />)
          : <div className="p-10 text-center text-sm text-slate-400">Nothing in this view.</div>}</div>
        <PaginationBar page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">{selected
        ? <RequestDetail request={selected} readOnly />
        : <div className="grid h-full place-items-center text-sm text-slate-400">Select a historical request.</div>}</div>
    </div>
  </DashboardLayout>;
}

function Select({ value, set, options }: { value: string; set: (value: string) => void; options: { v: string; l: string }[] }) {
  return <div className="relative"><select value={value} onChange={(e) => set(e.target.value)} className="appearance-none rounded border border-slate-200 bg-slate-50 py-1 pl-2.5 pr-7 text-xs capitalize outline-none">{options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select><ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" /></div>;
}
function Kpi({ label, value, tone }: { label: string; value: number; tone: "violet" | "emerald" | "amber" }) {
  const colors = { violet: "border-l-violet-400", emerald: "border-l-emerald-400", amber: "border-l-amber-400" };
  return <div className={`min-w-28 rounded-md border border-l-4 border-slate-200 bg-white px-3 py-2 ${colors[tone]}`}><p className="text-[10px] uppercase text-slate-500">{label}</p><p className="text-xl font-semibold tabular-nums text-slate-900">{value || 0}</p></div>;
}
