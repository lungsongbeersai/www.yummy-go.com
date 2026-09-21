import type { ReportLocationFilters } from "../shared/report-location";

export interface DailyClosingReportFilters extends ReportLocationFilters {
  branchUuid: string;
  dateFrom: string;
  dateTo: string;
}
