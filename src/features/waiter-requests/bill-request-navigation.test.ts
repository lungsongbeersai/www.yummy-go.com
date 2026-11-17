import { describe, expect, it } from "vitest";
import type { WaiterRequest } from "@/services/waiter-requests";
import { billRequestOrderUrl, getActiveBillRequest, type StaffBillRequestSnapshot } from "./bill-request-navigation";

const request: WaiterRequest = {
  request_uuid: "bill-1", table_uuid: "table-2", branch_uuid: "branch-1",
  request_type: "bill", table_name_la: "ໂຕະ 2 & 3", table_name_eng: "T02 / T03",
  status: 0, items: [], message: "Bill please", created_at: "2026-11-07T05:00:00Z",
};

function snapshot(overrides: Partial<StaffBillRequestSnapshot> = {}): StaffBillRequestSnapshot {
  return {
    staffKey: "branch-1", staffRequests: [request], handling: "",
    staffLoading: false, staffError: null, ...overrides,
  };
}

describe("active bill request lookup", () => {
  it.each([0, 1] as const)("finds an active request with status %s", (status) => {
    const active = { ...request, status };
    expect(getActiveBillRequest("bill-1", "branch-1", snapshot({ staffRequests: [active] }))).toBe(active);
  });

  it("uses the latest row instead of the table or status captured by a toast", () => {
    const latest = { ...request, table_uuid: "table-current", status: 1 as const };
    expect(getActiveBillRequest(request.request_uuid, "branch-1", snapshot({
      staffRequests: [{ ...request, request_uuid: "another-bill" }, latest],
    }))).toBe(latest);
  });

  it("ignores a toast after its request leaves the active list", () => {
    expect(getActiveBillRequest("bill-1", "branch-1", snapshot({ staffRequests: [] }))).toBeNull();
    expect(getActiveBillRequest("unknown", "branch-1", snapshot())).toBeNull();
  });

  it.each([
    { staffKey: "another-branch" },
    { handling: "bill-1" },
    { handling: "another-request" },
    { staffLoading: true },
    { staffError: "Unable to refresh requests" },
  ])("rejects an unavailable branch snapshot: %j", (overrides) => {
    expect(getActiveBillRequest("bill-1", "branch-1", snapshot(overrides))).toBeNull();
  });

  it.each([
    { ...request, branch_uuid: "another-branch" },
    { ...request, status: 2 as const },
    { ...request, request_type: "staff" as const },
    { ...request, request_type: undefined },
    { ...request, table_uuid: " " },
    { ...request, request_uuid: " " },
  ])("rejects a completed, unrelated or incomplete current row: %j", (row) => {
    expect(getActiveBillRequest("bill-1", "branch-1", snapshot({ staffRequests: [row] }))).toBeNull();
  });

  it("rejects blank identifiers even if the snapshot contains an unscoped row", () => {
    expect(getActiveBillRequest(" ", "branch-1", snapshot())).toBeNull();
    expect(getActiveBillRequest("bill-1", " ", snapshot({
      staffKey: " ", staffRequests: [{ ...request, branch_uuid: " " }],
    }))).toBeNull();
  });
});

describe("bill request navigation", () => {
  it("opens the bill's own table with an encoded cart intent and localized name", () => {
    const url = new URL(billRequestOrderUrl(request, "la", "open-1")!, "https://fixture.invalid");
    expect(url.pathname).toBe("/posAll/order");
    expect(url.searchParams.get("table_uuid")).toBe("table-2");
    expect(url.searchParams.get("table_name")).toBe("ໂຕະ 2 & 3");
    expect(url.searchParams.get("bill_request")).toBe("bill-1:open-1");
    expect(url.searchParams.has("print")).toBe(false);
  });
  it("can reopen an accepted request without completing or printing it", () => {
    const first = billRequestOrderUrl({ ...request, status: 1 }, "en", "open-1");
    const next = billRequestOrderUrl({ ...request, status: 1 }, "en", "open-2");
    expect(next).not.toBe(first);
    expect(new URL(next!, "https://fixture.invalid").searchParams.get("table_name")).toBe("T02 / T03");
  });
  it.each([
    { ...request, request_type: "staff" as const },
    { ...request, request_type: undefined },
    { ...request, status: 2 as const },
    { ...request, table_uuid: " " },
    { ...request, request_uuid: "" },
  ])("does not navigate unrelated, completed or incomplete requests", (row) => {
    expect(billRequestOrderUrl(row, "en", "open-1")).toBeNull();
  });
  it("uses the available table name when a translation is missing", () => {
    const url = billRequestOrderUrl({ ...request, table_name_eng: "" }, "en", "open-1");
    expect(new URL(url!, "https://fixture.invalid").searchParams.get("table_name")).toBe(request.table_name_la);
  });
});
