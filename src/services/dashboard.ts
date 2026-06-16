import { apiRequest, ServiceError } from "@/lib/api";
import { toApiLanguage } from "@/lib/language";
import type { ApiEntity } from "@/services/shared/types";

export interface DashboardFilters extends ApiEntity {}
export interface DashboardSelectOption extends ApiEntity { label?: string; value?: string }
export interface DashboardParameterOptions extends ApiEntity {}
export interface DashboardRequestParams extends ApiEntity {
  branch_uuid_fk: string;
  end_date?: string;
  lang?: string;
  start_date?: string;
  top?: string | number;
}
export interface DashboardMainTotal extends ApiEntity {}
export interface DashboardPaymentSummary extends ApiEntity {}
export interface DashboardAccountingItem extends ApiEntity {}
export interface DashboardPaymentLine extends ApiEntity {}
export interface DashboardSalesChannelItem extends ApiEntity {}
export interface DashboardSalesPaymentSection extends ApiEntity {}
export interface DashboardSections extends ApiEntity {}
export interface DashboardInsightProduct extends ApiEntity {}
export interface DashboardInsightChannel extends ApiEntity {}
export interface DashboardInsightCancelled extends ApiEntity {}
export interface DashboardInsights extends ApiEntity {}
export interface DashboardKpis extends ApiEntity {}
export interface DashboardCancellationSummary extends ApiEntity {}
export interface RevenueTrendPoint extends ApiEntity {}
export interface MonthlyDailySalesPoint extends ApiEntity {}
export interface MonthlySalesPieSlice extends ApiEntity {}
export interface OrderChannelChartItem extends ApiEntity {}
export interface DashboardCharts extends ApiEntity {}
export interface DashboardTablesSummary extends ApiEntity {}
export interface DashboardTables extends ApiEntity {}
export interface DashboardProductHighlight extends ApiEntity {}
export interface DashboardProductSummary extends ApiEntity {}
export interface TopSellingProduct extends ApiEntity {}
export interface OrderChannelSummaryItem extends ApiEntity {}
export interface OrderChannelSummary extends ApiEntity {}

export interface ExecutiveDashboardResponse extends ApiEntity {
  status: string;
  message: string;
  data?: ApiEntity;
}

export interface FetchExecutiveDashboardParams extends DashboardRequestParams {}

export function getExecutiveDashboard(params: FetchExecutiveDashboardParams) {
  if (!params.branch_uuid_fk) throw new ServiceError("branch_uuid_fk is required", 400);
  return apiRequest<ExecutiveDashboardResponse>("get", "/api/v1/dashboard/executive", {
    params: {
      ...params,
      lang: toApiLanguage(String(params.lang ?? "la"))
    }
  });
}
