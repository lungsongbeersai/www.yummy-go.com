import { describe, expect, it } from "vitest";
import {
  CAPACITOR_ANDROID_USER_AGENT,
  detectCapacitorAndroidApp,
} from "@/lib/capacitor-platform";

describe("Capacitor platform detection", () => {
  it("detects current Android native builds", () => {
    expect(detectCapacitorAndroidApp(true, "android")).toBe(true);
  });

  it("keeps Store builds detectable through their Android user-agent marker", () => {
    expect(detectCapacitorAndroidApp(
      false,
      "web",
      `Mozilla/5.0 ${CAPACITOR_ANDROID_USER_AGENT}`,
    )).toBe(true);
  });

  it("does not disable the Local Agent on Windows, macOS, iOS, or normal mobile Chrome", () => {
    expect(detectCapacitorAndroidApp(false, "web", "Chrome Windows")).toBe(false);
    expect(detectCapacitorAndroidApp(false, "web", "Chrome Android")).toBe(false);
    expect(detectCapacitorAndroidApp(true, "ios", "YummyGoCapacitoriOS")).toBe(false);
  });
});
