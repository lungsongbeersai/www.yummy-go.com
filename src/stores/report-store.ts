"use client";

import { create } from "zustand";
import { DEFAULT_PAGE_LIMIT, PAGE_LIMIT_ALL_BATCH, isAllPageLimit } from "@/lib/pagination";
import {
  getCategorySalesReport,
  getBestSellingProductsReport,
  getDailySaleItems,
  getDailySalesBillReport,
  getDailySalesOrderReport,
  getDailySalesReport,
  getPaymentMethodsReport,
  type BestSellingProductsReportResponse,
  type CategorySalesReportResponse,
  type DailySalesBillReportResponse,
  type DailySalesOrderReportResponse,
  type FetchCategorySalesReportParams,
  type DailySaleItemsResponse,
  type FetchBestSellingProductsReportParams,
  type FetchDailySalesBillReportParams,
  type FetchDailySalesOrderReportParams,
  type FetchDailySaleItemsParams,
  type DailySalesReportResponse,
  type FetchDailySalesReportParams,
  type FetchPaymentMethodsReportParams,
  type PaymentMethodsReportResponse
} from "@/services/report";
import type { ApiEntity, PageLimit } from "@/services/shared/types";
import {
  mergeBestSellingProductGroups,
  normalizeBestSellingProductsReportResponse,
  type BestSellingProductGroup,
  type BestSellingProductItem,
  type BestSellingProductsPagination
} from "@/stores/report-store/best-selling-normalizers";
import {
  createDailySalesBillGroups,
  normalizeDailySalesReportResponse,
  reportTotalPages,
  type DailySalesBillGroup,
  type SummaryCards
} from "@/stores/report-store/normalizers";
import {
  normalizePaymentMethodsReportResponse,
  type PaymentMethodOption,
  type PaymentMethodReportRow,
  type PaymentMethodSummaryCard,
  type PaymentMethodsPagination
} from "@/stores/report-store/payment-method-normalizers";
import {
  normalizeCategorySalesReportResponse,
  type CategorySalesGroup,
  type CategorySalesPagination,
  type CategorySalesRow
} from "@/stores/report-store/category-sales-normalizers";
import {
  normalizeDailySaleItemsResponse,
  type DailySaleItemsBillGroup,
  type DailySaleItemsPagination
} from "@/stores/report-store/daily-sale-items-normalizers";
import {
  normalizeDailySalesBillReportResponse,
  type DailySalesBillReportPagination
} from "@/stores/report-store/daily-sales-bill-normalizers";
import {
  normalizeDailySalesOrderReportResponse,
  type DailySalesOrderReportPagination
} from "@/stores/report-store/daily-sales-order-normalizers";
import { errorMessage } from "@/stores/store-utils";
import {
  loadBestSellingProductsReportExportData,
  loadCategorySalesReportExportData,
  loadDailySalesBillReportExportData,
  loadDailySalesOrderReportExportData,
  loadDailySalesReportExportData,
  loadPaymentMethodsReportExportData,
  type BestSellingProductsReportExportData,
  type BestSellingProductsReportExportParams,
  type CategorySalesReportExportData,
  type CategorySalesReportExportParams,
  type DailySalesBillReportExportParams,
  type DailySalesOrderReportExportParams,
  type DailySalesReportExportData,
  type DailySalesReportExportParams,
  type PaymentMethodsReportExportData,
  type PaymentMethodsReportExportParams
} from "@/stores/report-store/export-loaders";

