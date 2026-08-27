import { useState } from "react";
import { Plus } from "lucide-react";
import { DeleteInventoryDialog, InventoryItemDialog } from "@/components/InventoryItemDialog";
import { StockMovementHistory } from "@/components/StockMovementHistory";
import { useInventory, type InventoryItem } from "@/components/liveInventory";
import { InventoryOverview } from "./InventoryOverview";
import { InventoryStockRegister } from "./InventoryStockRegister";

export function InventoryTab({ searchQuery = "" }: { searchQuery?: string }) {
  const items = useInventory();
  const [historySku, setHistorySku] = useState<string>();
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<InventoryItem | null>(null);

  return (
    <div className="mt-5 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 via-white to-indigo-50/60 px-5 py-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-600">
            Inventory control
          </p>
          <h2 className="mt-1 font-display text-xl font-semibold text-slate-900">
            Inventory command center
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Monitor stock health, catalog value and every item movement from one place.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-slate-900 px-4 text-xs font-semibold text-white shadow-sm hover:bg-slate-800"
        >
          <Plus className="h-3.5 w-3.5" /> Add inventory item
        </button>
      </div>

      <InventoryOverview items={items} />
      <InventoryStockRegister
        items={items}
        searchQuery={searchQuery}
        selectedSku={historySku}
        onSelect={setHistorySku}
        onEdit={setEditItem}
        onDelete={setDeleteItem}
      />

      <div className="space-y-2">
        {historySku && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-2 text-[11px] text-slate-600">
            <span>Movement history filtered to</span>
            <span className="font-mono font-semibold text-slate-900">{historySku}</span>
            <button
              type="button"
              onClick={() => setHistorySku(undefined)}
              className="font-semibold text-indigo-600 hover:underline"
            >
              Show all movements
            </button>
          </div>
        )}
        <StockMovementHistory key={historySku ?? "all"} initialSku={historySku} />
      </div>

      {addOpen && <InventoryItemDialog onClose={() => setAddOpen(false)} />}
      {editItem && <InventoryItemDialog item={editItem} onClose={() => setEditItem(null)} />}
      {deleteItem && (
        <DeleteInventoryDialog item={deleteItem} onClose={() => setDeleteItem(null)} />
      )}
    </div>
  );
}
