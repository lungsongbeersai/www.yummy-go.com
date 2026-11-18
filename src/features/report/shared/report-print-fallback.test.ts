import { describe, expect, it } from "vitest";
import { canUseReportPrintFallback } from "./report-print-fallback";

function fallback(reason = "no active report printer for this login/device") {
  return {
    print_mode: "browser_print", print_job: null, pending_query: null, reason,
    fallback_print: { mode: "browser_print", role_code: "report", report_key: "daily_sales", reason },
  };
}

describe("report print transport ownership", () => {
  it.each(["report print ops missing", "device_code missing", "no active report printer for this login/device"])("allows native or browser output when the endpoint stopped before queueing: %s", reason => {
    expect(canUseReportPrintFallback(fallback(reason), "daily_sales")).toBe(true);
  });

  it("does not turn queue errors, lost responses or omitted fields into permission to print again", () => {
    for (const value of [null, {}, fallback("connection reset"), fallback("report print failed"), fallback("report queue did not return print job"), { ...fallback(), pending_query: undefined }]) {
      expect(canUseReportPrintFallback(value, "daily_sales")).toBe(false);
    }
  });

  it("blocks every persisted job even if a fallback object claims it is safe", () => {
    const response = fallback();
    response.fallback_print = { ...response.fallback_print, ...{ safe_not_queued: true } };
    for (const queued of [{ print_job: {} }, { print_job: { print_job_uuid: "queued" } }, { pending_query: { print_job_uuid: "queued" } }, { print_jobs: [{ job_status: "failed" }] }]) {
      expect(canUseReportPrintFallback({ ...response, ...queued }, "daily_sales")).toBe(false);
    }
  });

  it("requires a matching report and an actual boolean not-queued flag", () => {
    const response = fallback("new explicit server condition");
    expect(canUseReportPrintFallback({ ...response, fallback_print: { ...response.fallback_print, safe_not_queued: true } }, "daily_sales")).toBe(true);
    expect(canUseReportPrintFallback({ ...response, fallback_print: { ...response.fallback_print, safe_not_queued: "true" } }, "daily_sales")).toBe(false);
    expect(canUseReportPrintFallback(fallback(), "another_report")).toBe(false);
  });
});
