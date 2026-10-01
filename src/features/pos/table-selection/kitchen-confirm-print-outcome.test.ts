import { describe, expect, it } from "vitest";
import { kitchenConfirmPrintOutcome } from "./kitchen-confirm-print-outcome";

describe("kitchenConfirmPrintOutcome", () => {
  it("reports a remote SHARED job as queued while its owner ACK is pending", () => {
    expect(
      kitchenConfirmPrintOutcome({
        successCount: 0,
        failedCount: 0,
        total: 0,
        pending: true,
      }),
    ).toBe("queued");
  });

  it("reports completed Direct printing as successful", () => {
    expect(
      kitchenConfirmPrintOutcome({
        successCount: 2,
        failedCount: 0,
        total: 2,
      }),
    ).toBe("success");
  });

  it("keeps real failures and partial delivery as incomplete", () => {
    expect(
      kitchenConfirmPrintOutcome({
        successCount: 1,
        failedCount: 1,
        total: 2,
      }),
    ).toBe("incomplete");
    expect(
      kitchenConfirmPrintOutcome({
        successCount: 1,
        failedCount: 0,
        total: 2,
      }),
    ).toBe("incomplete");
  });

  it("does not hide an uncertain-delivery message behind the queued state", () => {
    expect(
      kitchenConfirmPrintOutcome({
        successCount: 0,
        failedCount: 0,
        total: 0,
        pending: true,
        errorMessage: "Printer delivery is uncertain",
      }),
    ).toBe("incomplete");
  });
});
