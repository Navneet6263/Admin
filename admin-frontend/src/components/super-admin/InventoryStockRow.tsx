import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Settings2, Trash2 } from "lucide-react";
import type { InventoryItem } from "@/components/liveInventory";
import { fmtINR } from "./shared";
import { getStockStatus } from "./inventoryDisplay";

export function InventoryStockRow({
  item,
  selected,
  onSelect,
  onEdit,
  onDelete,
}: {
  item: InventoryItem;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const status = getStockStatus(item);
  const level = Math.min(100, (item.qty / Math.max(item.threshold * 2, 1)) * 100);
  const rowTone = selected
    ? "bg-indigo-50/70 outline outline-1 outline-indigo-200"
    : status === "out"
      ? "bg-rose-50/40"
      : status === "low"
        ? "bg-amber-50/30"
        : "hover:bg-slate-50/70";

  return (
    <tr onClick={onSelect} className={`cursor-pointer transition-colors ${rowTone}`}>
      <td className="px-4 py-3">
        <p className="font-medium text-slate-900">{item.name}</p>
        <p className="mt-0.5 font-mono text-[9px] text-slate-400">{item.sku}</p>
      </td>
      <td className="px-4 py-3">
        <span className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] text-slate-600">
          {item.category}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <p className="font-mono tabular-nums text-slate-700">{fmtINR(item.price)}</p>
        <p className="text-[9px] text-slate-400">per {item.unit}</p>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <span
            className={`font-mono font-semibold tabular-nums ${status === "out" ? "text-rose-700" : status === "low" ? "text-amber-700" : "text-slate-800"}`}
          >
            {item.qty} {item.unit}
          </span>
          <span className="text-[9px] text-slate-400">Min {item.threshold}</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full ${status === "out" ? "bg-rose-500" : status === "low" ? "bg-amber-500" : "bg-emerald-500"}`}
            style={{ width: `${level}%` }}
          />
        </div>
      </td>
      <td className="px-4 py-3 text-right font-mono font-medium tabular-nums text-slate-700">
        {fmtINR(item.qty * item.price)}
      </td>
      <td className="px-4 py-3">
        {status === "out" && (
          <Status className="border-rose-200 bg-rose-100 text-rose-700">Out of stock</Status>
        )}
        {status === "low" && (
          <Status className="border-amber-200 bg-amber-100 text-amber-800">
            <AlertTriangle className="h-3 w-3" /> Low
          </Status>
        )}
        {status === "healthy" && (
          <Status className="border-emerald-100 bg-emerald-50 text-emerald-700">
            <CheckCircle2 className="h-3 w-3" /> Healthy
          </Status>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <span className="inline-flex gap-1">
          <button
            type="button"
            title="Edit item"
            onClick={(event) => {
              event.stopPropagation();
              onEdit();
            }}
            className="rounded-md border border-transparent p-1.5 text-indigo-600 hover:border-indigo-100 hover:bg-indigo-50"
          >
            <Settings2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="Remove item"
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            className="rounded-md border border-transparent p-1.5 text-rose-600 hover:border-rose-100 hover:bg-rose-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </span>
      </td>
    </tr>
  );
}

function Status({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold ${className}`}
    >
      {children}
    </span>
  );
}
