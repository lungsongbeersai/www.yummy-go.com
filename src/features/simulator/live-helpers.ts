import type { SimulatorLiveSnapshot, SimulatorLiveTable } from "@/services/simulator";

export const LIVE_SCENE_TABLE_LIMIT = 80;

export function limitLiveSceneTables(tables: SimulatorLiveTable[], selectedTableId: string | null) {
  const visible = tables.slice(0, LIVE_SCENE_TABLE_LIMIT);
  const selected = tables.find((table) => table.table_uuid === selectedTableId);
  if (selected && !visible.some((table) => table.table_uuid === selected.table_uuid)) visible[visible.length - 1] = selected;
  return visible;
}

export function liveTableSceneStatus(status: number) {
  return ({ 1: "available", 2: "occupied", 3: "draft", 4: "awaiting", 5: "calling", 6: "billing" } as Record<number, string>)[status] ?? "occupied";
}

export function liveItemStatusLabel(status: number) {
  return ({ 0: "customerDraft", 1: "staffDraft", 2: "sentKitchen", 3: "inKitchen", 4: "served", 9: "cancelled" } as Record<number, string>)[status] ?? "unknownStatus";
}

export function liveTableStatusClass(status: number) {
  return ({ 1: "bg-success/10 text-success-text border-success/30", 2: "bg-info/10 text-info-text border-info/30",
    3: "bg-pending/10 text-warning-text border-pending/30", 4: "bg-warning/10 text-warning-text border-warning/30",
    5: "bg-destructive/10 text-destructive border-destructive/30", 6: "bg-chart-cat-5/10 text-foreground border-chart-cat-5/40" } as Record<number, string>)[status] ?? "bg-muted text-muted-foreground";
}

export function createLiveCharacters(snapshot: SimulatorLiveSnapshot, visibleTables = snapshot.tables) {
  // Actual POS stores no headcount or physical tracking. One anonymous marker
  // indicates an occupied table; the UI explicitly labels these as illustrations.
  return visibleTables.filter((table) => table.status !== 1).slice(0, 16).map((table) => {
    const items = snapshot.orders.filter((order) => order.table_uuid === table.table_uuid).flatMap((order) => order.items);
    return { id: `live-table:${table.table_uuid}`, role: "customer" as const, tableId: table.table_uuid,
      state: table.status === 6 ? "requesting_bill" : items.some((item) => item.status === 4) ? "eating" : items.some((item) => [2, 3].includes(item.status)) ? "waiting_food" : "browsing" };
  });
}
