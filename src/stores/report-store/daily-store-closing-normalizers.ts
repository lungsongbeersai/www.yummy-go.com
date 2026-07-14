import type { DailyStoreClosingReportResponse } from "@/services/report";
import type { ApiEntity } from "@/services/shared/types";

export interface DailyStoreClosingLabels {
  cancelAmount: string;
  cancelBill: string;
  cash: string;
  credit: string;
  discountAmount: string;
  grandTotal: string;
  groupTotal: string;
  noGroup: string;
  paymentTotal: string;
  reportName: string;
  serviceCharge: string;
  totalAmount: string;
  totalQty: string;
  transfer: string;
  vat: string;
}

export interface DailyStoreClosingFilters {
  branchUuid: string;
  date: string;
  lang: string;
}

export interface DailyStoreClosingTopping {
  key: string;
  name: string;
  qty: number;
}

export interface DailyStoreClosingItem {
  discountAmount: number;
  key: string;
  productName: string;
  toppings: DailyStoreClosingTopping[];
  totalAmount: number;
  totalQty: number;
  unitPrice: number;
}

export interface DailyStoreClosingGroup {
  discountAmount: number;
  items: DailyStoreClosingItem[];
  key: string;
  name: string;
  totalAmount: number;
  totalQty: number;
}

export interface DailyStoreClosingSummary {
  discountAmount: number;
  grandTotal: number;
  serviceCharge: number;
  totalAmount: number;
  totalQty: number;
  vat: number;
}

export interface DailyStoreClosingPaymentSummary {
  cash: number;
  credit: number;
  paymentTotal: number;
  transfer: number;
}

export interface DailyStoreClosingCancelSummary {
  billCount: number;
  totalAmount: number;
}

export interface DailyStoreClosingReport {
  cancelSummary: DailyStoreClosingCancelSummary;
  filters: DailyStoreClosingFilters;
  groups: DailyStoreClosingGroup[];
  labels: DailyStoreClosingLabels;
  paymentSummary: DailyStoreClosingPaymentSummary;
  summary: DailyStoreClosingSummary;
}

function isRecord(value: unknown): value is ApiEntity {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function record(value: unknown): ApiEntity {
  return isRecord(value) ? value : {};
}

function records(value: unknown): ApiEntity[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function textValue(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeLabels(value: unknown): DailyStoreClosingLabels {
  const labels = record(value);

  return {
    cancelAmount: textValue(labels.cancel_amount),
    cancelBill: textValue(labels.cancel_bill),
    cash: textValue(labels.cash),
    credit: textValue(labels.credit),
    discountAmount: textValue(labels.discount_amount),
    grandTotal: textValue(labels.grand_total),
    groupTotal: textValue(labels.group_total),
    noGroup: textValue(labels.no_group),
    paymentTotal: textValue(labels.payment_total),
    reportName: textValue(labels.report_name),
    serviceCharge: textValue(labels.service_charge),
    totalAmount: textValue(labels.total_amount),
    totalQty: textValue(labels.total_qty),
    transfer: textValue(labels.transfer),
    vat: textValue(labels.vat)
  };
}

function normalizeGroups(value: unknown): DailyStoreClosingGroup[] {
  return records(value).map((group, groupIndex) => {
    const name = textValue(group.group_name);
    const items = records(group.items).map((item, itemIndex) => ({
      discountAmount: numberValue(item.discount_amount),
      key: `group-${groupIndex + 1}-item-${itemIndex + 1}`,
      productName: textValue(item.product_full_name),
      toppings: records(item.toppings).map((topping, toppingIndex) => ({
        key: `group-${groupIndex + 1}-item-${itemIndex + 1}-topping-${toppingIndex + 1}`,
        name: textValue(topping.topping_name),
        qty: numberValue(topping.topping_qty)
      })),
      totalAmount: numberValue(item.total_amount),
      totalQty: numberValue(item.total_qty),
      unitPrice: numberValue(item.unit_price)
    }));

    return {
      discountAmount: numberValue(group.discount_amount),
      items,
      key: `group-${groupIndex + 1}`,
      name,
      totalAmount: numberValue(group.total_amount),
      totalQty: numberValue(group.total_qty)
    };
  });
}

export function normalizeDailyStoreClosingReportResponse(
  response: DailyStoreClosingReportResponse
): DailyStoreClosingReport {
  const root = isRecord(response.data) ? response.data : response;
  const filters = record(root.filters);
  const summary = record(root.summary);
  const paymentSummary = record(root.payment_summary);
  const cancelSummary = record(root.cancel_summary);

  return {
    cancelSummary: {
      billCount: numberValue(cancelSummary.cancel_bill_count),
      totalAmount: numberValue(cancelSummary.cancel_total_amount)
    },
    filters: {
      branchUuid: textValue(filters.branch_uuid_fk),
      date: textValue(filters.date),
      lang: textValue(filters.lang || root.lang)
    },
    groups: normalizeGroups(root.groups),
    labels: normalizeLabels(root.labels),
    paymentSummary: {
      cash: numberValue(paymentSummary.cash),
      credit: numberValue(paymentSummary.credit),
      paymentTotal: numberValue(paymentSummary.payment_total),
      transfer: numberValue(paymentSummary.transfer)
    },
    summary: {
      discountAmount: numberValue(summary.discount_amount),
      grandTotal: numberValue(summary.grand_total),
      serviceCharge: numberValue(summary.sum_servicecharge),
      totalAmount: numberValue(summary.total_amount),
      totalQty: numberValue(summary.total_qty),
      vat: numberValue(summary.sum_vate)
    }
  };
}
