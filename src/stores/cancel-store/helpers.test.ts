import { describe, expect, it } from "vitest";
import { normalizeCancelableBillsResponse } from "@/stores/cancel-store/helpers";

describe("cancel store helpers", () => {
  it("normalizes cancelable bill response metadata", () => {
    const normalized = normalizeCancelableBillsResponse(
      {
        status: "success",
        message: "ok",
        data: [{ order_uuid: "o1" }],
        date_options: [{ value: "today" }],
        selected_bill: { order_uuid: "o1" },
        total: 8
      },
      { branch_uuid_fk: "b1", date_select: "today", limit: 4, orderBy: "DESC", page: 1 }
    );

    expect(normalized.bills).toHaveLength(1);
    expect(normalized.dateOptions).toEqual([{ value: "today" }]);
    expect(normalized.selectedBill).toEqual({ order_uuid: "o1" });
    expect(normalized.totalPages).toBe(2);
  });
});
