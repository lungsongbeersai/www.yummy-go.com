import type { BranchRealtimePayload } from "@/lib/socket";

export interface CartRealtimeScope {
  branchUuid: string;
  tableUuid?: string;
  orderUuids: readonly string[];
}

function identifier(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function shouldRefreshCartForEvent(
  payload: BranchRealtimePayload,
  scope: CartRealtimeScope,
) {
  const branchUuid = identifier(payload.branch_uuid_fk);
  if (!scope.branchUuid || (branchUuid && branchUuid !== scope.branchUuid)) {
    return false;
  }

  const tableUuid = identifier(payload.table_uuid);
  const activeTableUuid = identifier(scope.tableUuid);
  const activeOrderUuids = new Set(scope.orderUuids.map(identifier).filter(Boolean));
  if (tableUuid && activeTableUuid) return tableUuid === activeTableUuid;
  if (tableUuid && activeOrderUuids.size > 0) return false;

  const rawOrderUuids = payload.order_uuids;
  // Older or incomplete events, and carts whose first order is still unknown,
  // must reconcile from Backend rather than risk missing a committed change.
  if (
    !Array.isArray(rawOrderUuids) ||
    rawOrderUuids.length === 0 ||
    rawOrderUuids.some((value: unknown) => !identifier(value)) ||
    activeOrderUuids.size === 0
  ) {
    return true;
  }

  return rawOrderUuids.some((value: unknown) => activeOrderUuids.has(identifier(value)));
}
