import { describe, expect, it } from "vitest";
import type { WaiterRequest } from "@/services/waiter-requests";
import { billRequestOrderUrl } from "./bill-request-navigation";

const request: WaiterRequest = {
  request_uuid: "bill-1", table_uuid: "table-2", branch_uuid: "branch-1",
  request_type: "bill", table_name_la: "ໂຕະ 2 & 3", table_name_eng: "T02 / T03",
  status: 0, items: [], message: "Bill please", created_at: "2026-11-07T05:00:00Z",
};

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
