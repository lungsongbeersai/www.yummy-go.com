import { describe, expect, it } from "vitest";
import {
  CAPACITOR_ANDROID_USER_AGENT,
  CAPACITOR_IOS_USER_AGENT,
} from "@/lib/capacitor-platform";
import { detectMobileAppDownloadPlatform } from "./mobile-app-download";

const androidPhone = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
const iPhone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const macSafari = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";

describe("mobile app download platform", () => {
  it.each([
    ["Chrome phone", androidPhone],
    ["Samsung browser", "Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36"],
    ["tablet without a Mobile marker", "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"],
    ["in-app web browser", "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36 Line/14.0.0"],
  ])("detects an Android %s", (_name, userAgent) => {
    expect(detectMobileAppDownloadPlatform({ userAgent })).toBe("android");
  });

  it.each([
    ["iPhone", iPhone],
    ["iPhone in-app browser", `${iPhone} [FBAN/FBIOS;FBAV/481.0.0.0.0]`],
    ["iPod", "Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1"],
    ["iPad", "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"],
  ])("detects an %s browser", (_name, userAgent) => {
    expect(detectMobileAppDownloadPlatform({ userAgent })).toBe("ios");
  });

  it("detects iPadOS using a desktop Mac user agent and multiple touch points", () => {
    expect(detectMobileAppDownloadPlatform({
      userAgent: macSafari, platform: "MacIntel", maxTouchPoints: 5,
    })).toBe("ios");
  });

  it.each([
    { userAgent: macSafari, platform: "MacIntel", maxTouchPoints: 0 },
    { userAgent: macSafari, platform: "MacIntel", maxTouchPoints: 1 },
    { userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36", platform: "Win32", maxTouchPoints: 10 },
    { userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36", platform: "Linux x86_64" },
    { userAgent: "" },
  ])("keeps desktop browsers excluded regardless of window width: $platform", (environment) => {
    expect(detectMobileAppDownloadPlatform(environment)).toBeNull();
  });

  it.each([androidPhone, iPhone, macSafari])("suppresses an explicitly detected native app: %s", (userAgent) => {
    expect(detectMobileAppDownloadPlatform({
      userAgent, platform: "MacIntel", maxTouchPoints: 5, isNativeApp: true,
    })).toBeNull();
  });

  it.each([CAPACITOR_ANDROID_USER_AGENT, CAPACITOR_IOS_USER_AGENT])(
    "suppresses the native app marker %s even without native bridge detection",
    (marker) => {
      for (const browserAgent of [androidPhone, iPhone, macSafari]) {
        expect(detectMobileAppDownloadPlatform({
          userAgent: `${browserAgent} ${marker}`, platform: "MacIntel", maxTouchPoints: 5,
        })).toBeNull();
      }
    },
  );
});
