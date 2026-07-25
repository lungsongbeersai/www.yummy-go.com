import { describe, expect, it } from "vitest";
import { booleanFlag, numberValue, text } from "@/services/shared/normalize";

describe("shared normalize helpers", () => {
  it("trims text and falls back when empty", () => {
    expect(text("  hello ")).toBe("hello");
    expect(text("   ", "fallback")).toBe("fallback");
    expect(text(null)).toBe("");
    expect(text(undefined, "x")).toBe("x");
    expect(text(42)).toBe("42");
  });

  it("coerces numbers and falls back on non-finite input", () => {
    expect(numberValue("7")).toBe(7);
    expect(numberValue(3)).toBe(3);
    expect(numberValue("abc")).toBe(0);
    expect(numberValue(undefined, 5)).toBe(5);
    expect(numberValue(Infinity, 9)).toBe(9);
  });

  it("reads boolean flags from mixed API representations", () => {
    expect(booleanFlag(true)).toBe(true);
    expect(booleanFlag(1)).toBe(true);
    expect(booleanFlag("1")).toBe(true);
    expect(booleanFlag("  TRUE ")).toBe(true);
    expect(booleanFlag("0")).toBe(false);
    expect(booleanFlag(2)).toBe(false);
    expect(booleanFlag(undefined)).toBe(false);
  });
});
