import { beforeEach, expect, it, vi } from "vitest";
import { getOrderAuditReport, type OrderAuditResponse } from "@/services/report";
import { resetSessionStores } from "@/stores/session-store-registry";
import { useOrderAuditReportStore } from "./order-audit";

vi.mock("@/services/report", () => ({ getOrderAuditReport: vi.fn() }));
const params = { branch_uuid_fk: "branch-a", date_from: "2026-09-01", date_to: "2026-09-07", page: 1, limit: 20 };
const report = (branch: string): OrderAuditResponse => ({
  rows: [], filters: { ...params, branch_uuid_fk: branch },
  pagination: { page: 1, limit: 20, total: 0, total_pages: 1, snapshot_id: "0" },
  summary: { event_count: 0, bill_count: 0, discount_count: 0 }, time_zone: "Asia/Vientiane",
});
beforeEach(() => { useOrderAuditReportStore.getState().reset(); vi.mocked(getOrderAuditReport).mockReset(); });

it("clears old branch data on load and prevents slow old responses from replacing the selected branch", async () => {
  let finishOld!: (value: OrderAuditResponse) => void;
  vi.mocked(getOrderAuditReport).mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }));
  const first = useOrderAuditReportStore.getState().load(params);
  vi.mocked(getOrderAuditReport).mockResolvedValueOnce(report("branch-b"));
  await useOrderAuditReportStore.getState().load({ ...params, branch_uuid_fk: "branch-b" });
  finishOld(report("branch-a")); await first;
  expect(useOrderAuditReportStore.getState().report?.filters.branch_uuid_fk).toBe("branch-b");
});

it("clears history on logout and ignores an in-flight response", async () => {
  let finish!: (value: OrderAuditResponse) => void;
  vi.mocked(getOrderAuditReport).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const pending = useOrderAuditReportStore.getState().load(params);
  resetSessionStores(); finish(report("branch-a")); await pending;
  expect(useOrderAuditReportStore.getState().report).toBeNull();
  expect(useOrderAuditReportStore.getState().loading).toBe(false);
});

it("shows failed loads and removes the previous report", async () => {
  vi.mocked(getOrderAuditReport).mockResolvedValueOnce(report("branch-a"));
  await useOrderAuditReportStore.getState().load(params);
  vi.mocked(getOrderAuditReport).mockRejectedValueOnce(new Error("Access denied"));
  await expect(useOrderAuditReportStore.getState().load(params)).rejects.toThrow("Access denied");
  expect(useOrderAuditReportStore.getState().report).toBeNull();
  expect(useOrderAuditReportStore.getState().error).toBe("Access denied");
});
