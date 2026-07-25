"use client";

import { DEFAULT_PAGE_LIMIT } from "@/lib/pagination";
import {
  getPaymentMethodsReport,
  type FetchPaymentMethodsReportParams,
  type PaymentMethodsReportResponse
} from "@/services/report";
import type { ApiEntity } from "@/services/shared/types";
import { registerSessionStoreReset } from "@/stores/session-store-registry";
import { createReportStore, defaultReportPagination, finalizeReportPagination } from "./create-report-store";
import {
  loadPaymentMethodsReportExportData,
  type PaymentMethodsReportExportData,
  type PaymentMethodsReportExportParams
} from "./export-loaders";
import {
  normalizePaymentMethodsReportResponse,
  type PaymentMethodOption,
  type PaymentMethodReportRow,
  type PaymentMethodsPagination,
  type PaymentMethodsReportNormalized,
  type PaymentMethodSummaryCard
} from "./payment-method-normalizers";

interface PaymentMethodsReportFields {
  cards: PaymentMethodSummaryCard[];
  limit: FetchPaymentMethodsReportParams["limit"];
  loadExportData: (params: PaymentMethodsReportExportParams) => Promise<PaymentMethodsReportExportData>;
  page: number;
  pagination: PaymentMethodsPagination;
  paymentMethods: PaymentMethodOption[];
  reportName: string;
  reportTotal: ApiEntity;
  rows: PaymentMethodReportRow[];
  summaryCards: ApiEntity;
  total: number;
  totalPages: number;
}

const emptyState: PaymentMethodsReportFields = {
  cards: [],
  limit: DEFAULT_PAGE_LIMIT,
  loadExportData: loadPaymentMethodsReportExportData,
  page: 1,
  pagination: defaultReportPagination(),
  paymentMethods: [],
  reportName: "",
  reportTotal: {},
  rows: [],
  summaryCards: {},
  total: 0,
  totalPages: 1
};

export const usePaymentMethodsReportStore = createReportStore<
  FetchPaymentMethodsReportParams,
  PaymentMethodsReportResponse,
  PaymentMethodsReportNormalized,
  PaymentMethodsReportFields
>({
  key: "paymentMethods",
  fetch: getPaymentMethodsReport,
  normalize: (response, params) => normalizePaymentMethodsReportResponse(response, params.limit, params.page),
  // The payment-methods report never supported the "load all pages" batch walk (pre-existing
  // behavior) — every load is a single fetch regardless of the requested page limit.
  batchAllPages: false,
  finalize: (merged, response, params, loadAll) => {
    const pagination = finalizeReportPagination(merged.pagination, params.limit, loadAll, merged.rows.length);
    return {
      cards: merged.cards,
      limit: params.limit,
      page: pagination.page,
      pagination,
      paymentMethods: merged.paymentMethods,
      reportName: merged.reportName,
      reportTotal: merged.reportTotal,
      rows: merged.rows,
      summaryCards: merged.summaryCards,
      total: pagination.total,
      totalPages: pagination.totalPages
    };
  },
  emptyState
});

registerSessionStoreReset("payment-methods-report", () => usePaymentMethodsReportStore.getState().reset());
