import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({ android: true, available: false, printHtml: vi.fn() }));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isPluginAvailable: () => native.available },
  registerPlugin: () => ({ printHtml: native.printHtml }),
}));
vi.mock("@/lib/capacitor-platform", () => ({ isCapacitorAndroidApp: () => native.android }));

import { canUseAndroidSystemPrint, printHtmlWithAndroidSystemPrint } from "./android-system-print";

beforeEach(() => {
  native.android = true;
  native.available = false;
  native.printHtml.mockReset();
  vi.stubGlobal("window", { location: { origin: "https://example.test" } });
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("Android system printing capability", () => {
  it("never invokes an unimplemented bridge in an older Play shell", async () => {
    expect(canUseAndroidSystemPrint()).toBe(false);
    await expect(printHtmlWithAndroidSystemPrint({ html: "<p>Report</p>", jobName: "Own report" })).resolves.toBe(false);
    expect(native.printHtml).not.toHaveBeenCalled();
  });

  it("passes the prepared document to an available Android bridge exactly once", async () => {
    native.available = true;
    native.printHtml.mockResolvedValue(undefined);
    expect(canUseAndroidSystemPrint()).toBe(true);
    await expect(printHtmlWithAndroidSystemPrint({ html: "<p>Report</p>", jobName: "Own report" })).resolves.toBe(true);
    expect(native.printHtml).toHaveBeenCalledExactlyOnceWith({ baseUrl: "https://example.test", html: "<p>Report</p>", jobName: "Own report" });
  });

  it("does not offer the Android bridge outside the Android app", () => {
    native.android = false;
    native.available = true;
    expect(canUseAndroidSystemPrint()).toBe(false);
  });

  it("propagates a failure after native printing was invoked so callers cannot duplicate the job", async () => {
    native.available = true;
    const failure = new Error("Print service unavailable");
    native.printHtml.mockRejectedValue(failure);
    await expect(printHtmlWithAndroidSystemPrint({ html: "<p>Report</p>", jobName: "Own report" })).rejects.toBe(failure);
    expect(native.printHtml).toHaveBeenCalledOnce();
  });
});
