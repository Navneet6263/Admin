import { isLow, type InventoryItem } from "@/components/liveInventory";

export type StockStatus = "all" | "healthy" | "low" | "out";
export type ItemStockStatus = Exclude<StockStatus, "all">;

export function getStockStatus(item: InventoryItem): ItemStockStatus {
  if (item.qty === 0) return "out";
  if (isLow(item)) return "low";
  return "healthy";
}

export function stockCounts(items: InventoryItem[]) {
  return items.reduce(
    (counts, item) => {
      counts[getStockStatus(item)] += 1;
      return counts;
    },
    { healthy: 0, low: 0, out: 0 },
  );
}
