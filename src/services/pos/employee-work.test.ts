import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/api";
import { employeeWorkQuery, getEmployeeWork, getEmployeeWorkReport } from "./employee-work";

vi.mock("@/lib/api", async importOriginal => ({ ...await importOriginal<typeof import("@/lib/api")>(), apiRequest: vi.fn() }));
beforeEach(() => vi.clearAllMocks());

describe("employee responsibility API", () => {
  it("uses only the new authenticated list endpoint and does not send an employee or branch selector", async () => {
    await getEmployeeWork({ scope: "carryover", search: "  Table 4  ", lang: "en", page: 2, limit: 10 });
    expect(apiRequest).toHaveBeenCalledExactlyOnceWith("get", "/api/v1/posAll/my_work", { params: { scope: "carryover", search: "Table 4", lang: "eng", page: 2, limit: 10, kitchen_status: "all", payment_status: "all", business_date: undefined } });
  });

  it("pins the complete report to its selected business day without list pagination", async () => {
    await getEmployeeWorkReport({ business_date: "2026-11-15", scope: "current", kitchen_status: "sent", payment_status: "credit_partial", page: 7, limit: 20 });
    expect(apiRequest).toHaveBeenCalledExactlyOnceWith("get", "/api/v1/posAll/my_work/report", { params: { business_date: "2026-11-15", scope: "current", kitchen_status: "sent", payment_status: "credit_partial", search: "", lang: "la" } });
  });

  it.each([{ page: 0 }, { page: 1.5 }, { limit: 0 }, { limit: 101 }, { search: "x".repeat(121) }])("rejects invalid query %j before sending a request", params => {
    expect(() => employeeWorkQuery(params)).toThrow();
    expect(apiRequest).not.toHaveBeenCalled();
  });
});
