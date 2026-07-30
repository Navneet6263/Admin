import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, History, Search, Download, RotateCcw } from "lucide-react";
import { useStockMovements, type InventoryItem, type MovementSource } from "./liveInventory";

const SOURCE_LABEL: Record<MovementSource, string> = {
  seed: "Opening balance",
  restock: "Restock",
  add_item: "New SKU",
  adjustment: "Adjustment",
  request: "Request issue",
  return: "Return",
};

const SOURCE_TONE: Record<MovementSource, string> = {
  seed:       "bg-slate-100 text-slate-600 border-slate-200",
  restock:    "bg-emerald-50 text-emerald-700 border-emerald-100",
  add_item:   "bg-indigo-50 text-indigo-700 border-indigo-100",
  adjustment: "bg-amber-50 text-amber-800 border-amber-100",
  request:    "bg-sky-50 text-sky-700 border-sky-100",
  return:     "bg-teal-50 text-teal-700 border-teal-100",
};

const PAGE = 12;

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });

interface Props {
  /** Pre-select a SKU (e.g. clicked from stock register). */
  initialSku?: string;
  /** Constrain to a single category. */
  initialCategory?: InventoryItem["category"] | "all";
}

export function StockMovementHistory({ initialSku, initialCategory = "all" }: Props) {
  const all = useStockMovements();
  const [sku, setSku] = useState<string>(initialSku ?? "all");
  const [cat, setCat] = useState<InventoryItem["category"] | "all">(initialCategory);
  const [source, setSource] = useState<MovementSource | "all">("all");
  const [dir, setDir] = useState<"all" | "in" | "out">("all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const skuOptions = useMemo(() => {
    const seen = new Map<string, string>();
    all.forEach((m) => { if (!seen.has(m.sku)) seen.set(m.sku, m.name); });
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [all]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const fromT = from ? new Date(from).getTime() : -Infinity;
    const toT = to ? new Date(to).getTime() + 86400_000 : Infinity;
    return all.filter((m) => {
      if (sku !== "all" && m.sku !== sku) return false;
      if (cat !== "all" && m.category !== cat) return false;
      if (source !== "all" && m.source !== source) return false;
      if (dir !== "all" && m.direction !== dir) return false;
      const t = new Date(m.at).getTime();
      if (t < fromT || t >= toT) return false;
      if (q) {
        const hay = `${m.sku} ${m.name} ${m.refId ?? ""} ${m.actor ?? ""} ${m.note ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [all, sku, cat, source, dir, from, to, query]);

  const stats = useMemo(() => {
    let inQ = 0, outQ = 0;
    filtered.forEach((m) => { if (m.direction === "in") inQ += m.qty; else outQ += m.qty; });
    return { inQ, outQ, count: filtered.length };
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const safePage = Math.min(page, totalPages);
  const rows = filtered.slice((safePage - 1) * PAGE, safePage * PAGE);

  const reset = () => {
    setSku("all"); setCat(initialCategory); setSource("all"); setDir("all");
    setFrom(""); setTo(""); setQuery(""); setPage(1);
  };

  const exportCsv = () => {
    const lines = [
      ["Date", "SKU", "Item", "Category", "Direction", "Qty", "Balance", "Source", "Ref", "Actor", "Note"].join(","),
      ...filtered.map((m) => [
        fmtDate(m.at), m.sku, `"${m.name.replace(/"/g, '""')}"`, m.category,
        m.direction, m.qty, m.balanceAfter, SOURCE_LABEL[m.source],
        m.refId ?? "", `"${(m.actor ?? "").replace(/"/g, '""')}"`,
        `"${(m.note ?? "").replace(/"/g, '""')}"`,
      ].join(",")),
    ].join("\n");
    const blob = new Blob([lines], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `stock-movements-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const cats: InventoryItem["category"][] = ["Writing", "Paper", "Printing", "Filing", "Desk", "Misc"];
  const sources: MovementSource[] = ["request", "restock", "adjustment", "add_item", "seed", "return"];

  const bumpPage = (p: number) => setPage(Math.max(1, Math.min(totalPages, p)));

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3 flex-wrap">
        <p className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <History className="w-4 h-4 text-slate-500" /> Stock movement history
        </p>
        <span className="text-[10px] text-slate-400 uppercase tracking-widest">Every in/out event, auto-logged</span>
        <div className="ml-auto flex items-center gap-3 text-[11px]">
          <span className="inline-flex items-center gap-1 text-emerald-700"><ArrowDownRight className="w-3 h-3" /> IN <span className="font-mono font-semibold">{stats.inQ}</span></span>
          <span className="inline-flex items-center gap-1 text-rose-700"><ArrowUpRight className="w-3 h-3" /> OUT <span className="font-mono font-semibold">{stats.outQ}</span></span>
          <span className="text-slate-500">· <span className="font-mono font-semibold text-slate-800">{stats.count}</span> events</span>
          <button onClick={exportCsv} className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-slate-700 border border-slate-200 rounded hover:bg-slate-50">
            <Download className="w-3 h-3" /> CSV
          </button>
        </div>
      </div>

      {/* Filter row */}
      <div className="px-4 py-2.5 border-b border-slate-100 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 items-end">
        <div className="col-span-2 lg:col-span-2 relative">
          <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
          <input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            placeholder="Search item, SKU, ref, actor…"
            className="w-full pl-7 pr-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-slate-300" />
        </div>
        <select value={sku} onChange={(e) => { setSku(e.target.value); setPage(1); }}
          className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-slate-300">
          <option value="all">All SKUs</option>
          {skuOptions.map(([s, n]) => <option key={s} value={s}>{n}</option>)}
        </select>
        <select value={cat} onChange={(e) => { setCat(e.target.value as typeof cat); setPage(1); }}
          className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-slate-300">
          <option value="all">All categories</option>
          {cats.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={source} onChange={(e) => { setSource(e.target.value as typeof source); setPage(1); }}
          className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-slate-300">
          <option value="all">All sources</option>
          {sources.map((s) => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}
        </select>
        <select value={dir} onChange={(e) => { setDir(e.target.value as typeof dir); setPage(1); }}
          className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-slate-300">
          <option value="all">In &amp; Out</option>
          <option value="in">Stock IN only</option>
          <option value="out">Stock OUT only</option>
        </select>
        <div className="col-span-2 lg:col-span-1 grid grid-cols-2 gap-1">
          <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }}
            className="text-[10px] bg-slate-50 border border-slate-200 rounded px-1.5 py-1 focus:outline-none focus:ring-2 focus:ring-slate-300" />
          <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }}
            className="text-[10px] bg-slate-50 border border-slate-200 rounded px-1.5 py-1 focus:outline-none focus:ring-2 focus:ring-slate-300" />
        </div>
        <button onClick={reset} className="col-span-2 md:col-span-1 lg:col-span-1 inline-flex items-center justify-center gap-1 px-2 py-1 text-[10px] font-semibold text-slate-600 border border-slate-200 rounded hover:bg-slate-50">
          <RotateCcw className="w-3 h-3" /> Reset
        </button>
      </div>

      <div className="overflow-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Date</th>
              <th className="text-left px-4 py-2 font-medium">Item</th>
              <th className="text-left px-4 py-2 font-medium">Source</th>
              <th className="text-right px-4 py-2 font-medium">Change</th>
              <th className="text-right px-4 py-2 font-medium">Balance</th>
              <th className="text-left px-4 py-2 font-medium">Ref</th>
              <th className="text-left px-4 py-2 font-medium">Actor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map((m) => (
              <tr key={m.id} className="hover:bg-slate-50/60">
                <td className="px-4 py-2 text-slate-600 whitespace-nowrap">{fmtDate(m.at)}</td>
                <td className="px-4 py-2">
                  <p className="text-slate-800 font-medium leading-tight">{m.name}</p>
                  <p className="font-mono text-[10px] text-slate-400">{m.sku} · {m.category}</p>
                </td>
                <td className="px-4 py-2">
                  <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded border ${SOURCE_TONE[m.source]}`}>
                    {SOURCE_LABEL[m.source]}
                  </span>
                  {m.note && <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[220px]">{m.note}</p>}
                </td>
                <td className="px-4 py-2 text-right">
                  <span className={`inline-flex items-center gap-1 font-mono tabular-nums font-semibold ${m.direction === "in" ? "text-emerald-700" : "text-rose-700"}`}>
                    {m.direction === "in" ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                    {m.direction === "in" ? "+" : "−"}{m.qty}
                  </span>
                </td>
                <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-700">{m.balanceAfter}</td>
                <td className="px-4 py-2 font-mono text-[10px] text-slate-500">{m.refId ?? "—"}</td>
                <td className="px-4 py-2 text-slate-500 whitespace-nowrap">{m.actor ?? "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="p-10 text-center text-sm text-slate-400">No movements match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="px-4 py-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <span>
          Showing <span className="font-semibold text-slate-800">{rows.length === 0 ? 0 : (safePage - 1) * PAGE + 1}</span>–
          <span className="font-semibold text-slate-800">{(safePage - 1) * PAGE + rows.length}</span> of{" "}
          <span className="font-semibold text-slate-800">{filtered.length}</span>
        </span>
        <div className="inline-flex items-center gap-1">
          <button onClick={() => bumpPage(1)} disabled={safePage === 1}
            className="px-2 py-1 border border-slate-200 rounded disabled:opacity-40 hover:bg-slate-50">« First</button>
          <button onClick={() => bumpPage(safePage - 1)} disabled={safePage === 1}
            className="px-2 py-1 border border-slate-200 rounded disabled:opacity-40 hover:bg-slate-50">‹ Prev</button>
          <span className="px-2 font-mono">{safePage} / {totalPages}</span>
          <button onClick={() => bumpPage(safePage + 1)} disabled={safePage === totalPages}
            className="px-2 py-1 border border-slate-200 rounded disabled:opacity-40 hover:bg-slate-50">Next ›</button>
          <button onClick={() => bumpPage(totalPages)} disabled={safePage === totalPages}
            className="px-2 py-1 border border-slate-200 rounded disabled:opacity-40 hover:bg-slate-50">Last »</button>
        </div>
      </div>
    </div>
  );
}
