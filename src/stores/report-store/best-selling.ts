"use client";

import { DEFAULT_PAGE_LIMIT } from "@/lib/pagination";
import {
  getBestSellingProductsReport,
  type BestSellingProductsReportResponse,
  type FetchBestSellingProductsReportParams
} from "@/services/report";
import type { ApiEntity } from "@/services/shared/types";
import { registerSessionStoreReset } from "@/stores/session-store-registry";
import { createReportStore, defaultReportPagination, finalizeReportPagination } from "./create-report-store";
import {
  loadBestSellingProductsReportExportData,
  type BestSellingProductsReportExportData,
  type BestSellingProductsReportExportParams
} from "./export-loaders";
import {
  mergeBestSellingProductGroups,
  normalizeBestSellingProductsReportResponse,
  type BestSellingProductGroup,
  type BestSellingProductItem,
  type BestSellingProductsPagination,
  type BestSellingProductsReportData
} from "./best-selling-normalizers";

interface BestSellingProductsReportFields {
  filters: ApiEntity;
  groups: BestSellingProductGroup[];
  limit: FetchBestSellingProductsReportParams["limit"];
  loadExportData: (params: BestSellingProductsReportExportParams) => Promise<BestSellingProductsReportExportData>;
  page: number;
  pagination: BestSellingProductsPagination;
  rows: BestSellingProductItem[];
  summary: ApiEntity;
  total: number;
  totalPages: number;
}

const emptyState: BestSellingProductsReportFields = {
  filters: {},
  groups: [],
  limit: DEFAULT_PAGE_LIMIT,
  loadExportData: loadBestSellingProductsReportExportData,
  page: 1,
  pagination: defaultReportPagination(),
  rows: [],
  summary: {},
  total: 0,
  totalPages: 1
};

export const useBestSellingProductsReportStore = createReportStore<
  FetchBestSellingProductsReportParams,
  BestSellingProductsReportResponse,
  BestSellingProductsReportData,
  BestSellingProductsReportFields
>({
  key: "bestSellingProducts",
  fetch: getBestSellingProductsReport,
  normalize: (response, params) => normalizeBestSellingProductsReportResponse(response, params.limit, params.page),
  getTotalPages: (normalized) => normalized.pagination.totalPages,
  mergePage: (accumulated, next) => ({ ...accumulated, groups: [...accumulated.groups, ...next.groups] }),
  finalize: (merged, response, params, loadAll) => {
    const groups = loadAll ? mergeBestSellingProductGroups(merged.groups) : merged.groups;
    const rows = groups.flatMap((group) => group.items).sort((left, right) => left.rank - right.rank);
    const pagination = finalizeReportPagination(merged.pagination, params.limit, loadAll, rows.length);
    return {
      filters: merged.filters,
      groups,
      limit: params.limit,
      page: pagination.page,
      pagination,
      rows,
      summary: merged.summary,
      total: pagination.total,
      totalPages: pagination.totalPages
    };
  },
  emptyState
});

registerSessionStoreReset("best-selling-products-report", () => useBestSellingProductsReportStore.getState().reset());
