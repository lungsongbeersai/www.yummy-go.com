"use client";

import { PAGE_LIMIT_ALL_BATCH, DEFAULT_PAGE_LIMIT } from "@/lib/pagination";
import { getDailySalesReport, type DailySalesReportResponse, type FetchDailySalesReportParams } from "@/services/report";
import type { ApiEntity } from "@/services/shared/types";
import { registerSessionStoreReset } from "@/stores/session-store-registry";
import { createReportStore } from "./create-report-store";
import { loadDailySalesReportExportData, type DailySalesReportExportData, type DailySalesReportExportParams } from "./export-loaders";
import { normalizeDailySalesReportResponse, reportTotalPages, type DailySalesBillGroup, type SummaryCards } from "./normalizers";

interface DailySalesNormalized {
  billGroups: DailySalesBillGroup[];
  grandTotalByDate: ApiEntity[];
  reportTotal: ApiEntity;
  rows: ApiEntity[];
  summaryCards: SummaryCards;
  // Computed once from the first page's raw response — the API doesn't repeat a stable
  // report-wide total on every page, so later pages must not overwrite it.
  total: number;
}

interface DailySalesReportFields {
  billGroups: DailySalesBillGroup[];
  grandTotalByDate: ApiEntity[];
  limit: FetchDailySalesReportParams["limit"];
  loadExportData: (params: DailySalesReportExportParams) => Promise<DailySalesReportExportData>;
  page: number;
  reportTotal: ApiEntity;
  rows: ApiEntity[];
  summaryCards: SummaryCards;
  total: number;
  totalPages: number;
}

function responseRoot(response: DailySalesReportResponse): ApiEntity {
  return (
    response.data && typeof response.data === "object" && !Array.isArray(response.data) ? response.data : response
  ) as ApiEntity;
}

function normalize(response: DailySalesReportResponse): DailySalesNormalized {
  const base = normalizeDailySalesReportResponse(response);
  const root = responseRoot(response);
  return {
    ...base,
    total: Number(root.total ?? root.total_rows ?? root.count ?? root.report_count ?? base.rows.length)
  };
}

const emptyState: DailySalesReportFields = {
  billGroups: [],
  grandTotalByDate: [],
  limit: DEFAULT_PAGE_LIMIT,
  loadExportData: loadDailySalesReportExportData,
  page: 1,
  reportTotal: {},
  rows: [],
  summaryCards: {},
  total: 0,
  totalPages: 1
};

export const useDailySalesReportStore = createReportStore<
  FetchDailySalesReportParams,
  DailySalesReportResponse,
  DailySalesNormalized,
  DailySalesReportFields
>({
  key: "dailySales",
  fetch: getDailySalesReport,
  normalize,
  getTotalPages: (normalized, response) =>
    reportTotalPages(responseRoot(response), normalized.total, PAGE_LIMIT_ALL_BATCH, 1),
  mergePage: (accumulated, next) => ({
    ...accumulated,
    billGroups: [...accumulated.billGroups, ...next.billGroups],
    rows: [...accumulated.rows, ...next.rows]
  }),
  finalize: (merged, response, params, loadAll) => ({
    billGroups: merged.billGroups,
    grandTotalByDate: merged.grandTotalByDate,
    limit: params.limit,
    page: loadAll ? 1 : params.page,
    reportTotal: merged.reportTotal,
    rows: merged.rows,
    summaryCards: merged.summaryCards,
    total: merged.total,
    totalPages: loadAll ? 1 : reportTotalPages(responseRoot(response), merged.total, params.limit, params.page)
  }),
  emptyState
});

registerSessionStoreReset("daily-sales-report", () => useDailySalesReportStore.getState().reset());
