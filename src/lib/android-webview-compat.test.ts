import { describe, expect, it } from "vitest";
import { getAndroidWebViewCompatInfo } from "./android-webview-compat";

const desktopChromeUa =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const androidBrowserUa =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
const android11WebViewUa =
  "Mozilla/5.0 (Linux; Android 11; POS Terminal Build/RQ3A.211001.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/88.0.4324.93 Mobile Safari/537.36";
const modernAndroidWebViewUa =
  "Mozilla/5.0 (Linux; Android 14; Tablet Build/UQ1A.240205.004; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.188 Mobile Safari/537.36";
const oldAndroidWebViewUa =
  "Mozilla/5.0 (Linux; Android 13; Device Build/TQ3A.230901.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/95.0.4638.74 Mobile Safari/537.36";

const supportsAllRendering = () => true;
const missingBackdropSupport = (property: string) => property !== "backdrop-filter" && property !== "-webkit-backdrop-filter";

describe("getAndroidWebViewCompatInfo", () => {
  it("does not enable fallback for desktop browsers", () => {
    const info = getAndroidWebViewCompatInfo({
      isNativePlatform: false,
      platform: "web",
      userAgent: desktopChromeUa,
    });

    expect(info.needsCompat).toBe(false);
    expect(info.isAndroidNative).toBe(false);
  });

  it("does not enable fallback for Android browsers outside Capacitor", () => {
    const info = getAndroidWebViewCompatInfo({
      isNativePlatform: false,
      platform: "web",
      userAgent: androidBrowserUa,
      cssSupports: supportsAllRendering,
    });

    expect(info.needsCompat).toBe(false);
  });

  it("does not enable fallback for modern Capacitor Android WebViews", () => {
    const info = getAndroidWebViewCompatInfo({
      isNativePlatform: true,
      platform: "android",
      userAgent: modernAndroidWebViewUa,
      cssSupports: supportsAllRendering,
    });

    expect(info.needsCompat).toBe(false);
  });

  it("enables fallback for Capacitor Android 11 WebViews", () => {
    const info = getAndroidWebViewCompatInfo({
      isNativePlatform: true,
      platform: "android",
      userAgent: android11WebViewUa,
      cssSupports: supportsAllRendering,
    });

    expect(info.androidVersion).toBe(11);
    expect(info.webViewMajorVersion).toBe(88);
    expect(info.needsCompat).toBe(true);
  });

  it("enables fallback for old WebView engines even on newer Android", () => {
    const info = getAndroidWebViewCompatInfo({
      isNativePlatform: true,
      platform: "android",
      userAgent: oldAndroidWebViewUa,
      cssSupports: supportsAllRendering,
    });

    expect(info.webViewMajorVersion).toBe(95);
    expect(info.needsCompat).toBe(true);
  });

  it("enables fallback when required CSS rendering support is missing", () => {
    const info = getAndroidWebViewCompatInfo({
      isNativePlatform: true,
      platform: "android",
      userAgent: modernAndroidWebViewUa,
      cssSupports: missingBackdropSupport,
    });

    expect(info.missingRenderingSupport).toBe(true);
    expect(info.needsCompat).toBe(true);
  });

  it("allows a localStorage on override inside Capacitor Android", () => {
    const info = getAndroidWebViewCompatInfo({
      isNativePlatform: true,
      platform: "android",
      userAgent: modernAndroidWebViewUa,
      cssSupports: supportsAllRendering,
      storageValue: "on",
    });

    expect(info.override).toBe("on");
    expect(info.needsCompat).toBe(true);
  });

  it("allows a localStorage off override inside Capacitor Android", () => {
    const info = getAndroidWebViewCompatInfo({
      isNativePlatform: true,
      platform: "android",
      userAgent: android11WebViewUa,
      cssSupports: missingBackdropSupport,
      storageValue: "off",
    });

    expect(info.override).toBe("off");
    expect(info.needsCompat).toBe(false);
  });
});
