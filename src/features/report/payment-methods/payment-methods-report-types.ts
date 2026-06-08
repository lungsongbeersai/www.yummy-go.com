import type { PaymentMethodReportFilter, PaymentMethodReportOrder } from "@/services/report";
import type { PageLimit } from "@/services/shared/types";
import type {
  PaymentMethodReportRow,
  PaymentMethodSummaryCard,
  PaymentMethodsReportExportData
} from "@/stores/report-store";

export type PaymentMethodsReportFilters = {
  branchUuid: string;
  dateFrom: string;
  dateTo: string;
  limit: PageLimit;
  orderBy: PaymentMethodReportOrder;
  paymentMethod: PaymentMethodReportFilter;
};

export type PaymentMethodsOption = {
  label: string;
  value: string;
};

export type PaymentMethodsMetricKind = "money" | "number";

export type PaymentMethodsMetricConfig = {
  key: string;
  kind: PaymentMethodsMetricKind;
  label: string;
};

export type PaymentMethodsRowMetricConfig = PaymentMethodsMetricConfig & {
  field: keyof PaymentMethodReportRow;
};

export type PaymentMethodsSummaryCard = PaymentMethodSummaryCard;

export type PaymentMethodsExportAction = "excel" | "pdf" | "print";

export type PaymentMethodsExportData = PaymentMethodsReportExportData;
