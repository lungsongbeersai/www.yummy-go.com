import type { DailyStoreClosingReport } from "@/stores/report-store";
import type { DailyClosingReportFilters } from "./daily-closing-report-types";

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
  if (!filters.customTimeRange) return null;
  if (!validTime(filters.timeFrom) || !validTime(filters.timeTo)) return "time";
  // The selected end minute is inclusive, so matching endpoints represent
  // one minute. Overnight ranges must name the following calendar date.
  if (`${filters.dateFrom} ${filters.timeFrom}` > `${filters.dateTo} ${filters.timeTo}`) return "range";
  return null;
}

export function dailyClosingTimeParams(filters: DailyClosingReportFilters) {
  // Omitting both keys preserves the Backend's existing 06:00 business day.
  return filters.customTimeRange ? { time_from: filters.timeFrom, time_to: filters.timeTo } : {};
}

export function dailyClosingFiltersEqual(first: DailyClosingReportFilters, second: DailyClosingReportFilters) {
  return first.branchUuid === second.branchUuid && first.dateFrom === second.dateFrom &&
    first.dateTo === second.dateTo && first.tableUuid === second.tableUuid &&
    first.zoneUuid === second.zoneUuid && first.customTimeRange === second.customTimeRange &&
    (!first.customTimeRange || (first.timeFrom === second.timeFrom && first.timeTo === second.timeTo));
}

function displayDate(date: string) {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;
}

export function dailyClosingPrintPeriod(filters: DailyClosingReportFilters) {
  if (!filters.customTimeRange || dailyClosingFilterError(filters)) return undefined;
  return {
    from: `${displayDate(filters.dateFrom)} ${filters.timeFrom}`,
    to: `${displayDate(filters.dateTo)} ${filters.timeTo}`,
  };
}

export function dailyClosingPeriodDisplay(filters: DailyClosingReportFilters) {
  if (dailyClosingFilterError(filters)) return "";
  const from = displayDate(filters.dateFrom);
  const to = displayDate(filters.dateTo);
  if (filters.customTimeRange) return `${from} ${filters.timeFrom} - ${to} ${filters.timeTo}`;
  return filters.dateFrom === filters.dateTo ? from : `${from} - ${to}`;
}

export function dailyClosingReportItemCount(report: DailyStoreClosingReport) {
  return report.groups.reduce((total, group) => total + group.items.length, 0);
}

export function dailyClosingLabel(value: string, fallback: string) {
  return value.trim() || fallback;
}
