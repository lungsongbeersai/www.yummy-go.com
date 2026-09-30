import { describe, expect, it } from "vitest";
import { getAndroidWebViewCompatInfo, isSwan1NativeWebView, usesSwan1DesktopPosLayout } from "./android-webview-compat";

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
const swan1WebViewUa =
  "Mozilla/5.0 (Linux; Android 11; Swan 1 Build/RQ3A.210705.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/101.0.4951.61 Safari/537.36 YummyGoCapacitorAndroid";

const supportsAllRendering = () => true;
const missingBackdropSupport = (property: string) => property !== "backdrop-filter" && property !== "-webkit-backdrop-filter";

describe("isSwan1NativeWebView", () => {
  it("matches the native Swan 1 WebView user agent", () => {
    expect(isSwan1NativeWebView({
      isNativePlatform: true,
      platform: "android",
      userAgent: swan1WebViewUa,
    })).toBe(true);
  });

  it("does not change web, iPad, or other Android devices", () => {
    expect(isSwan1NativeWebView({ isNativePlatform: false, platform: "web", userAgent: swan1WebViewUa })).toBe(false);
    expect(isSwan1NativeWebView({ isNativePlatform: true, platform: "ios", userAgent: swan1WebViewUa })).toBe(false);
    expect(isSwan1NativeWebView({ isNativePlatform: true, platform: "android", userAgent: android11WebViewUa })).toBe(false);
    expect(isSwan1NativeWebView({
      isNativePlatform: true,
      platform: "android",
      userAgent: swan1WebViewUa.replace("Swan 1 Build", "Swan 2 Build"),
    })).toBe(false);
  });
});

describe("usesSwan1DesktopPosLayout", () => {
  const swan = { isNativePlatform: true, platform: "android", userAgent: swan1WebViewUa };

  it("uses the desktop POS layout only on Swan 1 table and order screens", () => {
    expect(usesSwan1DesktopPosLayout(swan, "/posAll/tables")).toBe(true);
    expect(usesSwan1DesktopPosLayout(swan, "/posAll/order")).toBe(true);
    expect(usesSwan1DesktopPosLayout(swan, "/")).toBe(false);
    expect(usesSwan1DesktopPosLayout(swan, "/settings/table")).toBe(false);
  });

  it("keeps other Android tablets, iPads, and browsers on their existing layouts", () => {
    expect(usesSwan1DesktopPosLayout({ ...swan, isNativePlatform: false }, "/posAll/tables")).toBe(false);
    expect(usesSwan1DesktopPosLayout({ ...swan, platform: "ios" }, "/posAll/tables")).toBe(false);
    expect(usesSwan1DesktopPosLayout({ ...swan, userAgent: android11WebViewUa }, "/posAll/tables")).toBe(false);
    expect(usesSwan1DesktopPosLayout({ ...swan, userAgent: swan1WebViewUa.replace("Swan 1 Build", "Swan 2 Build") }, "/posAll/order")).toBe(false);
  });
});

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
