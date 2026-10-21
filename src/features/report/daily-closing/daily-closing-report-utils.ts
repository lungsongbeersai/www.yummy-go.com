import type { DailyStoreClosingReport } from "@/stores/report-store";
import { REPORT_LOCATION_ALL } from "../shared/report-location";
import type { DailyClosingReportFilters } from "./daily-closing-report-types";

export function initialDailyClosingFilters(branchUuid: string, now = new Date()): DailyClosingReportFilters {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Vientiane", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  const today = `${part("year")}-${part("month")}-${part("day")}`;
  return {
    branchUuid, dateFrom: today, timeFrom: "00:00", dateTo: today, timeTo: "23:59",
    tableUuid: "all", zoneUuid: "all",
  };
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return year >= 1970 && date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function validTime(value: string) {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function dailyClosingFilterError(filters: DailyClosingReportFilters): "date" | "time" | "range" | null {
  if (!validDate(filters.dateFrom) || !validDate(filters.dateTo) || filters.dateFrom > filters.dateTo) return "date";
  if (!validTime(filters.timeFrom) || !validTime(filters.timeTo)) return "time";
  // The selected end minute is inclusive, so matching endpoints represent
  // one minute. Overnight ranges must name the following calendar date.
  if (`${filters.dateFrom} ${filters.timeFrom}` > `${filters.dateTo} ${filters.timeTo}`) return "range";
  return null;
}

export function dailyClosingTimeParams(filters: DailyClosingReportFilters) {
  return { time_from: filters.timeFrom, time_to: filters.timeTo };
}

export function dailyClosingFiltersEqual(first: DailyClosingReportFilters, second: DailyClosingReportFilters) {
  return first.branchUuid === second.branchUuid && first.dateFrom === second.dateFrom &&
    first.dateTo === second.dateTo && first.tableUuid === second.tableUuid &&
    first.zoneUuid === second.zoneUuid && first.timeFrom === second.timeFrom && first.timeTo === second.timeTo;
}

export function normalizeDailyClosingBranchFilters(
  filters: DailyClosingReportFilters,
  normalizeBranch: (filters: DailyClosingReportFilters) => DailyClosingReportFilters,
): DailyClosingReportFilters {
  const normalized = normalizeBranch(filters);
  if (normalized.branchUuid === filters.branchUuid) return normalized;

  return { ...normalized, zoneUuid: REPORT_LOCATION_ALL, tableUuid: REPORT_LOCATION_ALL };
}

function displayDate(date: string) {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;
}

export function dailyClosingPrintPeriod(filters: DailyClosingReportFilters) {
  if (dailyClosingFilterError(filters)) return undefined;
  return {
    from: `${displayDate(filters.dateFrom)} ${filters.timeFrom}`,
    to: `${displayDate(filters.dateTo)} ${filters.timeTo}`,
  };
}

export function dailyClosingPeriodDisplay(filters: DailyClosingReportFilters) {
  const period = dailyClosingPrintPeriod(filters);
  return period ? `${period.from} - ${period.to}` : "";
}

export function dailyClosingReportItemCount(report: DailyStoreClosingReport) {
  return report.groups.reduce((total, group) => total + group.items.length, 0);
}

export function dailyClosingLabel(value: string, fallback: string) {
  return value.trim() || fallback;
}
