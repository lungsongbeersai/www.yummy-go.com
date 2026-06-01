"use client";

import { create } from "zustand";
import { DEFAULT_PAGE_LIMIT, PAGE_LIMIT_ALL_BATCH, isAllPageLimit } from "@/lib/pagination";
import { getDailySalesReport, type DailySalesReportResponse, type FetchDailySalesReportParams } from "@/services/report";
import type { ApiEntity, PageLimit } from "@/services/shared/types";
import {
  createDailySalesBillGroups,
  normalizeDailySalesReportResponse,
  reportTotalPages,
  type DailySalesBillGroup,
  type SummaryCards
} from "@/stores/report-store/normalizers";
import { errorMessage } from "@/stores/store-utils";

export { createDailySalesBillGroups, normalizeDailySalesReportResponse };
export type { DailySalesBillGroup };

interface DailySalesReportState {
  billGroups: DailySalesBillGroup[];
  error: string | null;
  limit: PageLimit;
  loading: boolean;
  grandTotalByDate: ApiEntity[];
  page: number;
  reportTotal: ApiEntity;
  response: DailySalesReportResponse | null;
  rows: ApiEntity[];
  summaryCards: SummaryCards;
  total: number;
  totalPages: number;
  load: (params: FetchDailySalesReportParams) => Promise<DailySalesReportResponse>;
  reset: () => void;
}

export const useDailySalesReportStore = create<DailySalesReportState>((set) => ({
  billGroups: [],
  error: null,
  grandTotalByDate: [],
  limit: DEFAULT_PAGE_LIMIT,
  loading: false,
  page: 1,
  reportTotal: {},
  response: null,
  rows: [],
  summaryCards: {},
  total: 0,
  totalPages: 1,
  load: async (params) => {
    set({ error: null, loading: true });
    try {
      const loadAll = isAllPageLimit(params.limit);
      const requestParams = loadAll ? { ...params, limit: PAGE_LIMIT_ALL_BATCH, page: 1 } : params;
      const response = await getDailySalesReport(requestParams);
      const root = (
        response.data && typeof response.data === "object" && !Array.isArray(response.data)
          ? response.data
          : response
      ) as ApiEntity;
      const normalized = normalizeDailySalesReportResponse(response);
      const rows = normalized.rows;
      const total = Number(root.total ?? root.total_rows ?? root.count ?? root.report_count ?? rows.length);
      const allRows = [...rows];
      const allBillGroups = [...normalized.billGroups];

      if (loadAll) {
        const pageCount = reportTotalPages(root, total, PAGE_LIMIT_ALL_BATCH, 1);
        for (let nextPage = 2; nextPage <= pageCount; nextPage += 1) {
          const nextResponse = await getDailySalesReport({ ...requestParams, page: nextPage });
          const nextNormalized = normalizeDailySalesReportResponse(nextResponse);
          allRows.push(...nextNormalized.rows);
          allBillGroups.push(...nextNormalized.billGroups);
        }
      }

      set({
        billGroups: loadAll ? allBillGroups : normalized.billGroups,
        grandTotalByDate: normalized.grandTotalByDate,
        limit: params.limit,
        loading: false,
        page: loadAll ? 1 : params.page,
        reportTotal: normalized.reportTotal,
        response,
        rows: allRows,
        summaryCards: normalized.summaryCards,
        total,
        totalPages: loadAll ? 1 : reportTotalPages(root, total, params.limit, params.page)
      });

      return response;
    } catch (error) {
      set({ error: errorMessage(error), loading: false });
      throw error;
    }
  },
  reset: () =>
    set({
      billGroups: [],
      error: null,
      grandTotalByDate: [],
      limit: DEFAULT_PAGE_LIMIT,
      loading: false,
      page: 1,
      reportTotal: {},
      response: null,
      rows: [],
      summaryCards: {},
      total: 0,
      totalPages: 1
    })
}));
