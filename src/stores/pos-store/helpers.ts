import {
  ProductSortStatus,
  type CateWithProducts,
  type PosZone,
  type ProductSortStatus as ProductSortStatusType
} from "@/services/pos";
import { optionalString } from "@/lib/values";

export type PosMenuBySort = Record<ProductSortStatusType, CateWithProducts[]>;

export function emptyPosMenuBySort(): PosMenuBySort {
  return {
    [ProductSortStatus.NORMAL]: [],
    [ProductSortStatus.SET]: [],
    [ProductSortStatus.PROMOTION]: []
  };
}

export function countPosMenuProducts(categories: CateWithProducts[]) {
  return categories.reduce(
    (sum, category) => sum + (category.products?.length ?? 0),
    0
  );
}

export function firstPosMenuStatusWithProducts(menuBySort: PosMenuBySort) {
  const statuses = [
    ProductSortStatus.NORMAL,
    ProductSortStatus.SET,
    ProductSortStatus.PROMOTION
  ] as const;

  return (
    statuses.find((status) => countPosMenuProducts(menuBySort[status]) > 0) ??
    ProductSortStatus.NORMAL
  );
}

export function preferredPosMenuStatus(
  menuBySort: PosMenuBySort,
  activeSort: ProductSortStatusType,
) {
  let preferredSort = activeSort;
  let greatestCount = countPosMenuProducts(menuBySort[activeSort]);

  for (const status of [
    ProductSortStatus.NORMAL,
    ProductSortStatus.SET,
    ProductSortStatus.PROMOTION,
  ] as const) {
    const count = countPosMenuProducts(menuBySort[status]);
    if (count > greatestCount) {
      preferredSort = status;
      greatestCount = count;
    }
  }

  return preferredSort;
}

export function nextPosMenuCategoryUuid({
  categories,
  defaultCateUuid,
  requestedCateUuid,
  selectedCateUuid
}: {
  categories: CateWithProducts[];
  defaultCateUuid?: string | null;
  requestedCateUuid?: string | null;
  selectedCateUuid?: string | null;
}) {
  return (
    optionalString(requestedCateUuid) ??
    optionalString(selectedCateUuid) ??
    optionalString(defaultCateUuid) ??
    optionalString(categories[0]?.cateUuid) ??
    ""
  );
}

export function updateZonesTableOrderState(zones: PosZone[], tableUuid: string, customerOrderState: boolean) {
  let changed = false;

  const nextZones = zones.map((zone) => {
    let zoneChanged = false;
    const nextTables = (zone.tables ?? []).map((table) => {
      if (table.table_uuid !== tableUuid) return table;
      if (table.customer_order_state === customerOrderState) return table;

      changed = true;
      zoneChanged = true;
      return { ...table, customer_order_state: customerOrderState };
    });

    return zoneChanged ? { ...zone, tables: nextTables } : zone;
  });

  return changed ? nextZones : zones;
}

export function updateZonesTableStatus(zones: PosZone[], tableUuid: string, tableStatus: number) {
  let changed = false;

  const nextZones = zones.map((zone) => {
    let zoneChanged = false;
    const nextTables = (zone.tables ?? []).map((table) => {
      if (table.table_uuid !== tableUuid) return table;
      if (Number(table.table_status) === tableStatus) return table;

      changed = true;
      zoneChanged = true;
      return { ...table, table_status: tableStatus };
    });

    return zoneChanged ? { ...zone, tables: nextTables } : zone;
  });

  return changed ? nextZones : zones;
}
