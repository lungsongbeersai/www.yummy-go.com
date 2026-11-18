import { describe, expect, it } from "vitest";
import { paymentDialogViewportHeight } from "./payment-dialog-viewport";

describe("payment dialog visible viewport", () => {
  it("fits a short viewport rather than forcing the payment controls below it", () => {
    expect(paymentDialogViewportHeight(240, 844)).toBe("240px");
  });

  it("uses the current window height without the visual viewport API", () => {
    expect(paymentDialogViewportHeight(undefined, 720)).toBe("720px");
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])("ignores a transient invalid visible height %s", value => {
    expect(paymentDialogViewportHeight(value, 844)).toBe("844px");
  });

  it("rounds down to keep the bottom edge within the visible area", () => {
    expect(paymentDialogViewportHeight(379.9, 844)).toBe("379px");
  });

  it("keeps a CSS viewport fallback when neither measurement is available", () => {
    expect(paymentDialogViewportHeight(0, 0)).toBe("100vh");
  });
});
