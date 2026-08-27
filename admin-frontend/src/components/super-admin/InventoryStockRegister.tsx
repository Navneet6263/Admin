import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { TablePagination } from "@/components/TablePagination";
import { INVENTORY_CATEGORIES, type InventoryItem } from "@/components/liveInventory";
import { InventoryStockRow } from "./InventoryStockRow";
import { getStockStatus, stockCounts, type StockStatus } from "./inventoryDisplay";

export function InventoryStockRegister({
  items,
  searchQuery,
  selectedSku,
  onSelect,
  onEdit,
  onDelete,
}: {
  items: InventoryItem[];
  searchQuery: string;
  selectedSku?: string;
  onSelect: (sku: string) => void;
  onEdit: (item: InventoryItem) => void;
  onDelete: (item: InventoryItem) => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState<StockStatus>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const counts = useMemo(() => stockCounts(items), [items]);
  const filtered = useMemo(() => {
    const terms = [query, searchQuery].map((value) => value.trim().toLowerCase()).filter(Boolean);
    return items
      .filter((item) => category === "all" || item.category === category)
      .filter((item) => status === "all" || getStockStatus(item) === status)
      .filter((item) =>
        terms.every((term) =>
          `${item.name} ${item.sku} ${item.category} ${item.unit}`.toLowerCase().includes(term),
        ),
      )
      .sort(
        (a, b) =>
          ["out", "low", "healthy"].indexOf(getStockStatus(a)) -
            ["out", "low", "healthy"].indexOf(getStockStatus(b)) || a.name.localeCompare(b.name),
      );
  }, [category, items, query, searchQuery, status]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const filtersActive = Boolean(query || category !== "all" || status !== "all");

  useEffect(() => {
    setPage(1);
  }, [category, pageSize, query, searchQuery, status]);
  useEffect(() => {
    setPage((current) => Math.min(current, pages));
  }, [pages]);

  const reset = () => {
    setQuery("");
    setCategory("all");
    setStatus("all");
  };
  const statusOptions: { value: StockStatus; label: string; count: number }[] = [
    { value: "all", label: "All stock", count: items.length },
    { value: "healthy", label: "Healthy", count: counts.healthy },
    { value: "low", label: "Low", count: counts.low },
    { value: "out", label: "Out", count: counts.out },
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-200/30">
      <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-sm font-semibold text-slate-900">Stock register</h3>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Search, review stock health and select an item to inspect its movement history.
            </p>
          </div>
          <p className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-medium text-slate-600">
            {filtered.length} of {items.length} items
          </p>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(220px,1fr)_190px_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search item, SKU or unit…"
              className="h-9 w-full rounded-md border border-slate-200 bg-slate-50 pl-9 pr-8 text-xs outline-none focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-200"
            />
            {query && (
              <button
                type="button"
                aria-label="Clear inventory search"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="h-9 rounded-md border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700 outline-none focus:border-slate-400 focus:bg-white"
          >
            <option value="all">All categories</option>
            {INVENTORY_CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          {filtersActive && (
            <button
              type="button"
              onClick={reset}
              className="h-9 rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Reset filters
            </button>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {statusOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setStatus(option.value)}
              className={`rounded-full border px-3 py-1.5 text-[10px] font-semibold transition ${status === option.value ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              {option.label}
              <span
                className={`ml-1.5 ${status === option.value ? "text-white/70" : "text-slate-400"}`}
              >
                {option.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-xs">
          <thead className="bg-slate-50/80 text-[10px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Item / SKU</th>
              <th className="px-4 py-2.5 text-left font-medium">Category</th>
              <th className="px-4 py-2.5 text-right font-medium">Unit price</th>
              <th className="w-56 px-4 py-2.5 text-left font-medium">Stock level</th>
              <th className="px-4 py-2.5 text-right font-medium">Stock value</th>
              <th className="px-4 py-2.5 text-left font-medium">Status</th>
              <th className="px-4 py-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.map((item) => (
              <InventoryStockRow
                key={item.sku}
                item={item}
                selected={item.sku === selectedSku}
                onSelect={() => onSelect(item.sku)}
                onEdit={() => onEdit(item)}
                onDelete={() => onDelete(item)}
              />
            ))}
            {!visible.length && (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center">
                  <p className="text-sm font-medium text-slate-600">No inventory items found</p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Adjust the search, category or stock status filter.
                  </p>
                  {filtersActive && (
                    <button
                      type="button"
                      onClick={reset}
                      className="mt-3 rounded border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Clear filters
                    </button>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <TablePagination
        page={page}
        pageSize={pageSize}
        total={filtered.length}
        onPage={setPage}
        onPageSize={setPageSize}
      />
    </div>
  );
}
