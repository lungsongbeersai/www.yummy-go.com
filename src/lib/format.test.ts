import { describe, expect, it } from "vitest";
import { businessDateInputValue } from "./format";

describe("businessDateInputValue", () => {
  it("keeps 05:59:59 in the previous Vientiane business day", () => {
    expect(businessDateInputValue(new Date("2026-08-25T22:59:59.000Z"))).toBe("2026-08-25");
  });

  it("starts the new business day at 06:00:00", () => {
    expect(businessDateInputValue(new Date("2026-08-25T23:00:00.000Z"))).toBe("2026-08-26");
  });
});
