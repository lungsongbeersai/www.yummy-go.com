import { describe, expect, it } from "vitest";
import {
  formatNumberInput,
  numberFromFormatted,
  stripNumberFormat,
} from "@/lib/number-format";

describe("number format helpers", () => {
  it("formats large integer strings with commas", () => {
    expect(formatNumberInput("200000000000")).toBe("200,000,000,000");
  });

  it("strips formatted integer strings back to raw digits", () => {
    expect(stripNumberFormat("200,000,000,000")).toBe("200000000000");
  });

  it("keeps decimals while formatting the integer side", () => {
    expect(formatNumberInput("12345.67", { decimal: true })).toBe("12,345.67");
    expect(stripNumberFormat("12,345.67", { decimal: true })).toBe("12345.67");
    expect(stripNumberFormat(".", { decimal: true })).toBe("");
  });

  it("parses formatted numbers safely for payload builders", () => {
    expect(numberFromFormatted("200,000")).toBe(200000);
    expect(numberFromFormatted("12,345.67")).toBe(12345.67);
    expect(numberFromFormatted("")).toBe(0);
  });
});
