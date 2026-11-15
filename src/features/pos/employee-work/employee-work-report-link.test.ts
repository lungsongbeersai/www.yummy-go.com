import { describe, expect, it } from "vitest";
import { employeeWorkBrowserPdfUrl, employeeWorkReportHref, parseEmployeeWorkReportDestination, type EmployeeWorkReportDestination } from "./employee-work-report-link";

const destination: EmployeeWorkReportDestination = {
  employeeUuid: "10000000-0000-4000-8000-000000000001", branchUuid: "20000000-0000-4000-8000-000000000001",
  businessDate: "2026-11-15", scope: "carryover", kitchenStatus: "partial", paymentStatus: "credit_partial",
  search: "T01 & ອາຫານ", language: "la", laoFont: "phetsarath",
};
const params = () => new URL(employeeWorkReportHref(destination), "https://example.test").searchParams;

describe("employee PDF browser destination", () => {
  it("round-trips the exact employee/branch/day, filters and selected font without report contents or credentials", () => {
    expect(parseEmployeeWorkReportDestination(params())).toEqual(destination);
    expect(Array.from(params().keys())).toEqual(["employee", "branch", "date", "scope", "kitchen", "payment", "search", "lang", "font"]);
    const url = new URL(employeeWorkBrowserPdfUrl("https://example.test", destination));
    expect(url.origin).toBe("https://example.test"); expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("redirect")).toBe(employeeWorkReportHref(destination));
    expect(url.hash).toBe("");
  });

  it.each(["employee", "branch", "date", "scope", "kitchen", "payment", "lang", "font"])("rejects invalid %s instead of silently widening the report", key => {
    const value = params(); value.set(key, "invalid");
    expect(parseEmployeeWorkReportDestination(value)).toBeNull();
    value.delete(key); expect(parseEmployeeWorkReportDestination(value)).toBeNull();
  });

  it.each(["2026-02-30", "2026-13-01", "2026-11-15T05:00:00Z"])("rejects an invalid calendar date %s", date => {
    const value = params(); value.set("date", date); expect(parseEmployeeWorkReportDestination(value)).toBeNull();
  });

  it("rejects duplicate selectors, unknown keys and overlong/control-bearing search", () => {
    for (const alter of [(value: URLSearchParams) => value.append("scope", "current"), (value: URLSearchParams) => value.set("token", "not-accepted"),
      (value: URLSearchParams) => value.set("search", "x".repeat(121)), (value: URLSearchParams) => value.set("search", "a\nb")]) {
      const value = params(); alter(value); expect(parseEmployeeWorkReportDestination(value)).toBeNull();
    }
  });

  it.each(["javascript:alert(1)", "data:text/html,content", "https://name:secret@example.test", "http://example.test"])("does not hand off to an unsafe origin %s", origin => {
    expect(() => employeeWorkBrowserPdfUrl(origin, destination)).toThrow();
  });
});
