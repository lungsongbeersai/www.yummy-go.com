export type DailySalesPaymentMethod =
  | "all"
  | "cash"
  | "transfer"
  | "debt"
  | "mixed";

export const DAILY_SALES_BILL_PAYMENT_METHOD_OPTIONS = [
  "All",
  "1",
  "2",
  "4",
] as const;
export type DailySalesBillPaymentMethod =
  (typeof DAILY_SALES_BILL_PAYMENT_METHOD_OPTIONS)[number];

export const PAYMENT_METHOD_REPORT_FILTER_OPTIONS = [
  "all",
  "cash",
  "transfer",
  "debt",
] as const;
export type PaymentMethodReportFilter =
  (typeof PAYMENT_METHOD_REPORT_FILTER_OPTIONS)[number];

export const BEST_SELLING_PRODUCTS_SORT_OPTIONS = [
  "qty",
  "total",
  "date_asc",
  "date_desc",
] as const;
export type BestSellingProductsSortBy =
  (typeof BEST_SELLING_PRODUCTS_SORT_OPTIONS)[number];

export function isBestSellingProductsSortBy(
  value: unknown,
): value is BestSellingProductsSortBy {
  return (
    typeof value === "string" &&
    BEST_SELLING_PRODUCTS_SORT_OPTIONS.includes(
      value as BestSellingProductsSortBy,
    )
  );
}

export function isPaymentMethodReportFilter(
  value: unknown,
): value is PaymentMethodReportFilter {
  return (
    typeof value === "string" &&
    PAYMENT_METHOD_REPORT_FILTER_OPTIONS.includes(
      value as PaymentMethodReportFilter,
    )
  );
}
