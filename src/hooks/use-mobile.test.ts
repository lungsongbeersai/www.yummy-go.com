import { describe, expect, it } from "vitest";
import { MOBILE_BREAKPOINT, mobileStateFromWidth } from "@/hooks/use-mobile";

describe("mobileStateFromWidth", () => {
  it("treats widths below the breakpoint as mobile", () => {
    expect(mobileStateFromWidth(MOBILE_BREAKPOINT - 1)).toBe(true);
  });

  it("treats breakpoint and larger widths as desktop", () => {
    expect(mobileStateFromWidth(MOBILE_BREAKPOINT)).toBe(false);
    expect(mobileStateFromWidth(MOBILE_BREAKPOINT + 1)).toBe(false);
  });

  it("keeps the fallback for hidden or invalid viewport widths", () => {
    expect(mobileStateFromWidth(0, false)).toBe(false);
    expect(mobileStateFromWidth(0, true)).toBe(true);
    expect(mobileStateFromWidth(Number.NaN, false)).toBe(false);
    expect(mobileStateFromWidth(Number.POSITIVE_INFINITY, true)).toBe(true);
  });
});
