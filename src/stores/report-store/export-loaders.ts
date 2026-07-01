import { PAGE_LIMIT_ALL, PAGE_LIMIT_ALL_BATCH } from "@/lib/pagination";
import {
  getCategorySalesReport,
  getBestSellingProductsReport,
  getDailySalesBillReport,
  getDailySalesOrderReport,
  getDailySalesReport,
  getPaymentMethodsReport,
  type BestSellingProductsReportResponse,
  type CategorySalesReportResponse,
  type FetchCategorySalesReportParams,
  type FetchBestSellingProductsReportParams,
  type DailySalesBillReportResponse,
  type DailySalesReportResponse,
  type FetchDailySalesBillReportParams,
  type DailySalesOrderReportResponse,
  type FetchDailySalesOrderReportParams,
  type FetchDailySalesReportParams,
  type FetchPaymentMethodsReportParams,
  type PaymentMethodsReportResponse
} from "@/services/report";
import type { ApiEntity } from "@/services/shared/types";
import {
  mergeBestSellingProductGroups,
  normalizeBestSellingProductsReportResponse,
  type BestSellingProductGroup,
  type BestSellingProductItem
} from "./best-selling-normalizers";
import {
  normalizeDailySalesReportResponse,
  reportTotalPages,
  type DailySalesBillGroup,
  type SummaryCards
} from "./normalizers";
import {
  normalizeDailySalesBillReportResponse
} from "./daily-sales-bill-normalizers";
import {
  normalizeDailySalesOrderReportResponse
} from "./daily-sales-order-normalizers";
import {
  normalizePaymentMethodsReportResponse,
  type PaymentMethodReportRow,
  type PaymentMethodSummaryCard
} from "./payment-method-normalizers";
import {
  normalizeCategorySalesReportResponse,
  type CategorySalesGroup,
  type CategorySalesRow
} from "./category-sales-normalizers";

export type DailySalesReportExportParams = Omit<FetchDailySalesReportParams, "limit" | "page">;
export type DailySalesBillReportExportParams = Omit<FetchDailySalesBillReportParams, "limit" | "page">;
export type DailySalesOrderReportExportParams = Omit<FetchDailySalesOrderReportParams, "limit" | "page">;
export type BestSellingProductsReportExportParams = Omit<FetchBestSellingProductsReportParams, "limit" | "page">;
export type PaymentMethodsReportExportParams = Omit<FetchPaymentMethodsReportParams, "limit" | "page">;
export type CategorySalesReportExportParams = Omit<FetchCategorySalesReportParams, "limit" | "page">;

export type DailySalesReportFetcher = (
  params: FetchDailySalesReportParams
) => Promise<DailySalesReportResponse>;
export type DailySalesBillReportFetcher = (
  params: FetchDailySalesBillReportParams
) => Promise<DailySalesBillReportResponse>;
export type DailySalesOrderReportFetcher = (
  params: FetchDailySalesOrderReportParams
) => Promise<DailySalesOrderReportResponse>;
export type BestSellingProductsReportFetcher = (
  params: FetchBestSellingProductsReportParams
) => Promise<BestSellingProductsReportResponse>;
export type PaymentMethodsReportFetcher = (
  params: FetchPaymentMethodsReportParams
) => Promise<PaymentMethodsReportResponse>;
export type CategorySalesReportFetcher = (
  params: FetchCategorySalesReportParams
) => Promise<CategorySalesReportResponse>;

export type DailySalesReportExportData = {
  billGroups: DailySalesBillGroup[];
  grandTotalByDate: ApiEntity[];
  reportTotal: ApiEntity;
  rows: ApiEntity[];
  summaryCards: SummaryCards;
};

export type BestSellingProductsReportExportData = {
  groups: BestSellingProductGroup[];
  rows: BestSellingProductItem[];
  summary: ApiEntity;
};

export type PaymentMethodsReportExportData = {
  cards: PaymentMethodSummaryCard[];
  reportName: string;
  reportTotal: ApiEntity;
  rows: PaymentMethodReportRow[];
};

export type CategorySalesReportExportData = {
  groups: CategorySalesGroup[];
  reportName: string;
  rows: CategorySalesRow[];
  summary: ApiEntity;
};

