import { describe, expect, it } from "vitest";
import {
  LAK_ROUNDING_VERSION,
  normalizeLakRoundingVersion,
  roundLak,
  roundLakForVersion,
  roundLakToUnit
} from "./lak-money";

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

describe("store LAK rounding", () => {
  it("defaults missing or invalid settings to no thousand rounding", () => {
    expect(normalizeLakRoundingVersion(undefined)).toBe(LAK_ROUNDING_VERSION.UNROUNDED);
    expect(normalizeLakRoundingVersion("invalid")).toBe(LAK_ROUNDING_VERSION.UNROUNDED);
    expect(roundLakToUnit(52_965.4)).toBe(52_965);
  });

  it("selects the order snapshot rounding rule", () => {
    expect(roundLakForVersion(1)(52_965)).toBe(52_965);
    expect(roundLakForVersion(2)(52_965)).toBe(53_000);
  });
});
