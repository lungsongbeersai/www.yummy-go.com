// Every date a report shows — on screen, in print and in exports — is numeric day-first:
// 28/09/2026, or 28/09/2026 13:16:54 for a timestamp, whatever the UI language.
// (File names keep ISO dates so they still sort.)

const BUSINESS_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

// Timestamps are shown in the restaurant's own clock, the same zone the order-audit report has
// always used, so a report reads the same on every device.
const BUSINESS_TIME_ZONE = "Asia/Vientiane";

function timestampParts(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${get("day")}/${get("month")}/${get("year")}`,
    time: `${get("hour")}:${get("minute")}:${get("second")}`
  };
}

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

/** 28/09/2026. A bare business date ("2026-09-28") is rebuilt from its digits and never goes
 * through Date, so it cannot slip a day across time zones. Unparseable input is returned as is. */
export function formatReportDate(value: unknown, fallback = "-") {
  const raw = text(value);
  if (!raw) return fallback;
  const businessDate = BUSINESS_DATE.exec(raw);
  if (businessDate) return `${businessDate[3]}/${businessDate[2]}/${businessDate[1]}`;
  return timestampParts(raw)?.date ?? raw;
}

/** 28/09/2026 13:16:54 for a timestamp; a bare business date has no time, so it stays 28/09/2026. */
export function formatReportDateTime(value: unknown, fallback = "-") {
  const raw = text(value);
  if (!raw) return fallback;
  if (BUSINESS_DATE.test(raw)) return formatReportDate(raw, fallback);
  const parts = timestampParts(raw);
  return parts ? `${parts.date} ${parts.time}` : raw;
}

/** "01/09/2026 - 30/09/2026", or a single date when the range is one day. */
export function formatReportDateRange(from: unknown, to: unknown) {
  const start = formatReportDate(from, "");
  const end = formatReportDate(to, "");
  if (!start || !end || start === end) return start || end;
  return `${start} - ${end}`;
}
