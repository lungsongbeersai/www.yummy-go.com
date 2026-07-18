import { firstNumberOrZero as firstNumber, isPresent, readValue, textValue as textValueWithDash } from "@/lib/values";
import { pageLimitNumber } from "@/lib/pagination";
import type { CategorySalesReportResponse } from "@/services/report";
import type { ApiEntity, PageLimit } from "@/services/shared/types";

const textValue = (value: unknown, fallback = "") => textValueWithDash(value, fallback);

export interface CategorySalesRow {
  afterDiscountBill: number;
  afterDiscountItem: number;
  billCount: number;
  cateName: string;
  cateUuid: string;
  discountBill: number;
  discountItemAmount: number;
  discountTotal: number;
  groupName: string;
  groupUuid: string;
  grandTotal: number;
  productName: string;
  productPriceTotal: number;
  productUuid: string;
  rank: number;
  serviceCharge: number;
  serviceRate: number;
  sortOrder: number;
  toppingTotal: number;
  total: number;
  totalQty: number;
  vat: number;
  vatRate: number;
}

export interface CategorySalesCategory {
  cateName: string;
  cateUuid: string;
  rows: CategorySalesRow[];
  sortOrder: number;
  summary: ApiEntity;
}

export interface CategorySalesGroup {
  categories: CategorySalesCategory[];
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
  "product_count",
  "bill_count",
  "total_qty",
  "product_price_total",
  "topping_total",
  "total",
  "discount_item_amount",
  "after_discount_item",
  "discount_bill",
  "after_discount_bill",
  "sum_servicecharge",
  "sum_vate",
  "grand_total"
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

function numberValue(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function hasSummaryValues(summary: ApiEntity) {
  return SUMMARY_KEYS.some((key) => isPresent(summary[key]));
}

function mergeSummary(explicitSummary: ApiEntity, fallbackSummary: ApiEntity) {
  if (!hasSummaryValues(explicitSummary)) return fallbackSummary;

  return SUMMARY_KEYS.reduce<ApiEntity>((summary, key) => {
    summary[key] = isPresent(explicitSummary[key])
      ? explicitSummary[key]
      : fallbackSummary[key];
    return summary;
  }, {});
}

function sumSummaries(summaries: ApiEntity[]) {
  return summaries.reduce<ApiEntity>((total, summary) => {
    for (const key of SUMMARY_KEYS) {
      total[key] = numberValue(total[key]) + numberValue(summary[key]);
    }
    return total;
  }, {});
}

function summaryFromRows(rows: CategorySalesRow[]) {
  return rows.reduce<ApiEntity>(
    (summary, row) => {
      summary.product_count = numberValue(summary.product_count) + 1;
      summary.bill_count = numberValue(summary.bill_count) + row.billCount;
      summary.total_qty = numberValue(summary.total_qty) + row.totalQty;
      summary.product_price_total =
        numberValue(summary.product_price_total) + row.productPriceTotal;
      summary.topping_total = numberValue(summary.topping_total) + row.toppingTotal;
      summary.total = numberValue(summary.total) + row.total;
      summary.discount_item_amount =
        numberValue(summary.discount_item_amount) + row.discountItemAmount;
      summary.after_discount_item =
        numberValue(summary.after_discount_item) + row.afterDiscountItem;
      summary.discount_bill = numberValue(summary.discount_bill) + row.discountBill;
      summary.after_discount_bill =
        numberValue(summary.after_discount_bill) + row.afterDiscountBill;
      summary.sum_servicecharge =
        numberValue(summary.sum_servicecharge) + row.serviceCharge;
      summary.sum_vate = numberValue(summary.sum_vate) + row.vat;
      summary.grand_total = numberValue(summary.grand_total) + row.grandTotal;
      return summary;
    },
    {}
  );
}

function normalizeRow(
  item: ApiEntity,
  group: ApiEntity,
  category: ApiEntity,
  rank: number
): CategorySalesRow {
  const discountItemAmount = numberValue(item.discount_item_amount);
  const discountBill = numberValue(item.discount_bill);

  return {
    afterDiscountBill: numberValue(item.after_discount_bill),
    afterDiscountItem: numberValue(item.after_discount_item),
    billCount: numberValue(item.bill_count),
    cateName: textValue(readValue(category, ["cate_name", "category_name"]), "-"),
    cateUuid: textValue(readValue(category, ["cate_uuid", "category_uuid"]), ""),
    discountBill,
    discountItemAmount,
    discountTotal: firstNumber(
      item.discount_total,
      item.sum_discount,
      discountItemAmount + discountBill
    ),
    groupName: textValue(readValue(group, ["group_name", "name"]), "-"),
    groupUuid: textValue(readValue(group, ["group_uuid", "group_uuid_fk"]), ""),
    grandTotal: numberValue(item.grand_total),
    productName: textValue(
      readValue(item, ["product_full_name", "product_name", "prod_name", "name"]),
      "-"
    ),
    productPriceTotal: numberValue(item.product_price_total),
    productUuid: textValue(readValue(item, ["prod_uuid", "product_uuid"]), ""),
    rank,
    serviceCharge: numberValue(item.sum_servicecharge),
    serviceRate: numberValue(item.service_rate),
    sortOrder: rank,
    toppingTotal: numberValue(item.topping_total),
    total: numberValue(item.total),
    totalQty: numberValue(item.total_qty),
    vat: numberValue(item.sum_vate),
    vatRate: numberValue(item.vat_rate)
  };
}

function normalizeCategory(
  category: ApiEntity,
  group: ApiEntity,
  index: number,
  nextRank: () => number
): CategorySalesCategory {
  const rows = asRecords(category.items).map((item) =>
    normalizeRow(item, group, category, nextRank())
  );
  const explicitSummary = asRecord(category.summary);

  return {
    cateName: textValue(readValue(category, ["cate_name", "category_name"]), "-"),
    cateUuid: textValue(readValue(category, ["cate_uuid", "category_uuid"]), ""),
    rows,
    sortOrder: firstNumber(category.sort_order, index + 1),
    summary: mergeSummary(explicitSummary, summaryFromRows(rows))
  };
}

function normalizeGroup(
  group: ApiEntity,
  index: number,
  nextRank: () => number
): CategorySalesGroup {
  const categories = asRecords(group.categories)
    .map((category, categoryIndex) =>
      normalizeCategory(category, group, categoryIndex, nextRank)
    )
    .sort((left, right) => left.sortOrder - right.sortOrder);
  const rows = categories.flatMap((category) => category.rows);

  return {
    categories,
    groupName: textValue(readValue(group, ["group_name", "name"]), "-"),
    groupUuid: textValue(readValue(group, ["group_uuid", "group_uuid_fk"]), ""),
    rows,
    sortOrder: firstNumber(group.sort_order, index + 1),
    summary: sumSummaries(categories.map((category) => category.summary))
  };
}

function reportedTotalPages(root: ApiEntity, pagination: ApiEntity) {
  return firstNumber(
    pagination.totalPages,
    pagination.total_pages,
    pagination.total_page,
    pagination.totalPage,
    root.totalPages,
    root.total_pages,
    root.total_page,
    root.totalPage,
  );
}

function groupPaginationTotal(
  root: ApiEntity,
  pagination: ApiEntity,
  visibleGroups: number,
  limit: PageLimit,
  page: number,
) {
  const explicitGroupTotal = firstNumber(
    pagination.total_groups,
    pagination.group_total,
    pagination.groups_count,
    root.total_groups,
    root.group_total,
    root.groups_count,
  );
  if (explicitGroupTotal > 0) return explicitGroupTotal;

  const nestedTotal = firstNumber(pagination.total);
  if (nestedTotal > 0) return nestedTotal;

  const reportedTotal = firstNumber(root.total);
  const explicitPages = reportedTotalPages(root, pagination);
  const numericLimit = pageLimitNumber(limit);
  if (
    reportedTotal > 0 &&
    (explicitPages <= 0 || Math.ceil(reportedTotal / numericLimit) === explicitPages)
  ) {
    return reportedTotal;
  }

  if (explicitPages <= 1) return visibleGroups;
  if (page >= explicitPages) {
    return (page - 1) * numericLimit + visibleGroups;
  }

  return explicitPages * numericLimit;
}

function totalPages(
  root: ApiEntity,
  pagination: ApiEntity,
  total: number,
  limit: PageLimit,
  page: number,
) {
  const explicit = reportedTotalPages(root, pagination);
  if (explicit > 0) return Math.max(1, explicit);
  const numericLimit = pageLimitNumber(limit);
  return total > 0 && numericLimit > 0 ? Math.max(1, Math.ceil(total / numericLimit)) : Math.max(1, page);
}

export function reindexCategorySalesGroups(groups: CategorySalesGroup[]) {
  let rank = 0;

  return groups.map((group) => {
    const categories = group.categories.map((category) => {
      const rows = category.rows.map((row) => {
        rank += 1;
        return { ...row, rank, sortOrder: rank };
      });
      return { ...category, rows };
    });

    return {
      ...group,
      categories,
      rows: categories.flatMap((category) => category.rows),
    };
  });
}

export function normalizeCategorySalesReportResponse(
  response: CategorySalesReportResponse,
  requestedLimit: PageLimit,
  requestedPage: number
): CategorySalesReportNormalized {
  const root = response as ApiEntity;
  const pagination = asRecord(root.pagination);
  const branch = asRecord(root.branch);
  const filters = asRecord(root.filters);
  const rawGroups = asRecords(root.groups).length
    ? asRecords(root.groups)
    : asRecords(branch.groups);
  let rank = 0;
  const nextRank = () => {
    rank += 1;
    return rank;
  };
  const groups = rawGroups
    .map((group, index) => normalizeGroup(group, index, nextRank))
    .sort((left, right) => left.sortOrder - right.sortOrder);
  const rows = groups.flatMap((group) => group.rows).sort((left, right) => left.rank - right.rank);
  const page = firstNumber(pagination.page, root.page, requestedPage) || requestedPage;
  const limitValue =
    (pagination.limit as PageLimit | undefined) ??
    (root.limit as PageLimit | undefined) ??
    requestedLimit;
  const total = groupPaginationTotal(
    root,
    pagination,
    groups.length,
    limitValue,
    page,
  );

  return {
    filters: {
      ...filters,
      branch_uuid_fk: branch.branch_uuid_fk ?? root.branch_uuid_fk,
      date_from: filters.date_from ?? root.date_from,
      date_to: filters.date_to ?? root.date_to,
      payment_method:
        filters.payment_method !== undefined
          ? filters.payment_method
          : root.payment_method,
      search: filters.search ?? root.search
    },
    groups,
    pagination: {
      limit: limitValue,
      page,
      total,
      totalPages: totalPages(root, pagination, total, limitValue, page)
    },
    reportName: textValue(root.report_name, ""),
    rows,
    summary: asRecord(root.summary)
  };
}
