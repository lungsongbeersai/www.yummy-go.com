import { describe, expect, it } from "vitest";
import { parseProductPrice, readProductPrice } from "./product-price";

describe("explicit nonnegative product prices", () => {
  it.each([[0, 0], ["0", 0], ["0.00", 0], [" 0 ", 0], ["25,000.5", 25000.5], [".5", 0.5], ["12000", 12000]] as const)(
    "accepts %s as %i", (value, expected) => { expect(parseProductPrice(value)).toBe(expected); },
  );
  it.each([null, undefined, "", " ", true, false, [], [0], {}, -1, "-1", "abc0", "2,50", "1.2.3", NaN, Infinity, "Infinity"])(
    "rejects missing or invalid price %s", (value) => { expect(parseProductPrice(value)).toBeNull(); },
  );
  it("preserves an explicit free price instead of taking a paid alias", () => {
    expect(readProductPrice(0, 25000)).toBe(0);
    expect(readProductPrice("0", 25000)).toBe(0);
    expect(readProductPrice(null, "", undefined, "0", 25000)).toBe(0);
    expect(readProductPrice(null, "", 25000)).toBe(25000);
  });
  it("does not hide a corrupt primary price behind a valid fallback", () => {
    expect(readProductPrice(-1, 25000)).toBeNull();
    expect(readProductPrice("invalid", 25000)).toBeNull();
    expect(readProductPrice(null, "")).toBeNull();
  });
});
