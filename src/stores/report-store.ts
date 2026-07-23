"use client";

// Thin barrel: the actual store implementations live under ./report-store/*, one file per
// report domain, built on the shared createReportStore/createSimpleReportStore factories
// (see ./report-store/create-report-store.ts). Re-exported here so existing imports of
// "@/stores/report-store" keep working unchanged.

export { useDailySalesReportStore } from "@/stores/report-store/daily-sales";
export { useDailySalesBillReportStore } from "@/stores/report-store/daily-sales-bill";
export { useDailySalesOrderReportStore } from "@/stores/report-store/daily-sales-order";
export { useDailySaleItemsStore } from "@/stores/report-store/daily-sale-items";
export { useBestSellingProductsReportStore } from "@/stores/report-store/best-selling";
export { usePaymentMethodsReportStore } from "@/stores/report-store/payment-methods";
export { useCategorySalesReportStore } from "@/stores/report-store/category-sales";
export { useDailyStoreClosingReportStore } from "@/stores/report-store/daily-store-closing";

export {
  mergeBestSellingProductGroups,
  normalizeBestSellingProductsReportResponse,
  type BestSellingProductGroup,
  type BestSellingProductItem,
  type BestSellingProductsPagination
} from "@/stores/report-store/best-selling-normalizers";
export {
  createDailySalesBillGroups,
  normalizeDailySalesReportResponse,
  type DailySalesBillGroup,
  type SummaryCards
} from "@/stores/report-store/normalizers";
export {
  normalizePaymentMethodsReportResponse,
  type PaymentMethodOption,
  type PaymentMethodReportRow,
  type PaymentMethodSummaryCard,
  type PaymentMethodsPagination
} from "@/stores/report-store/payment-method-normalizers";
export {
  normalizeCategorySalesReportResponse,
  type CategorySalesGroup,
  type CategorySalesPagination,
  type CategorySalesRow
} from "@/stores/report-store/category-sales-normalizers";
export {
  normalizeDailySaleItemsResponse,
  type DailySaleItemsBillGroup,
  type DailySaleItemsPagination
} from "@/stores/report-store/daily-sale-items-normalizers";
export {
  normalizeDailySalesBillReportResponse,
  type DailySalesBillReportPagination
} from "@/stores/report-store/daily-sales-bill-normalizers";
export {
  normalizeDailySalesOrderReportResponse,
  type DailySalesOrderReportPagination
} from "@/stores/report-store/daily-sales-order-normalizers";
export {
  normalizeDailyStoreClosingReportResponse,
  type DailyStoreClosingReport
} from "@/stores/report-store/daily-store-closing-normalizers";
export type {
  BestSellingProductsReportExportData,
  CategorySalesReportExportData,
  DailySalesBillReportExportParams,
  DailySalesOrderReportExportParams,
  DailySalesReportExportData,
  PaymentMethodsReportExportData
} from "@/stores/report-store/export-loaders";
