"use client";

import type { CartOrder, PosTable, PosZone } from "@/services/pos";
import type { PrinterDeviceContext } from "@/services/printer";
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
  printerContext,
  table,
  variant = "side",
  showCreateEmployeeOrderAction = true,
  showTableFeatures = true,
  onCartRefresh,
  onTableActionComplete,
}: {
  allZones: PosZone[];
  cart: CartOrder | CartOrder[] | null;
  loading: boolean;
  newOrderFocusKey?: number;
  printerContext?: PrinterDeviceContext | null;
  table: PosTable | null;
  variant?: "side" | "sheet";
  showCreateEmployeeOrderAction?: boolean;
  showTableFeatures?: boolean;
  onCartRefresh: () => Promise<void>;
  onTableActionComplete: (nextTableUuid?: string) => Promise<void>;
}) {
  const workflow = useSelectedTableCartPanelWorkflow({
    cart,
    newOrderFocusKey,
    onCartRefresh,
    onTableActionComplete,
    printerContext,
    table,
  });

  return (
    <SelectedTableCartPanelContent
      allZones={allZones}
      loading={loading}
      showCreateEmployeeOrderAction={showCreateEmployeeOrderAction}
      showTableFeatures={showTableFeatures}
      variant={variant}
      workflow={workflow}
      onTableActionComplete={onTableActionComplete}
    />
  );
}
