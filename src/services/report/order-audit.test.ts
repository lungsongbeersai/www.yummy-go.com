import { beforeEach, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/api";
import { getOrderAuditReport } from "./order-audit";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, apiRequest: vi.fn().mockResolvedValue({ rows: [] }) };
});
beforeEach(() => vi.mocked(apiRequest).mockClear());

it("sends branch/date/action and the stable pagination boundary through authenticated HTTP", async () => {
  const params = { branch_uuid_fk: "branch-a", date_from: "2026-09-01", date_to: "2026-09-07",
    page: 2, limit: 20, action: "DISCOUNT", search: " 0011 ", snapshot_id: "9007199254740993", lang: "en" };
  await getOrderAuditReport(params);
  expect(apiRequest).toHaveBeenCalledWith("get", "/api/v1/report_all/order_audit_log", {
    params: { ...params, search: "0011", lang: "eng" },
  });
});

it("does not make an unscoped request", () => {
  expect(() => getOrderAuditReport({ branch_uuid_fk: "", date_from: "2026-09-01", date_to: "2026-09-07", page: 1, limit: 20 })).toThrow();
  expect(apiRequest).not.toHaveBeenCalled();
});
