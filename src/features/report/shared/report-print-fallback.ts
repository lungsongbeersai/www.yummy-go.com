const PRE_QUEUE_REASONS = new Set([
  "report print ops missing",
  "device_code missing",
  "no active report printer for this login/device",
]);

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

// The current report endpoint also returns browser_print after queue exceptions.
// Only its confirmed pre-queue responses authorize another print transport.
export function canUseReportPrintFallback(value: unknown, reportKey: string) {
  const response = record(value);
  if (!response || response.print_mode !== "browser_print" || response.print_job !== null || response.pending_query !== null) return false;
  if (response.print_job_uuid || (Array.isArray(response.print_jobs) ? response.print_jobs.length > 0 : response.print_jobs)) return false;
  const fallback = record(response.fallback_print);
  if (!fallback || fallback.mode !== "browser_print" || fallback.role_code !== "report" || fallback.report_key !== reportKey) return false;
  if (fallback.safe_not_queued === true) return true;
  return typeof response.reason === "string" && PRE_QUEUE_REASONS.has(response.reason) && fallback.reason === response.reason;
}
