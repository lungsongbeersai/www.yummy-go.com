import type { CategorySalesReportOrder, PaymentMethodReportFilter } from "@/services/report";
import type { PageLimit } from "@/services/shared/types";
import type { CategorySalesReportExportData, CategorySalesRow } from "@/stores/report-store";

export type CategorySalesReportFilters = {
  branchUuid: string;
  dateFrom: string;
  dateTo: string;
  limit: PageLimit;
  orderBy: CategorySalesReportOrder;
  paymentMethod: PaymentMethodReportFilter;
};

export type CategorySalesOption = {
  label: string;
  value: string;
};

export type CategorySalesMetricKind = "money" | "number" | "percent";

export type CategorySalesRowMetricConfig = {
  field: keyof CategorySalesRow;
  key: string;
  kind: CategorySalesMetricKind;
  label: string;
};

export type CategorySalesExportAction = "excel" | "pdf" | "print";

export type CategorySalesExportData = CategorySalesReportExportData;
