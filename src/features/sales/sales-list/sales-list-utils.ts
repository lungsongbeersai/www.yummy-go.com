import { money } from "@/lib/format";
import { pageLimitNumber } from "@/lib/pagination";
import type { DailySaleItemsOrder } from "@/services/report";
import type { ApiEntity, PageLimit } from "@/services/shared/types";
import type { DailySaleItemsBillGroup } from "@/stores/report-store";

export const SALES_LIST_LIMIT_OPTIONS: PageLimit[] = [20, 50, 100, 200];
export const SALES_LIST_ORDER_OPTIONS: DailySaleItemsOrder[] = ["DESC", "ASC"];
export const SALES_LIST_PAYMENT_METHOD_OPTIONS = ["All", "1", "2", "4"] as const;
export type SalesListPaymentMethod = (typeof SALES_LIST_PAYMENT_METHOD_OPTIONS)[number];

export interface SalesListFilters {
  branchUuid: string;
  dateFrom: string;
  dateTo: string;
  limit: PageLimit;
  orderBy: DailySaleItemsOrder;
  paymentMethod: SalesListPaymentMethod;
  search: string;
}

export interface SalesListBranchOption {
  label: string;
  value: string;
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
    paymentMethod: "All",
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

export function branchOptionLabel(branch: ApiEntity, language: string) {
  const keys =
    language === "en"
      ? ["branch_name_eng", "branch_name", "branch_name_la", "branch_code", "branch_uuid"]
      : ["branch_name_la", "branch_name", "branch_name_eng", "branch_code", "branch_uuid"];

  return textValue(readValue(branch, keys), "-");
}

export function branchOptionFromRow(branch: ApiEntity, language: string): SalesListBranchOption | null {
  const value = textValue(readValue(branch, ["branch_uuid", "branch_uuid_fk"]), "");
  if (!value) return null;
  return { value, label: branchOptionLabel(branch, language) };
}

export function selectedBranchLabel(options: SalesListBranchOption[], value: string, fallback = "-") {
  return options.find((option) => option.value === value)?.label ?? fallback;
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

export function billNeedsPaymentAttention(bill: DailySaleItemsBillGroup) {
  if (bill.cancelled) return false;
  if (bill.debtAmount > 0) return true;

  const paymentText = `${bill.paymentMethodCode} ${bill.paymentMethodName}`.toLowerCase();
  const status = bill.status.toLowerCase();
  return (
    ["debt", "unpaid", "pending", "arrears", "balance", "credit"].some(
      (value) => paymentText.includes(value) || status.includes(value)
    ) ||
    paymentText.includes("ໜີ້") ||
    paymentText.includes("ຄ້າງ") ||
    status.includes("ໜີ້") ||
    status.includes("ຄ້າງ")
  );
}

export function itemProductName(item: ApiEntity) {
  return textValue(readValue(item, ["product_full_name", "product_name", "prod_name", "name", "item_name"]));
}

export interface SalesListItemTopping {
  name: string;
  qty: number;
  total: number;
}

export type SalesListItemMedia =
  | { type: "color"; color: string }
  | { type: "empty" }
  | { type: "image"; src: string };

const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}){1,2}$/i;

function isHexColor(value: string) {
  return HEX_COLOR_PATTERN.test(value.trim());
}

export function itemMedia(item: ApiEntity): SalesListItemMedia {
  const mediaValue = textValue(
    readValue(item, ["prod_image", "product_image", "image", "prod_image_raw", "image_url"]),
    ""
  );
  if (!mediaValue) return { type: "empty" };

  const imageStatus = firstNumber(item, ["prod_status_imge", "prod_status_image", "product_image_status", "image_status"]);
  const isColor = imageStatus === 2 || isHexColor(mediaValue);
  if (isColor) {
    return isHexColor(mediaValue) ? { type: "color", color: mediaValue } : { type: "empty" };
  }

  return { type: "image", src: mediaValue };
}

export function itemToppings(item: ApiEntity): SalesListItemTopping[] {
  const rows = readValue(item, ["toppings", "item_toppings", "order_item_toppings"]);
  if (!Array.isArray(rows)) return [];

  return rows
    .filter((row): row is ApiEntity => Boolean(row) && typeof row === "object" && !Array.isArray(row))
    .map((row) => ({
      name: textValue(readValue(row, ["topping_name", "prod_topping_name", "product_name", "name"]), ""),
      qty: firstNumber(row, ["topping_qty", "qty", "quantity"]),
      total: firstNumber(row, ["topping_total", "total", "line_total", "topping_price"])
    }))
    .filter((row) => Boolean(row.name));
}

export function itemToppingNames(item: ApiEntity) {
  return itemToppings(item).map((topping) => {
    const qty = topping.qty > 1 ? ` x ${topping.qty.toLocaleString("en-US")}` : "";
    return `${topping.name}${qty}`;
  });
}

export function itemToppingTotal(item: ApiEntity) {
  const explicit = firstNumber(item, ["topping_total", "topping_line_total", "topping_unit_total"]);
  if (explicit > 0) return explicit;
  return itemToppings(item).reduce((total, topping) => total + topping.total, 0);
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
    change_amount: group.changeAmount,
    discount_amount: group.discountTotal,
    grand_total: group.lineTotal,
    items: group.items.map((item) => ({
      ...item,
      item_discount_amount: readValue(item, ["discount_total", "discount_amount", "item_discount_amount"]),
      line_total: readValue(item, ["total", "line_total", "net_total"]),
      price: readValue(item, ["sale_price", "price", "unit_price", "product_price"]),
      product_price_total: readValue(item, ["product_price_total"]),
      topping_total: readValue(item, ["topping_total", "topping_line_total", "topping_unit_total"])
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
