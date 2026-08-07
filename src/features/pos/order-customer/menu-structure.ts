import type { Route } from "next";
import {
  ProductSortStatus as ProductSortStatusValue,
  TableStatus,
  type ProductSortStatus as ProductSortStatusType,
} from "@/config/pos-constants";
import {
  type CateProductItem,
  type CateWithProducts,
  type PosTable,
} from "@/services/pos";
import {
  countPosMenuProducts,
  emptyPosMenuBySort,
  firstPosMenuStatusWithProducts,
  nextPosMenuCategoryUuid,
  type PosMenuBySort,
} from "@/stores/pos-store/helpers";

export const ProductSortStatus = ProductSortStatusValue;
export type ProductSortStatus = ProductSortStatusType;

export const MAX_ORDER_QTY = 99;
export const PRODUCT_GRID_CLASS =
  "grid grid-cols-2 gap-2.5 md:grid-cols-[repeat(auto-fill,minmax(190px,1fr))]";
// ต้องตรงกับ grid-cols-2 ด้านบน — ใช้ตัดสินว่า preload รูปกี่ใบให้ครอบการ์ดแถวแรก (LCP)
export const PRODUCT_GRID_MOBILE_COLUMNS = 2;

export const SORT_TABS: Array<{
  labelKey: string;
  status: ProductSortStatus;
}> = [
  { labelKey: "pos.menuNormal", status: ProductSortStatus.NORMAL },
  { labelKey: "pos.menuSet", status: ProductSortStatus.SET },
  { labelKey: "pos.menuPromotion", status: ProductSortStatus.PROMOTION },
];

export type MenuBySort = PosMenuBySort;
export type ProductCardEntry = {
  cateUuid: string;
  product: CateProductItem;
};
export type ProductMedia =
  | { type: "image"; src: string }
  | { type: "color"; color: string }
  | { type: "empty" };
export type ProductActionState = "blocked" | "choose" | "add" | "view";
export type ProductModalMode = "normal" | "set" | "promotion";
export type OrderSelectionIssue =
  | "detail-unavailable"
  | "price-invalid"
  | "quantity-invalid"
  | "quantity-exceeds-stock"
  | "stock-insufficient"
  | "topping-invalid";
export type ProductCardPrice =
  | { kind: "exact" | "starting"; value: number }
  | { kind: "unavailable" | "variable"; value: null };
export type Translate = (key: string, options?: Record<string, unknown>) => string;

export function emptyMenuBySort(): MenuBySort {
  return emptyPosMenuBySort();
}

export function flattenProducts(
  categories: CateWithProducts[],
): ProductCardEntry[] {
  return categories.flatMap((category) =>
    (category.products ?? []).map((product) => ({
      cateUuid: category.cateUuid,
      product,
    })),
  );
}

export function countProducts(categories: CateWithProducts[]) {
  return countPosMenuProducts(categories);
}

export function firstStatusWithProducts(menuBySort: MenuBySort) {
  return firstPosMenuStatusWithProducts(menuBySort);
}

export function selectedOrderTable({
  tableName,
  tableUuid,
  zones,
}: {
  tableName: string;
  tableUuid: string;
  zones: Array<{ tables?: PosTable[] | null }>;
}): PosTable {
  const found = zones
    .flatMap((zone) => zone.tables ?? [])
    .find((table) => table.table_uuid === tableUuid);

  return (
    found ?? {
      table_uuid: tableUuid,
      table_name: tableName || "-",
      table_status: TableStatus.OCCUPIED,
      number_of_seats: 0,
    }
  );
}

// ร้านไม่มีโต๊ะ (store_table_status === 2): ใช้ order_uuid ของบิลปัจจุบันแทน
// table_uuid เป็น identity ให้ SelectedTableCartPanel/useSelectedTableCartPanelWorkflow
// ใช้ pipeline เดิม (hasSelectedTable, cartOrdersBelongToTable ฯลฯ) ได้โดยไม่ต้องแก้
export function counterOrderTable(orderUuid: string, tableName: string): PosTable {
  return {
    table_uuid: orderUuid,
    table_name: tableName,
    table_status: TableStatus.OCCUPIED,
    number_of_seats: 0,
  };
}

export function orderCustomerUrl({
  tableName,
  tableUuid,
}: {
  tableName: string;
  tableUuid: string;
}): Route {
  const params = new URLSearchParams({
    table_uuid: tableUuid,
    table_name: tableName,
  });
  // path เป็น route จริง ส่วน query เป็นค่า runtime — typedRoutes ตรวจ template แบบนี้ไม่ได้
  return `/pos/order?${params.toString()}` as Route;
}

// Lives here (rather than with the other quantity-rule helpers) so both
// topping-selection.ts and quantity-rules.ts can depend on it without a cycle.
export function clampQty(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.min(MAX_ORDER_QTY, Math.max(1, Math.floor(value)));
}

export function nextMenuCategoryUuid({
  categories,
  defaultCateUuid,
  requestedCateUuid,
  selectedCateUuid,
}: {
  categories: CateWithProducts[];
  defaultCateUuid?: string | null;
  requestedCateUuid?: string | null;
  selectedCateUuid?: string | null;
}) {
  return nextPosMenuCategoryUuid({
    categories,
    defaultCateUuid,
    requestedCateUuid,
    selectedCateUuid,
  });
}
