import { describe, expect, it } from "vitest";
import { browserPrintRetryDelayMs } from "./mobile-offline-queue";

describe("browserPrintRetryDelayMs", () => {
  it("backs off failed not-sent jobs but never abandons them", () => {
    expect(browserPrintRetryDelayMs(1)).toBe(30_000);
    expect(browserPrintRetryDelayMs(2)).toBe(60_000);
    expect(browserPrintRetryDelayMs(3)).toBe(120_000);
    expect(browserPrintRetryDelayMs(5)).toBe(480_000);
    expect(browserPrintRetryDelayMs(50)).toBe(480_000);
  });
});
