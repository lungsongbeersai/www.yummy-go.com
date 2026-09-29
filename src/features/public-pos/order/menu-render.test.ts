import type { TFunction } from "i18next";
import { describe, expect, it } from "vitest";
import { TableStatus } from "@/config/pos-constants";
import { tableStatusLabel } from "./menu-render";

const t = ((key: string) => key) as unknown as TFunction;

describe("tableStatusLabel", () => {
  it("speaks to the customer: staff-side states read as busy", () => {
    expect(tableStatusLabel(TableStatus.AVAILABLE, t)).toBe("common.free");
    expect(tableStatusLabel(TableStatus.OCCUPIED, t)).toBe("common.busy");
    expect(tableStatusLabel(TableStatus.CASHIER_CREATING_ORDER, t)).toBe("common.busy");
    expect(tableStatusLabel(TableStatus.CALL_STAFF, t)).toBe("common.busy");
    expect(tableStatusLabel(TableStatus.AWAITING_CONFIRM, t)).toBe("pos.cartStatusWaitingConfirm");
    expect(tableStatusLabel(TableStatus.AWAITING_PAYMENT, t)).toBe("pos.tableStatusAwaitingPayment");
  });

  it("never shows a raw status code", () => {
    expect(tableStatusLabel(99, t)).toBe("");
  });
});
