"use client";

import type { CartOrder, PosTable, PosZone } from "@/services/pos";
import { useSelectedTableCartPanelWorkflow } from "./hooks/use-selected-table-cart-panel-workflow";
import { SelectedTableCartPanelContent } from "./selected-table-cart-panel-content";

export function TableNextStepPanel({
  allZones,
  cart,
  loading,
  onCartRefresh,
  onTableActionComplete,
  selectedTable,
  showCreateEmployeeOrderAction = true,
}: {
  allZones: PosZone[];
  cart: CartOrder | CartOrder[] | null;
  loading: boolean;
  onCartRefresh: () => Promise<void>;
  onTableActionComplete: (nextTableUuid?: string) => Promise<void>;
  selectedTable: PosTable | null;
  showCreateEmployeeOrderAction?: boolean;
}) {
  return (
    <SelectedTableCartPanel
      allZones={allZones}
      cart={cart}
      loading={loading}
      table={selectedTable}
      showCreateEmployeeOrderAction={showCreateEmployeeOrderAction}
      onCartRefresh={onCartRefresh}
      onTableActionComplete={onTableActionComplete}
    />
  );
}

export function SelectedTableCartPanel({
  allZones,
  cart,
  loading,
  newOrderFocusKey = 0,
  table,
  variant = "side",
  showCreateEmployeeOrderAction = true,
  onCartRefresh,
  onTableActionComplete,
}: {
  allZones: PosZone[];
  cart: CartOrder | CartOrder[] | null;
  loading: boolean;
  newOrderFocusKey?: number;
  table: PosTable | null;
  variant?: "side" | "sheet";
  showCreateEmployeeOrderAction?: boolean;
  onCartRefresh: () => Promise<void>;
  onTableActionComplete: (nextTableUuid?: string) => Promise<void>;
}) {
  const workflow = useSelectedTableCartPanelWorkflow({
    cart,
    newOrderFocusKey,
    onCartRefresh,
    onTableActionComplete,
    table,
  });

  return (
    <SelectedTableCartPanelContent
      allZones={allZones}
      loading={loading}
      showCreateEmployeeOrderAction={showCreateEmployeeOrderAction}
      variant={variant}
      workflow={workflow}
      onTableActionComplete={onTableActionComplete}
    />
  );
}
