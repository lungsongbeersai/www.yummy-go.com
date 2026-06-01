import { describe, expect, it } from "vitest";
import { ServiceError } from "@/lib/api";
import { binaryNumber, requiredItems, requiredText } from "@/services/shared/validators";

describe("service validators", () => {
  it("returns trimmed required text", () => {
    expect(requiredText("  abc  ", "uuid")).toBe("abc");
  });

  it("throws ServiceError for missing text", () => {
    expect(() => requiredText(" ", "uuid")).toThrow(ServiceError);
  });

  it("accepts only binary backend flags", () => {
    expect(binaryNumber("1", "enabled")).toBe(1);
    expect(binaryNumber(2, "enabled")).toBe(2);
    expect(() => binaryNumber(0, "enabled")).toThrow("enabled must be 1 or 2");
  });

  it("requires at least one item", () => {
    expect(requiredItems([1])).toEqual([1]);
    expect(() => requiredItems([])).toThrow("items is required");
  });
});
