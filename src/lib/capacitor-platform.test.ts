import { describe, expect, it } from "vitest";
import {
  CAPACITOR_ANDROID_USER_AGENT,
  detectCapacitorAndroidApp,
  detectCapacitorMobilePlatform,
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

  it("does not mistake iOS or a browser for the Android app", () => {
    expect(detectCapacitorAndroidApp(false, "web", "Chrome Windows")).toBe(false);
    expect(detectCapacitorAndroidApp(false, "web", "Chrome Android")).toBe(false);
    expect(detectCapacitorAndroidApp(true, "ios", "YummyGoCapacitoriOS")).toBe(false);
  });

  it.each(["android", "ios"])("detects the %s native platform without its user agent", (platform) => {
    expect(detectCapacitorMobilePlatform(true, platform)).toBe(platform);
  });

  it("detects an iOS remote WebView through the configured app marker", () => {
    expect(detectCapacitorMobilePlatform(false, "web", "Safari YummyGoCapacitoriOS")).toBe("ios");
    expect(detectCapacitorMobilePlatform(false, "web", "Chrome YummyGoCapacitorAndroid")).toBe("android");
  });

  it.each(["Chrome Windows", "Safari Mac", "Chrome Android", "Safari iPhone"])("keeps %s on the browser transport", (userAgent) => {
    expect(detectCapacitorMobilePlatform(false, "web", userAgent)).toBeNull();
  });
});
