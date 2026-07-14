import type { ApiEntity } from "@/services/shared/types";
import type { DailySalesBillGroup } from "@/stores/report-store";
import type { SummaryCards } from "./daily-sales-report-types";
import {
  firstOptionalNumber,
  firstNumber,
  hasDisplayValue,
  isCancelledRow,
  readValue,
  summaryCardValue,
  textValue,
  toppingLines,
} from "./daily-sales-report-utils";

const DETAIL_STATUS_KEYS = [
  "status_name",
  "status_text",
  "status",
  "status_code",
  "order_status_text",
  "order_it_status_text",
];

export interface DailySalesDetailTotals {
  amount: number | null;
  billCount: number | null;
  discount: number | null;
  quantity: number | null;
  sellingPrice: number | null;
  topping: number | null;
  total: number | null;
}

export interface DailySalesDetailMetrics {
  amount: number | null;
  discount: number | null;
  quantity: number;
  sellingPrice: number | null;
  topping: number | null;
  total: number | null;
}

export type DailySalesDetailAdjustmentKey =
  | "bill-discount"
  | "service-charge"
  | "vat"
  | "total";

export interface DailySalesDetailAdjustment {
  key: DailySalesDetailAdjustmentKey;
  value: number;
}

export interface DailySalesDetailItemModel {
  cancelled: boolean;
  metrics: DailySalesDetailMetrics;
  productLabel: string;
  source: ApiEntity;
}

export interface DailySalesDetailBillModel {
  adjustments: DailySalesDetailAdjustment[];
  cancelled: boolean;
  collapsedMetrics: DailySalesDetailMetrics;
  id: string;
  invoiceNumber: string;
  itemSubtotal: DailySalesDetailMetrics;
  items: DailySalesDetailItemModel[];
  paymentType: string;
  saleDate: string;
  source: DailySalesBillGroup;
  status: string;
  tableName: string;
}

export interface DailySalesDetailReportModel {
  bills: DailySalesDetailBillModel[];
  hasStatus: boolean;
  totals: DailySalesDetailTotals;
}

export function detailItemProductName(row: ApiEntity, fallback = "-") {
  return textValue(
    readValue(row, [
      "product_name",
      "prod_name",
      "prod_name_la",
      "prod_name_eng",
    ]),
    fallback,
  );
}

export function detailItemProductLabel(row: ApiEntity, fallback = "-") {
  const productName = detailItemProductName(row, fallback);
  const toppings = toppingLines(row);
  return toppings.length
    ? `${productName} (${toppings.join("; ")})`
    : productName;
}

export function detailItemQuantity(row: ApiEntity) {
  return firstNumber(
    readValue(row, ["quantity", "qty", "order_qty", "qty_total"]),
  );
}

export function detailItemMoney(row: ApiEntity, keys: string[]) {
  const value = readValue(row, keys);
  return hasDisplayValue(value) ? firstNumber(value) : null;
}

function detailItemSellingPriceTotal(row: ApiEntity) {
  const explicitTotal = detailItemMoney(row, [
    "product_price_total",
    "base_total",
    "base_line_total",
  ]);
  if (explicitTotal !== null) return explicitTotal;

  const unitPrice = detailItemMoney(row, [
    "product_price",
    "sale_price",
    "price",
    "unit_price",
    "base_price",
  ]);
  if (unitPrice !== null) {
    return unitPrice * Math.max(detailItemQuantity(row), 1);
  }

  const amount = detailItemMoney(row, ["amount"]);
  const toppingTotal = detailItemMoney(row, ["topping_total"]);
  if (amount !== null) return Math.max(0, amount - (toppingTotal ?? 0));

  return null;
}

export function detailGroupSellingPriceTotal(group: DailySalesBillGroup) {
  const itemsTotal = group.items.reduce(
    (total, item) => total + (detailItemSellingPriceTotal(item) ?? 0),
    0,
  );
  if (itemsTotal > 0) return itemsTotal;
  if (group.baseTotal > 0 && group.baseTotal !== group.amountTotal) {
    return group.baseTotal;
  }
  if (group.amountTotal >= group.toppingTotal) {
    return group.amountTotal - group.toppingTotal;
  }
  return group.amountTotal;
}

export function detailGroupQuantity(group: DailySalesBillGroup) {
  return group.qtyTotal || group.itemCount;
}