function isRecord(value: unknown): value is ApiEntity {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function dailySalesResponseRoot(response: DailySalesReportResponse) {
  return isRecord(response.data) ? response.data : response;
}

function firstOptionalNumber(...values: unknown[]) {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

export async function loadDailySalesReportExportData(
  params: DailySalesReportExportParams,
  fetchReport: DailySalesReportFetcher = getDailySalesReport
): Promise<DailySalesReportExportData> {
  const requestParams: FetchDailySalesReportParams = {
    ...params,
    limit: PAGE_LIMIT_ALL_BATCH,
    page: 1
  };
  const firstResponse = await fetchReport(requestParams);
  const firstRoot = dailySalesResponseRoot(firstResponse);
  const firstData = normalizeDailySalesReportResponse(firstResponse);
  const totalRows =
    firstOptionalNumber(
      firstRoot.total,
      firstRoot.total_rows,
      firstRoot.count,
      firstRoot.report_count
    ) ?? firstData.rows.length;
  const pageCount = reportTotalPages(firstRoot, totalRows, PAGE_LIMIT_ALL_BATCH, 1);
  const allRows = [...firstData.rows];
  const allBillGroups = [...firstData.billGroups];

  for (let nextPage = 2; nextPage <= pageCount; nextPage += 1) {
    const response = await fetchReport({ ...requestParams, page: nextPage });
    const normalized = normalizeDailySalesReportResponse(response);
    allRows.push(...normalized.rows);
    allBillGroups.push(...normalized.billGroups);
  }

  return {
    ...firstData,
    billGroups: allBillGroups,
    rows: allRows
  };
}

export async function loadDailySalesBillReportExportData(
  params: DailySalesBillReportExportParams,
  fetchReport: DailySalesBillReportFetcher = getDailySalesBillReport
): Promise<DailySalesReportExportData> {
  const requestParams: FetchDailySalesBillReportParams = {
    ...params,
    limit: PAGE_LIMIT_ALL_BATCH,
    page: 1
  };
  const firstResponse = await fetchReport(requestParams);
  const firstData = normalizeDailySalesBillReportResponse(firstResponse, {
    limit: PAGE_LIMIT_ALL_BATCH,
    page: 1
  });
  const allRows = [...firstData.rows];

  for (let nextPage = 2; nextPage <= firstData.pagination.totalPages; nextPage += 1) {
    const response = await fetchReport({ ...requestParams, page: nextPage });
    const normalized = normalizeDailySalesBillReportResponse(response, {
      limit: PAGE_LIMIT_ALL_BATCH,
      page: nextPage
    });
    allRows.push(...normalized.rows);
  }

  return {
    billGroups: [],
    grandTotalByDate: [],
    reportTotal: firstData.summary,
    rows: allRows,
    summaryCards: firstData.summary
  };
}

export async function loadDailySalesOrderReportExportData(
  params: DailySalesOrderReportExportParams,
  fetchReport: DailySalesOrderReportFetcher = getDailySalesOrderReport
): Promise<DailySalesReportExportData> {
  const requestParams: FetchDailySalesOrderReportParams = {
    ...params,
    limit: PAGE_LIMIT_ALL_BATCH,
    page: 1
  };
  const firstResponse = await fetchReport(requestParams);
  const firstData = normalizeDailySalesOrderReportResponse(firstResponse, {
    limit: PAGE_LIMIT_ALL_BATCH,
    page: 1
  });
  const allRows = [...firstData.rows];
  const allBillGroups = [...firstData.billGroups];

  for (let nextPage = 2; nextPage <= firstData.pagination.totalPages; nextPage += 1) {
    const response = await fetchReport({ ...requestParams, page: nextPage });
    const normalized = normalizeDailySalesOrderReportResponse(response, {
      limit: PAGE_LIMIT_ALL_BATCH,
      page: nextPage
    });
    allRows.push(...normalized.rows);
    allBillGroups.push(...normalized.billGroups);
  }

  return {
    billGroups: allBillGroups,
    grandTotalByDate: firstData.grandTotalByDate,
    reportTotal: firstData.reportTotal,
    rows: allRows,
    summaryCards: firstData.summaryCards
  };
}

export async function loadBestSellingProductsReportExportData(
  params: BestSellingProductsReportExportParams,
  fetchReport: BestSellingProductsReportFetcher = getBestSellingProductsReport
): Promise<BestSellingProductsReportExportData> {
  const requestParams: FetchBestSellingProductsReportParams = {
    ...params,
    limit: PAGE_LIMIT_ALL_BATCH,
    page: 1
  };
  const firstResponse = await fetchReport(requestParams);
  const firstData = normalizeBestSellingProductsReportResponse(firstResponse, PAGE_LIMIT_ALL_BATCH, 1);
  const allGroups = [...firstData.groups];

  for (let nextPage = 2; nextPage <= firstData.pagination.totalPages; nextPage += 1) {
    const response = await fetchReport({ ...requestParams, page: nextPage });
    const normalized = normalizeBestSellingProductsReportResponse(
      response,
      PAGE_LIMIT_ALL_BATCH,
      nextPage
    );
    allGroups.push(...normalized.groups);
  }

  const groups = mergeBestSellingProductGroups(allGroups);

  return {
    groups,
    rows: groups.flatMap((group) => group.items).sort((left, right) => left.rank - right.rank),
    summary: firstData.summary
  };
}

export async function loadPaymentMethodsReportExportData(
  params: PaymentMethodsReportExportParams,
  fetchReport: PaymentMethodsReportFetcher = getPaymentMethodsReport
): Promise<PaymentMethodsReportExportData> {
  const requestParams: FetchPaymentMethodsReportParams = {
    ...params,
    limit: PAGE_LIMIT_ALL,
    page: 1
  };
  const firstResponse = await fetchReport(requestParams);
  const firstData = normalizePaymentMethodsReportResponse(firstResponse, PAGE_LIMIT_ALL, 1);

  return {
    cards: firstData.cards,
    reportName: firstData.reportName,
    reportTotal: firstData.reportTotal,
    rows: firstData.rows
  };
}

export async function loadCategorySalesReportExportData(
  params: CategorySalesReportExportParams,
  fetchReport: CategorySalesReportFetcher = getCategorySalesReport
): Promise<CategorySalesReportExportData> {
  const requestParams: FetchCategorySalesReportParams = {
    ...params,
    limit: PAGE_LIMIT_ALL_BATCH,
    page: 1
  };
  const firstResponse = await fetchReport(requestParams);
  const firstData = normalizeCategorySalesReportResponse(firstResponse, PAGE_LIMIT_ALL_BATCH, 1);
  const allGroups = [...firstData.groups];

  for (let nextPage = 2; nextPage <= firstData.pagination.totalPages; nextPage += 1) {
    const response = await fetchReport({ ...requestParams, page: nextPage });
    const normalized = normalizeCategorySalesReportResponse(response, PAGE_LIMIT_ALL_BATCH, nextPage);
    allGroups.push(...normalized.groups);
  }

  const rows = allGroups.flatMap((group) => group.rows).sort((left, right) => left.rank - right.rank);

  return {
    groups: allGroups,
    reportName: firstData.reportName,
    rows,
    summary: firstData.summary
  };
}
