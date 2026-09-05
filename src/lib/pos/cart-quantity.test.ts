import { describe, expect, it } from "vitest";
import {
  appendCartQuantityDigit,
  checkCartQuantity,
  promotionQuantity,
} from "./cart-quantity";

describe("promotionQuantity", () => {
  it("has no promotion step when buy/free quantities are absent", () => {
    expect(promotionQuantity(null)).toEqual({
      hasPromotion: false,
      saleQty: 0,
      freeQty: 0,
      qtyStep: 1,
      totalReceiveQty: null,
    });
  });

  it("steps by the catalog buy quantity for a not-yet-in-cart detail", () => {
    expect(promotionQuantity({ proDetailCusQtyBuy: 3, proDetailCusQtyFree: 2 }, 6)).toEqual({
      hasPromotion: true,
      saleQty: 3,
      freeQty: 2,
      qtyStep: 3,
      totalReceiveQty: 6,
    });
  });

  it("steps by the server-resolved sale_qty for an existing cart line", () => {
    expect(promotionQuantity({ sale_qty: 3, free_qty: 2, total_receive_qty: 10 }, 6)).toEqual({
      hasPromotion: true,
      saleQty: 3,
      freeQty: 2,
      qtyStep: 3,
      totalReceiveQty: 10,
    });
  });
});

describe("checkCartQuantity", () => {
  it("accepts any positive integer up to max when there is no promotion step", () => {
    expect(checkCartQuantity("5", 1, 99)).toEqual({ value: 5, error: null });
  });

  it("rejects non-numeric or non-positive input", () => {
    expect(checkCartQuantity("", 1, 99)).toEqual({ value: null, error: "invalid" });
    expect(checkCartQuantity("abc", 1, 99)).toEqual({ value: null, error: "invalid" });
    expect(checkCartQuantity("0", 1, 99)).toEqual({ value: null, error: "invalid" });
    expect(checkCartQuantity("-3", 1, 99)).toEqual({ value: null, error: "invalid" });
    expect(checkCartQuantity("2.5", 1, 99)).toEqual({ value: null, error: "invalid" });
  });

  it("rejects values above the max", () => {
    expect(checkCartQuantity("100", 1, 99)).toEqual({ value: null, error: "max" });
  });

  it("accepts only whole multiples of the promotion step (buy 3 get 2 free)", () => {
    expect(checkCartQuantity("3", 3, 99)).toEqual({ value: 3, error: null });
    expect(checkCartQuantity("6", 3, 99)).toEqual({ value: 6, error: null });
    expect(checkCartQuantity("9", 3, 99)).toEqual({ value: 9, error: null });
  });

  it("rejects quantities that don't align to the promotion step", () => {
    expect(checkCartQuantity("4", 3, 99)).toEqual({ value: null, error: "step" });
    expect(checkCartQuantity("2", 3, 99)).toEqual({ value: null, error: "step" });
  });
});

describe("appendCartQuantityDigit", () => {
  it("appends digits and strips a leading zero", () => {
    expect(appendCartQuantityDigit("", "3")).toBe("3");
    expect(appendCartQuantityDigit("3", "6")).toBe("36");
    expect(appendCartQuantityDigit("0", "5")).toBe("5");
  });

  it("clears to empty and deletes the last digit", () => {
    expect(appendCartQuantityDigit("36", "clear")).toBe("");
    expect(appendCartQuantityDigit("36", "delete")).toBe("3");
    expect(appendCartQuantityDigit("", "delete")).toBe("");
  });

  it("keeps appending past max instead of silently swallowing the keystroke", () => {
    // checkCartQuantity is what flags this as an error for the caller to
    // show a warning — appendCartQuantityDigit no longer decides that itself.
    // A silent block here left the keypad looking dead whenever the dialog's
    // pre-filled default already sat at max (e.g. cancelling all 4 of 4).
    expect(appendCartQuantityDigit("9", "9")).toBe("99");
    expect(appendCartQuantityDigit("99", "9")).toBe("999");
  });
});
