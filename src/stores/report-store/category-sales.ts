"use client";

import { DEFAULT_PAGE_LIMIT } from "@/lib/pagination";
import {
  getCategorySalesReport,
  type CategorySalesReportResponse,
  type FetchCategorySalesReportParams
} from "@/services/report";
import type { ApiEntity } from "@/services/shared/types";
import { registerSessionStoreReset } from "@/stores/session-store-registry";
import { createReportStore, defaultReportPagination, finalizeReportPagination } from "./create-report-store";
import {
  loadCategorySalesReportExportData,
  type CategorySalesReportExportData,
  type CategorySalesReportExportParams
} from "./export-loaders";
import {
  normalizeCategorySalesReportResponse,
  reindexCategorySalesGroups,
  type CategorySalesGroup,
  type CategorySalesPagination,
  type CategorySalesReportNormalized,
  type CategorySalesRow
} from "./category-sales-normalizers";

interface CategorySalesReportFields {
  filters: ApiEntity;
  groups: CategorySalesGroup[];
  limit: FetchCategorySalesReportParams["limit"];
  loadExportData: (params: CategorySalesReportExportParams) => Promise<CategorySalesReportExportData>;
  page: number;
  pagination: CategorySalesPagination;
  reportName: string;
  rows: CategorySalesRow[];
  summary: ApiEntity;
  total: number;
  totalPages: number;
}

const emptyState: CategorySalesReportFields = {
  filters: {},
  groups: [],
  limit: DEFAULT_PAGE_LIMIT,
  loadExportData: loadCategorySalesReportExportData,
  page: 1,
  pagination: defaultReportPagination(),
  reportName: "",
  rows: [],
  summary: {},
  total: 0,
  totalPages: 1
};

export const useCategorySalesReportStore = createReportStore<
  FetchCategorySalesReportParams,
  CategorySalesReportResponse,
  CategorySalesReportNormalized,
  CategorySalesReportFields
>({
  key: "categorySales",
  fetch: getCategorySalesReport,
  normalize: (response, params) => normalizeCategorySalesReportResponse(response, params.limit, params.page),
  getTotalPages: (normalized) => normalized.pagination.totalPages,
  mergePage: (accumulated, next) => ({ ...accumulated, groups: [...accumulated.groups, ...next.groups] }),
  finalize: (merged, response, params, loadAll) => {
    const groups = loadAll ? reindexCategorySalesGroups(merged.groups) : merged.groups;
    const rows = groups.flatMap((group) => group.rows);
    const pagination = finalizeReportPagination(merged.pagination, params.limit, loadAll, groups.length);
    return {
      filters: merged.filters,
      groups,
      limit: params.limit,
      page: pagination.page,
      pagination,
      reportName: merged.reportName,
      rows,
      summary: merged.summary,
      total: pagination.total,
      totalPages: pagination.totalPages
    };
  },
  emptyState
});

registerSessionStoreReset("category-sales-report", () => useCategorySalesReportStore.getState().reset());
