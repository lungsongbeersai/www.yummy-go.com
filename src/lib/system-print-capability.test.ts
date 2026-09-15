import { describe, expect, it } from "vitest";
import { canUseSystemPrintFallback } from "@/lib/system-print-capability";

describe("system print capability", () => {
  it("keeps the explicit print fallback in a normal browser", () => {
    expect(canUseSystemPrintFallback(undefined, true)).toBe(true);
  });

  it("fails closed outside a browser", () => {
    expect(canUseSystemPrintFallback(undefined, false)).toBe(false);
  });

  it("never opens the OS print fallback from an Electron shell", () => {
    const electronApi = {
      getDisplays: async () => {
        throw new Error("not used by the print policy");
      },
    };
    expect(canUseSystemPrintFallback(electronApi, true)).toBe(false);
  });
});
