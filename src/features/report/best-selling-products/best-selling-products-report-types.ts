import type { BestSellingProductsSortBy } from "@/services/report";
import type { PageLimit } from "@/services/shared/types";
import type { BestSellingProductsReportExportData } from "@/stores/report-store";

export type BestSellingProductsFilters = {
  branchUuid: string;
  dateFrom: string;
  dateTo: string;
  groupUuid: string;
  limit: PageLimit;
  sortBy: BestSellingProductsSortBy;
};

export type BestSellingOption = {
  label: string;
  value: string;
};

export type BestSellingSummaryCardConfig = {
  kind: "money" | "number";
  keys: string[];
  label: string;
};

export type BestSellingMetricKind = "money" | "number";

export type BestSellingMetricConfig = {
  key: string;
  kind: BestSellingMetricKind;
  label: string;
};

export type BestSellingExportAction = "excel" | "pdf" | "print";

export type BestSellingExportData = BestSellingProductsReportExportData;
