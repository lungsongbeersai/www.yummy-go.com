import type { DailyStoreClosingReport } from "@/stores/report-store";

export function dailyClosingReportItemCount(report: DailyStoreClosingReport) {
  return report.groups.reduce((total, group) => total + group.items.length, 0);
}

export function dailyClosingLabel(value: string, fallback: string) {
  return value.trim() || fallback;
}
