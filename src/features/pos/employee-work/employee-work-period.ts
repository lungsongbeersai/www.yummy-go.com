export interface EmployeeWorkPeriod {
  businessDay: string;
  startsAt: string;
  endsAt: string;
  nextBoundaryAt: string;
}

const DAY_MS = 24 * 60 * 60 * 1_000;
const MAX_TIMEOUT_MS = 2_147_483_647;
const vientianeParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Vientiane",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
});

function instant(value: string): number {
  // A zone-less server timestamp would silently adopt the employee's device zone.
  const milliseconds = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? Date.parse(value) : NaN;
  if (!Number.isFinite(milliseconds)) throw new RangeError("Invalid employee-work instant");
  return milliseconds;
}

/** This panel's 05:00 day is independent of the legacy POS/report cutoffs. */
export function employeeWorkPeriod(now: Date): EmployeeWorkPeriod {
  if (!Number.isFinite(now.getTime())) throw new RangeError("Invalid employee-work date");
  const parts = Object.fromEntries(vientianeParts.formatToParts(now).map(part => [part.type, part.value]));
  const day = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
  if (Number(parts.hour) < 5) day.setUTCDate(day.getUTCDate() - 1);
  const businessDay = day.toISOString().slice(0, 10);
  const startsAt = new Date(`${businessDay}T05:00:00+07:00`).toISOString();
  const endsAt = new Date(Date.parse(startsAt) + DAY_MS).toISOString();
  return { businessDay, startsAt, endsAt, nextBoundaryAt: endsAt };
}

/** Advance from the server sample instead of trusting the device's wall-clock date. */
export function employeeWorkClock(serverNow: string, receivedAtMs: number, nowMs = Date.now()): Date {
  if (!Number.isFinite(receivedAtMs) || !Number.isFinite(nowMs)) {
    throw new RangeError("Invalid employee-work clock sample");
  }
  // A backwards device-clock adjustment cannot move a sampled server clock backwards.
  const corrected = new Date(instant(serverNow) + Math.max(0, nowMs - receivedAtMs));
  if (!Number.isFinite(corrected.getTime())) throw new RangeError("Invalid employee-work clock sample");
  return corrected;
}

export function employeeWorkBoundaryDelay(
  nextBoundaryAt: string,
  serverNow: string,
  receivedAtMs: number,
  nowMs = Date.now(),
): number {
  const remaining = instant(nextBoundaryAt) - employeeWorkClock(serverNow, receivedAtMs, nowMs).getTime();
  return Math.max(1, Math.min(MAX_TIMEOUT_MS, Math.ceil(remaining)));
}
