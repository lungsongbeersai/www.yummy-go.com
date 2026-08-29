import { describe, expect, it } from "vitest";
import { roundLak } from "./lak-money";

describe("roundLak", () => {
  it("rounds to the nearest 1,000 kip", () => {
    expect(roundLak(499)).toBe(0);
    expect(roundLak(500)).toBe(1000);
    expect(roundLak(1499)).toBe(1000);
    expect(roundLak(1500)).toBe(2000);
    expect(roundLak(52965)).toBe(53000);
  });

  it("returns zero for invalid input", () => {
    expect(roundLak(Number.NaN)).toBe(0);
    expect(roundLak(Number.POSITIVE_INFINITY)).toBe(0);
  });
});
