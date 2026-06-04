import type {
  DailySalesPaymentMethod,
  DailySalesReportOrder,
  DailySalesReportType,
} from "@/services/report";
import type { ApiEntity, PageLimit } from "@/services/shared/types";
import type { DailySalesBillGroup } from "@/stores/report-store";

export type ReportPaymentMethodFilter = DailySalesPaymentMethod | "all";

export type ReportFilters = {
  branchUuid: string;
  dateFrom: string;
  dateTo: string;
  limit: PageLimit;
  orderBy: DailySalesReportOrder;
  paymentMethod: ReportPaymentMethodFilter;
  typePage: DailySalesReportType;
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

export type ReportExportData = {
  billGroups: DailySalesBillGroup[];
  grandTotalByDate: ApiEntity[];
  reportTotal: ApiEntity;
  rows: ApiEntity[];
  summaryCards: SummaryCards;
};

export type DetailPaginationBasis = "bills" | "lines";