export { createDailySalesBillGroups, normalizeDailySalesReportResponse };
export { normalizeDailySalesBillReportResponse };
export { normalizeDailySalesOrderReportResponse };
export { mergeBestSellingProductGroups, normalizeBestSellingProductsReportResponse };
export { normalizeDailySaleItemsResponse };
export { normalizePaymentMethodsReportResponse };
export { normalizeCategorySalesReportResponse };
export type { DailySalesBillGroup };
export type { DailySalesBillReportPagination };
export type { DailySalesOrderReportPagination };
export type { DailySaleItemsBillGroup, DailySaleItemsPagination };
export type { BestSellingProductGroup, BestSellingProductItem, BestSellingProductsPagination };
export type { PaymentMethodOption, PaymentMethodReportRow, PaymentMethodSummaryCard, PaymentMethodsPagination };
export type { CategorySalesGroup, CategorySalesPagination, CategorySalesRow };
export type {
  BestSellingProductsReportExportData,
  CategorySalesReportExportData,
  DailySalesBillReportExportParams,
  DailySalesOrderReportExportParams,
  DailySalesReportExportData,
  PaymentMethodsReportExportData
};

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
  loadExportData: (params: DailySalesReportExportParams) => Promise<DailySalesReportExportData>;
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
  loadExportData: loadDailySalesReportExportData,
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

interface DailySalesBillReportState {
  error: string | null;
  filters: ApiEntity;
  limit: PageLimit;
  loading: boolean;
  page: number;
  pagination: DailySalesBillReportPagination;
  response: DailySalesBillReportResponse | null;
  rows: ApiEntity[];
  summary: ApiEntity;
  total: number;
  totalPages: number;
  loadExportData: (params: DailySalesBillReportExportParams) => Promise<DailySalesReportExportData>;
  load: (params: FetchDailySalesBillReportParams) => Promise<DailySalesBillReportResponse>;
  reset: () => void;
}

const defaultDailySalesBillPagination: DailySalesBillReportPagination = {
  limit: DEFAULT_PAGE_LIMIT,
  page: 1,
  total: 0,
  totalPages: 1
};

export const useDailySalesBillReportStore = create<DailySalesBillReportState>((set) => ({
  error: null,
  filters: {},
  limit: DEFAULT_PAGE_LIMIT,
  loading: false,
  page: 1,
  pagination: defaultDailySalesBillPagination,
  response: null,
  rows: [],
  summary: {},
  total: 0,
  totalPages: 1,
  loadExportData: loadDailySalesBillReportExportData,
  load: async (params) => {
    set({ error: null, loading: true });
    try {
      const loadAll = isAllPageLimit(params.limit);
      const requestParams = loadAll ? { ...params, limit: PAGE_LIMIT_ALL_BATCH, page: 1 } : params;
      const response = await getDailySalesBillReport(requestParams);
      const normalized = normalizeDailySalesBillReportResponse(response, requestParams);
      const allRows = [...normalized.rows];

      if (loadAll) {
        for (let nextPage = 2; nextPage <= normalized.pagination.totalPages; nextPage += 1) {
          const nextResponse = await getDailySalesBillReport({ ...requestParams, page: nextPage });
          const nextNormalized = normalizeDailySalesBillReportResponse(nextResponse, {
            ...requestParams,
            page: nextPage
          });
          allRows.push(...nextNormalized.rows);
        }
      }

      const total = loadAll ? allRows.length : normalized.pagination.total;
      const pagination: DailySalesBillReportPagination = {
        ...normalized.pagination,
        limit: params.limit,
        page: loadAll ? 1 : normalized.pagination.page,
        total,
        totalPages: loadAll ? 1 : normalized.pagination.totalPages
      };

      set({
        filters: normalized.filters,
        limit: params.limit,
        loading: false,
        page: pagination.page,
        pagination,
        response,
        rows: allRows,
        summary: normalized.summary,
        total,
        totalPages: pagination.totalPages
      });

      return response;
    } catch (error) {
      set({ error: errorMessage(error), loading: false });
      throw error;
    }
  },
  reset: () =>
    set({
      error: null,
      filters: {},
      limit: DEFAULT_PAGE_LIMIT,
      loading: false,
      page: 1,
      pagination: defaultDailySalesBillPagination,
      response: null,
      rows: [],
      summary: {},
      total: 0,
      totalPages: 1
    })
}));

