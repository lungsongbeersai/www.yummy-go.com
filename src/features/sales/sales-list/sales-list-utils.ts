import { money } from "@/lib/format";
import { pageLimitNumber } from "@/lib/pagination";
import type { DailySaleItemsOrder } from "@/services/report";
import type { ApiEntity, PageLimit } from "@/services/shared/types";
import type { DailySaleItemsBillGroup } from "@/stores/report-store";

export const SALES_LIST_LIMIT_OPTIONS: PageLimit[] = [20, 50, 100, 200];
export const SALES_LIST_ORDER_OPTIONS: DailySaleItemsOrder[] = ["DESC", "ASC"];

export interface SalesListFilters {
  branchUuid: string;
  dateFrom: string;
  dateTo: string;
  limit: PageLimit;
  orderBy: DailySaleItemsOrder;
  search: string;
}

export function localDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function defaultSalesListFilters(branchUuid: string, limit: PageLimit): SalesListFilters {
  const today = localDateInputValue();
  return {
    branchUuid,
    dateFrom: today,
    dateTo: today,
    limit,
    orderBy: "DESC",
    search: ""
  };
}

export function salesListRange(page: number, limit: PageLimit, rowCount: number, total: number) {
  const size = pageLimitNumber(limit);
  const start = rowCount ? (page - 1) * size + 1 : 0;
  const end = rowCount ? Math.min(total || start + rowCount - 1, start + rowCount - 1) : 0;
  return { start, end };
}

export function isPresent(value: unknown) {
  return value !== null && value !== undefined && value !== "";
}

export function textValue(value: unknown, fallback = "-") {
  return isPresent(value) ? String(value) : fallback;
}

export function readValue(row: ApiEntity, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (isPresent(value)) return value;
  }
  return undefined;
}

export function numberValue(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

export function firstNumber(row: ApiEntity, keys: string[]) {
  return numberValue(readValue(row, keys));
}

export function moneyValue(value: unknown) {
  return money(numberValue(value));
}

export function formatSaleDate(value: unknown) {
  const raw = textValue(value, "");
  if (!raw) return "-";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString();
}

export function statusBadgeClass(value: unknown) {
  const status = textValue(value, "").toLowerCase();
  if (status.includes("cancel") || status.includes("void") || status === "0") {
    return "border-destructive/25 bg-destructive/10 text-destructive";
  }
  if (status.includes("active") || status.includes("paid") || status.includes("success") || status === "1") {
    return "border-primary/20 bg-primary/10 text-primary";
  }
  return "border-border bg-muted text-muted-foreground";
}

export function itemProductName(item: ApiEntity) {
  return textValue(readValue(item, ["product_name", "prod_name", "name", "item_name"]));
}

export function itemNote(item: ApiEntity) {
  return textValue(readValue(item, ["note", "order_it_note", "item_note"]), "");
}

export function saleListPrintBillSource(group: DailySaleItemsBillGroup): ApiEntity {
  const rawSummary = group.raw.summary;
  const summary = rawSummary && typeof rawSummary === "object" && !Array.isArray(rawSummary) ? rawSummary : {};

  return {
    ...group.raw,
    ...summary,
    amount: group.amountTotal,
    discount_amount: group.discountTotal,
    grand_total: group.lineTotal,
    items: group.items.map((item) => ({
      ...item,
      item_discount_amount: readValue(item, ["discount_total", "discount_amount", "item_discount_amount"]),
      line_total: readValue(item, ["total", "line_total", "net_total"]),
      price: readValue(item, ["sale_price", "price", "unit_price"]),
      topping_unit_total: readValue(item, ["topping_total", "topping_unit_total"])
    })),
    net_total: group.lineTotal,
    order_grand_total: group.lineTotal,
    order_total: group.amountTotal,
    receive_cash: group.receiveCashAmount,
    receive_transfer: group.receiveTransferAmount,
    service_charge_amount: group.serviceChargeAmount,
    table_name: group.tableName,
    total: group.lineTotal,
    vat_amount: group.vatAmount
  };
}