export function detailGroupDiscountTotal(group: DailySalesBillGroup) {
  return group.discountBillAmount + group.itemDiscountAmount;
}

export function detailGroupItemDiscountTotal(group: DailySalesBillGroup) {
  const itemTotal = group.items.reduce(
    (total, item) => total + (detailItemMoney(item, ["discount"]) ?? 0),
    0,
  );
  return itemTotal > 0 ? itemTotal : group.itemDiscountAmount;
}

export function detailGroupItemLineTotal(group: DailySalesBillGroup) {
  let hasLineTotal = false;
  const itemTotal = group.items.reduce((total, item) => {
    const lineTotal = detailItemMoney(item, [
      "total",
      "line_total",
      "net_total",
    ]);
    if (lineTotal === null) return total;
    hasLineTotal = true;
    return total + lineTotal;
  }, 0);

  if (hasLineTotal) return itemTotal;
  return Math.max(0, group.amountTotal - detailGroupItemDiscountTotal(group));
}

export function detailHasStatusData(groups: DailySalesBillGroup[]) {
  return groups.some((group) =>
    group.items.some((item) =>
      hasDisplayValue(readValue(item, DETAIL_STATUS_KEYS)),
    ),
  );
}

export function buildDailySalesDetailBillModel(
  group: DailySalesBillGroup,
): DailySalesDetailBillModel {
  return {
    adjustments: [
      { key: "bill-discount", value: group.discountBillAmount },
      { key: "service-charge", value: group.serviceChargeAmount },
      { key: "vat", value: group.vatAmount },
      { key: "total", value: group.lineTotal },
    ],
    cancelled: group.cancelled,
    collapsedMetrics: {
      amount: group.amountTotal,
      discount: detailGroupDiscountTotal(group),
      quantity: detailGroupQuantity(group),
      sellingPrice: detailGroupSellingPriceTotal(group),
      topping: group.toppingTotal,
      total: group.lineTotal,
    },
    id: group.id,
    invoiceNumber: group.invoiceNumber,
    itemSubtotal: {
      amount: group.amountTotal,
      discount: detailGroupItemDiscountTotal(group),
      quantity: detailGroupQuantity(group),
      sellingPrice: detailGroupSellingPriceTotal(group),
      topping: group.toppingTotal,
      total: detailGroupItemLineTotal(group),
    },
    items: group.items.map((item, index) => ({
      cancelled: isCancelledRow(item),
      metrics: {
        amount: detailItemMoney(item, ["amount"]),
        discount: detailItemMoney(item, ["discount"]),
        quantity: detailItemQuantity(item),
        sellingPrice: detailItemMoney(item, ["sale_price"]),
        topping: detailItemMoney(item, ["topping_total"]),
        total: detailItemMoney(item, ["total"]),
      },
      productLabel: detailItemProductLabel(
        item,
        `${group.invoiceNumber}-${index + 1}`,
      ),
      source: item,
    })),
    paymentType: group.paymentType,
    saleDate: group.saleDate,
    source: group,
    status: group.status,
    tableName: group.tableName,
  };
}

export function buildDailySalesDetailReportModel(
  groups: DailySalesBillGroup[],
  summaryCards: SummaryCards,
  reportTotal: ApiEntity,
): DailySalesDetailReportModel {
  return {
    bills: groups.map(buildDailySalesDetailBillModel),
    hasStatus: detailHasStatusData(groups),
    totals: detailReportTotals(summaryCards, reportTotal),
  };
}

export function detailReportTotals(
  summaryCards: SummaryCards,
  reportTotal: ApiEntity,
): DailySalesDetailTotals {
  const metric = (keys: string[]) =>
    firstOptionalNumber(summaryCardValue(summaryCards, reportTotal, keys));

  return {
    amount: metric(["amount"]),
    billCount: metric(["bill_count", "bills_count", "total_bills"]),
    discount: metric(["sum_discount", "discount_bill", "discount_item"]),
    quantity: metric(["total_qty"]),
    sellingPrice: metric([
      "product_price_total",
      "selling_price_total",
      "sale_price_total",
    ]),
    topping: metric([
      "topping_total",
      "total_topping_price",
      "sum_topping",
    ]),
    total: metric(["sum_total", "grand_total", "net_total"]),
  };
}
