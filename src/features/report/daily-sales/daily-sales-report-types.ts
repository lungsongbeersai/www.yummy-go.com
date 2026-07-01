import type {
  DailySalesBillPaymentMethod,
  DailySalesPaymentMethod,
  DailySalesReportOrder,
} from "@/services/report";
import type { ApiEntity, PageLimit } from "@/services/shared/types";
import type { DailySalesReportExportData } from "@/stores/report-store";

export type ReportTab = "bill" | "detail";
export type ReportPaymentMethodFilter = DailySalesBillPaymentMethod;
export type DetailReportPaymentMethod = DailySalesPaymentMethod;

export type ReportFilters = {
  branchUuid: string;
  dateFrom: string;
  dateTo: string;
  limit: PageLimit;
  orderBy: DailySalesReportOrder;
  paymentMethod: ReportPaymentMethodFilter;
  search: string;
  typePage: ReportTab;
};

export type ReportBranchOption = {
  label: string;
  value: string;
};

export type SummaryCardConfig = {
  label: string;
  kind: "money" | "number";
  keys: string[];
};

export type ReportColumn = {
  align?: "right";
  header: string;
  kind?: "date" | "image" | "money" | "number" | "product" | "status" | "text";
  keys: string[];
  minWidth?: string;
  wide?: boolean;
};

export type SummaryCards = ApiEntity | ApiEntity[];

export type ReportExportAction = "excel" | "pdf" | "print";

export type ReportExportProgress = {
  label: string;
  percent: number;
};

export type ReportExportData = DailySalesReportExportData;

export type DetailPaginationBasis = "bills" | "lines";