interface DailySalesOrderReportState {
  billGroups: DailySalesBillGroup[];
  error: string | null;
  filters: ApiEntity;
  grandTotalByDate: ApiEntity[];
  limit: PageLimit;
  loading: boolean;
  page: number;
  pagination: DailySalesOrderReportPagination;
  reportTotal: ApiEntity;
  response: DailySalesOrderReportResponse | null;
  rows: ApiEntity[];
  summaryCards: SummaryCards;
  total: number;
  totalPages: number;
  loadExportData: (params: DailySalesOrderReportExportParams) => Promise<DailySalesReportExportData>;
  load: (params: FetchDailySalesOrderReportParams) => Promise<DailySalesOrderReportResponse>;
  reset: () => void;
}

const defaultDailySalesOrderPagination: DailySalesOrderReportPagination = {
  limit: DEFAULT_PAGE_LIMIT,
  page: 1,
  total: 0,
  totalPages: 1
};

export const useDailySalesOrderReportStore = create<DailySalesOrderReportState>((set) => ({
  billGroups: [],
  error: null,
  filters: {},
  grandTotalByDate: [],
  limit: DEFAULT_PAGE_LIMIT,
  loading: false,
  page: 1,
  pagination: defaultDailySalesOrderPagination,
  reportTotal: {},
  response: null,
  rows: [],
  summaryCards: {},
  total: 0,
  totalPages: 1,
  loadExportData: loadDailySalesOrderReportExportData,
  load: async (params) => {
    set({ error: null, loading: true });
    try {
      const loadAll = isAllPageLimit(params.limit);
      const requestParams = loadAll ? { ...params, limit: PAGE_LIMIT_ALL_BATCH, page: 1 } : params;
      const response = await getDailySalesOrderReport(requestParams);
      const normalized = normalizeDailySalesOrderReportResponse(response, requestParams);
      const allRows = [...normalized.rows];
      const allBillGroups = [...normalized.billGroups];

      if (loadAll) {
        for (let nextPage = 2; nextPage <= normalized.pagination.totalPages; nextPage += 1) {
          const nextResponse = await getDailySalesOrderReport({ ...requestParams, page: nextPage });
          const nextNormalized = normalizeDailySalesOrderReportResponse(nextResponse, {
            ...requestParams,
            page: nextPage
          });
          allRows.push(...nextNormalized.rows);
          allBillGroups.push(...nextNormalized.billGroups);
        }
      }

      const total = loadAll ? allBillGroups.length : normalized.pagination.total;
      const pagination: DailySalesOrderReportPagination = {
        ...normalized.pagination,
        limit: params.limit,
        page: loadAll ? 1 : normalized.pagination.page,
        total,
        totalPages: loadAll ? 1 : normalized.pagination.totalPages
      };

      set({
        billGroups: allBillGroups,
        filters: normalized.filters,
        grandTotalByDate: normalized.grandTotalByDate,
        limit: params.limit,
        loading: false,
        page: pagination.page,
        pagination,
        reportTotal: normalized.reportTotal,
        response,
        rows: allRows,
        summaryCards: normalized.summaryCards,
        total,
        totalPages: pagination.totalPages
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
      filters: {},
      grandTotalByDate: [],
      limit: DEFAULT_PAGE_LIMIT,
      loading: false,
      page: 1,
      pagination: defaultDailySalesOrderPagination,
      reportTotal: {},
      response: null,
      rows: [],
      summaryCards: {},
      total: 0,
      totalPages: 1
    })
}));

interface DailySaleItemsReportState {
  bills: DailySaleItemsBillGroup[];
  error: string | null;
  limit: PageLimit;
  loading: boolean;
  page: number;
  pagination: DailySaleItemsPagination;
  reportTotal: ApiEntity;
  response: DailySaleItemsResponse | null;
  rows: ApiEntity[];
  total: number;
  totalPages: number;
  load: (params: FetchDailySaleItemsParams) => Promise<DailySaleItemsResponse>;
  reset: () => void;
}

const defaultDailySaleItemsPagination: DailySaleItemsPagination = {
  limit: DEFAULT_PAGE_LIMIT,
  page: 1,
  total: 0,
  totalPages: 1
};

export const useDailySaleItemsStore = create<DailySaleItemsReportState>((set) => ({
  bills: [],
  error: null,
  limit: DEFAULT_PAGE_LIMIT,
  loading: false,
  page: 1,
  pagination: defaultDailySaleItemsPagination,
  reportTotal: {},
  response: null,
  rows: [],
  total: 0,
  totalPages: 1,
  load: async (params) => {
    set({ error: null, loading: true });
    try {
      const loadAll = isAllPageLimit(params.limit);
      const requestParams = loadAll ? { ...params, limit: PAGE_LIMIT_ALL_BATCH, page: 1 } : params;
      const response = await getDailySaleItems(requestParams);
      const normalized = normalizeDailySaleItemsResponse(response, requestParams);
      const allBills = [...normalized.bills];

      if (loadAll) {
        for (let nextPage = 2; nextPage <= normalized.pagination.totalPages; nextPage += 1) {
          const nextResponse = await getDailySaleItems({ ...requestParams, page: nextPage });
          const nextNormalized = normalizeDailySaleItemsResponse(nextResponse, { ...requestParams, page: nextPage });
          allBills.push(...nextNormalized.bills);
        }
      }

      const total = loadAll ? allBills.length : normalized.pagination.total;
      const pagination: DailySaleItemsPagination = {
        ...normalized.pagination,
        limit: params.limit,
        page: loadAll ? 1 : normalized.pagination.page,
        total,
        totalPages: loadAll ? 1 : normalized.pagination.totalPages
      };

      set({
        bills: allBills,
        limit: params.limit,
        loading: false,
        page: pagination.page,
        pagination,
        reportTotal: normalized.reportTotal,
        response,
        rows: allBills.flatMap((bill) => bill.items),
        total,
        totalPages: pagination.totalPages
      });

      return response;
    } catch (error) {
      set({ error: errorMessage(error), loading: false });
      throw error;
    }
  },
  reset: () =>
    set({
      bills: [],
      error: null,
      limit: DEFAULT_PAGE_LIMIT,
      loading: false,
      page: 1,
      pagination: defaultDailySaleItemsPagination,
      reportTotal: {},
      response: null,
      rows: [],
      total: 0,
      totalPages: 1
    })
}));

interface BestSellingProductsReportState {
  error: string | null;
  filters: ApiEntity;
  groups: BestSellingProductGroup[];
  limit: PageLimit;
  loading: boolean;
  page: number;
  pagination: BestSellingProductsPagination;
  response: BestSellingProductsReportResponse | null;
  rows: BestSellingProductItem[];
  summary: ApiEntity;
  total: number;
  totalPages: number;
  loadExportData: (
    params: BestSellingProductsReportExportParams
  ) => Promise<BestSellingProductsReportExportData>;
  load: (params: FetchBestSellingProductsReportParams) => Promise<BestSellingProductsReportResponse>;
  reset: () => void;
}

const defaultBestSellingPagination: BestSellingProductsPagination = {
  limit: DEFAULT_PAGE_LIMIT,
  page: 1,
  total: 0,
  totalPages: 1
};

export const useBestSellingProductsReportStore = create<BestSellingProductsReportState>((set) => ({
  error: null,
  filters: {},
  groups: [],
  limit: DEFAULT_PAGE_LIMIT,
  loading: false,
  page: 1,
  pagination: defaultBestSellingPagination,
  response: null,
  rows: [],
  summary: {},
  total: 0,
  totalPages: 1,
  loadExportData: loadBestSellingProductsReportExportData,
  load: async (params) => {
    set({ error: null, loading: true });
    try {
      const loadAll = isAllPageLimit(params.limit);
      const requestParams = loadAll ? { ...params, limit: PAGE_LIMIT_ALL_BATCH, page: 1 } : params;
      const response = await getBestSellingProductsReport(requestParams);
      const normalized = normalizeBestSellingProductsReportResponse(response, requestParams.limit, requestParams.page);
      const allGroups = [...normalized.groups];

      if (loadAll) {
        for (let nextPage = 2; nextPage <= normalized.pagination.totalPages; nextPage += 1) {
          const nextResponse = await getBestSellingProductsReport({ ...requestParams, page: nextPage });
          const nextNormalized = normalizeBestSellingProductsReportResponse(nextResponse, requestParams.limit, nextPage);
          allGroups.push(...nextNormalized.groups);
        }
      }

      const groups = loadAll ? mergeBestSellingProductGroups(allGroups) : normalized.groups;
      const rows = groups.flatMap((group) => group.items).sort((left, right) => left.rank - right.rank);
      const total = loadAll ? rows.length : normalized.pagination.total;
      const pagination: BestSellingProductsPagination = {
        ...normalized.pagination,
        limit: params.limit,
        page: loadAll ? 1 : normalized.pagination.page,
        total,
        totalPages: loadAll ? 1 : normalized.pagination.totalPages
      };

      set({
        filters: normalized.filters,
        groups,
        limit: params.limit,
        loading: false,
        page: pagination.page,
        pagination,
        response,
        rows,
        summary: normalized.summary,
        total,
        totalPages: pagination.totalPages
      });

      return response;
    } catch (error) {
      set({ error: errorMessage(error), loading: false });
      throw error;
    }
  },
  reset: () =>
    set({
      error: null,
      filters: {},
      groups: [],
      limit: DEFAULT_PAGE_LIMIT,
      loading: false,
      page: 1,
      pagination: defaultBestSellingPagination,
      response: null,
      rows: [],
      summary: {},
      total: 0,
      totalPages: 1
    })
}));

interface PaymentMethodsReportState {
  cards: PaymentMethodSummaryCard[];
  error: string | null;
  limit: PageLimit;
  loading: boolean;
  page: number;
  pagination: PaymentMethodsPagination;
  paymentMethods: PaymentMethodOption[];
  reportName: string;
  reportTotal: ApiEntity;
  response: PaymentMethodsReportResponse | null;
  rows: PaymentMethodReportRow[];
  summaryCards: ApiEntity;
  total: number;
  totalPages: number;
  loadExportData: (params: PaymentMethodsReportExportParams) => Promise<PaymentMethodsReportExportData>;
  load: (params: FetchPaymentMethodsReportParams) => Promise<PaymentMethodsReportResponse>;
  reset: () => void;
}

const defaultPaymentMethodsPagination: PaymentMethodsPagination = {
  limit: DEFAULT_PAGE_LIMIT,
  page: 1,
  total: 0,
  totalPages: 1
};

export const usePaymentMethodsReportStore = create<PaymentMethodsReportState>((set) => ({
  cards: [],
  error: null,
  limit: DEFAULT_PAGE_LIMIT,
  loading: false,
  page: 1,
  pagination: defaultPaymentMethodsPagination,
  paymentMethods: [],
  reportName: "",
  reportTotal: {},
  response: null,
  rows: [],
  summaryCards: {},
  total: 0,
  totalPages: 1,
  loadExportData: loadPaymentMethodsReportExportData,
  load: async (params) => {
    set({ error: null, loading: true });
    try {
      const response = await getPaymentMethodsReport(params);
      const normalized = normalizePaymentMethodsReportResponse(response, params.limit, params.page);
      const total = isAllPageLimit(params.limit) ? normalized.rows.length : normalized.pagination.total;
      const pagination: PaymentMethodsPagination = {
        ...normalized.pagination,
        limit: params.limit,
        page: isAllPageLimit(params.limit) ? 1 : normalized.pagination.page,
        total,
        totalPages: isAllPageLimit(params.limit) ? 1 : normalized.pagination.totalPages
      };

      set({
        cards: normalized.cards,
        limit: params.limit,
        loading: false,
        page: pagination.page,
        pagination,
        paymentMethods: normalized.paymentMethods,
        reportName: normalized.reportName,
        reportTotal: normalized.reportTotal,
        response,
        rows: normalized.rows,
        summaryCards: normalized.summaryCards,
        total,
        totalPages: pagination.totalPages
      });

      return response;
    } catch (error) {
      set({ error: errorMessage(error), loading: false });
      throw error;
    }
  },
  reset: () =>
    set({
      cards: [],
      error: null,
      limit: DEFAULT_PAGE_LIMIT,
      loading: false,
      page: 1,
      pagination: defaultPaymentMethodsPagination,
      paymentMethods: [],
      reportName: "",
      reportTotal: {},
      response: null,
      rows: [],
      summaryCards: {},
      total: 0,
      totalPages: 1
    })
}));

interface CategorySalesReportState {
  error: string | null;
  filters: ApiEntity;
  groups: CategorySalesGroup[];
  limit: PageLimit;
  loading: boolean;
  page: number;
  pagination: CategorySalesPagination;
  reportName: string;
  response: CategorySalesReportResponse | null;
  rows: CategorySalesRow[];
  summary: ApiEntity;
  total: number;
  totalPages: number;
  loadExportData: (params: CategorySalesReportExportParams) => Promise<CategorySalesReportExportData>;
  load: (params: FetchCategorySalesReportParams) => Promise<CategorySalesReportResponse>;
  reset: () => void;
}

const defaultCategorySalesPagination: CategorySalesPagination = {
  limit: DEFAULT_PAGE_LIMIT,
  page: 1,
  total: 0,
  totalPages: 1
};

export const useCategorySalesReportStore = create<CategorySalesReportState>((set) => ({
  error: null,
  filters: {},
  groups: [],
  limit: DEFAULT_PAGE_LIMIT,
  loading: false,
  page: 1,
  pagination: defaultCategorySalesPagination,
  reportName: "",
  response: null,
  rows: [],
  summary: {},
  total: 0,
  totalPages: 1,
  loadExportData: loadCategorySalesReportExportData,
  load: async (params) => {
    set({ error: null, loading: true });
    try {
      const loadAll = isAllPageLimit(params.limit);
      const requestParams = loadAll ? { ...params, limit: PAGE_LIMIT_ALL_BATCH, page: 1 } : params;
      const response = await getCategorySalesReport(requestParams);
      const normalized = normalizeCategorySalesReportResponse(response, requestParams.limit, requestParams.page);
      const allGroups = [...normalized.groups];

      if (loadAll) {
        for (let nextPage = 2; nextPage <= normalized.pagination.totalPages; nextPage += 1) {
          const nextResponse = await getCategorySalesReport({ ...requestParams, page: nextPage });
          const nextNormalized = normalizeCategorySalesReportResponse(nextResponse, requestParams.limit, nextPage);
          allGroups.push(...nextNormalized.groups);
        }
      }

      const rows = allGroups.flatMap((group) => group.rows).sort((left, right) => left.rank - right.rank);
      const total = loadAll ? rows.length : normalized.pagination.total;
      const pagination: CategorySalesPagination = {
        ...normalized.pagination,
        limit: params.limit,
        page: loadAll ? 1 : normalized.pagination.page,
        total,
        totalPages: loadAll ? 1 : normalized.pagination.totalPages
      };

      set({
        filters: normalized.filters,
        groups: allGroups,
        limit: params.limit,
        loading: false,
        page: pagination.page,
        pagination,
        reportName: normalized.reportName,
        response,
        rows,
        summary: normalized.summary,
        total,
        totalPages: pagination.totalPages
      });

      return response;
    } catch (error) {
      set({ error: errorMessage(error), loading: false });
      throw error;
    }
  },
  reset: () =>
    set({
      error: null,
      filters: {},
      groups: [],
      limit: DEFAULT_PAGE_LIMIT,
      loading: false,
      page: 1,
      pagination: defaultCategorySalesPagination,
      reportName: "",
      response: null,
      rows: [],
      summary: {},
      total: 0,
      totalPages: 1
    })
}));
