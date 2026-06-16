import { pageLimitNumber } from "@/lib/pagination";
import type { CategorySalesReportResponse } from "@/services/report";
import type { ApiEntity, PageLimit } from "@/services/shared/types";

export interface CategorySalesRow {
  amount: number;
  billCount: number;
  cateName: string;
  cateUuid: string;
  discountBill: number;
  discountTotal: number;
  groupName: string;
  groupUuid: string;
  itemDiscount: number;
  itemsCount: number;
  qtyTotal: number;
  rank: number;
  salePercent: number;
  serviceCharge: number;
  sortOrder: number;
  toppingTotal: number;
  total: number;
  vat: number;
}

export interface CategorySalesGroup {
  groupName: string;
  groupUuid: string;
  rows: CategorySalesRow[];
  sortOrder: number;
  summary: ApiEntity;
}

export interface CategorySalesPagination {
  limit: PageLimit;
  page: number;
  total: number;
  totalPages: number;
}

export interface CategorySalesReportNormalized {
  filters: ApiEntity;
  groups: CategorySalesGroup[];
  pagination: CategorySalesPagination;
  reportName: string;
  rows: CategorySalesRow[];
  summary: ApiEntity;
}

const SUMMARY_KEYS = [
  "categories_count",
  "category_bill_count",
  "items_count",
  "qty_total",
  "amount",
  "topping_total",
  "item_discount",
  "discount_bill",
  "discount_total",
  "service_charge",
  "vat",
  "total"
] as const;

function isRecord(value: unknown): value is ApiEntity {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asRecord(value: unknown): ApiEntity {
  return isRecord(value) ? value : {};
}

function asRecords(value: unknown): ApiEntity[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function isPresent(value: unknown) {
  return value !== null && value !== undefined && value !== "";
}

function textValue(value: unknown, fallback = "") {
  return isPresent(value) ? String(value) : fallback;
}

function numberValue(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    if (!isPresent(value)) continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return 0;
}

function readValue(row: ApiEntity, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (isPresent(value)) return value;
  }
  return undefined;
}

function normalizeRow(row: ApiEntity, group: ApiEntity, index: number): CategorySalesRow {
  const groupUuid = textValue(readValue(group, ["group_uuid_fk", "group_uuid"]), "");
  const cateUuid = textValue(readValue(row, ["cate_uuid", "category_uuid"]), "");

  return {
    amount: numberValue(row.amount),
    billCount: numberValue(readValue(row, ["category_bill_count", "bills_count", "bill_count"])),
    cateName: textValue(readValue(row, ["cate_name", "category_name"]), "-"),
    cateUuid,
    discountBill: numberValue(row.discount_bill),
    discountTotal: numberValue(row.discount_total),
    groupName: textValue(readValue(group, ["group_name", "name"]), "-"),
    groupUuid,
    itemDiscount: numberValue(row.item_discount),
    itemsCount: numberValue(row.items_count),
    qtyTotal: numberValue(row.qty_total),
    rank: firstNumber(row.rank, index + 1),
    salePercent: numberValue(row.sale_percent),
    serviceCharge: numberValue(row.service_charge),
    sortOrder: firstNumber(row.sort_order, index + 1),
    toppingTotal: numberValue(row.topping_total),
    total: numberValue(row.total),
    vat: numberValue(row.vat)
  };
}

function normalizeGroup(group: ApiEntity, index: number): CategorySalesGroup {
  const rows = asRecords(group.details)
    .map((row, rowIndex) => normalizeRow(row, group, rowIndex))
    .sort((left, right) => left.sortOrder - right.sortOrder);

  return {
    groupName: textValue(readValue(group, ["group_name", "name"]), "-"),
    groupUuid: textValue(readValue(group, ["group_uuid_fk", "group_uuid"]), ""),
    rows,
    sortOrder: firstNumber(group.sort_order, index + 1),
    summary: asRecord(group.summary)
  };
}

function derivedSummary(groups: CategorySalesGroup[]) {
  return groups.reduce<ApiEntity>(
    (summary, group) => {
      const groupSummary = group.summary;
      for (const key of SUMMARY_KEYS) {
        summary[key] = numberValue(summary[key]) + numberValue(groupSummary[key]);
      }
      return summary;
    },
    {}
  );
}

function totalPages(root: ApiEntity, total: number, limit: PageLimit, page: number) {
  const explicit = firstNumber(root.totalPages, root.total_pages, root.total_page, root.totalPage);
  if (explicit > 0) return Math.max(1, explicit);
  const numericLimit = pageLimitNumber(limit);
  return total > 0 && numericLimit > 0 ? Math.max(1, Math.ceil(total / numericLimit)) : Math.max(1, page);
}

export function normalizeCategorySalesReportResponse(
  response: CategorySalesReportResponse,
  requestedLimit: PageLimit,
  requestedPage: number
): CategorySalesReportNormalized {
  const root = response as ApiEntity;
  const groups = asRecords(root.data)
    .map(normalizeGroup)
    .sort((left, right) => left.sortOrder - right.sortOrder);
  const rows = groups.flatMap((group) => group.rows).sort((left, right) => left.rank - right.rank);
  const total = firstNumber(root.total, rows.length);
  const page = firstNumber(root.page, requestedPage) || requestedPage;
  const limitValue = (root.limit as PageLimit | undefined) ?? requestedLimit;

  return {
    filters: {
      branch_uuid_fk: root.branch_uuid_fk,
      date_from: root.date_from,
      date_to: root.date_to,
      orderBy: root.orderBy,
      payment_method: root.payment_method,
      search: root.search
    },
    groups,
    pagination: {
      limit: limitValue,
      page,
      total,
      totalPages: totalPages(root, total, limitValue, page)
    },
    reportName: textValue(root.report_name, ""),
    rows,
    summary: derivedSummary(groups)
  };
}
