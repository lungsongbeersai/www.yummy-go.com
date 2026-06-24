export const CAPACITOR_ANDROID_CLASS = "capacitor-android";
export const ANDROID_WEBVIEW_COMPAT_CLASS = "android-webview-compat";
export const ANDROID_WEBVIEW_COMPAT_STORAGE_KEY = "yummy-go-rendering-compat";

export type RenderingCompatOverride = "" | "off" | "on";

export type CssSupports = (property: string, value: string) => boolean;

export interface AndroidWebViewCompatInput {
  isNativePlatform: boolean;
  platform: string;
  userAgent: string;
  cssSupports?: CssSupports;
  storageValue?: string | null;
}

export interface AndroidWebViewCompatInfo {
  androidVersion: number | null;
  webViewMajorVersion: number | null;
  isAndroidNative: boolean;
  missingRenderingSupport: boolean;
  needsCompat: boolean;
  override: RenderingCompatOverride;
}

const MIN_STABLE_WEBVIEW_MAJOR = 100;
const MAX_COMPAT_ANDROID_MAJOR = 11;

export function parseAndroidVersion(userAgent: string): number | null {
  const match = /Android\s+(\d+)/i.exec(userAgent);
  return match ? Number(match[1]) : null;
}

export function parseWebViewMajorVersion(userAgent: string): number | null {
  const match = /(?:Chrome|CriOS)\/(\d+)/i.exec(userAgent);
  return match ? Number(match[1]) : null;
}

export function getRenderingCompatOverride(value: string | null | undefined): RenderingCompatOverride {
  if (!value) return "";

  const normalized = value.trim().toLowerCase();
  if (normalized === "on" || normalized === "off") return normalized;

  return "";
}

function supportsAny(cssSupports: CssSupports, candidates: Array<[string, string]>) {
  return candidates.some(([property, value]) => cssSupports(property, value));
}

function hasExpectedRenderingSupport(cssSupports?: CssSupports) {
  if (!cssSupports) return false;

  const supportsFilter = cssSupports("filter", "none");
  const supportsBlendMode = cssSupports("mix-blend-mode", "normal");
  const supportsBackdropFilter = supportsAny(cssSupports, [
    ["backdrop-filter", "blur(1px)"],
    ["-webkit-backdrop-filter", "blur(1px)"],
  ]);
  const supportsMaskImage = supportsAny(cssSupports, [
    ["mask-image", "linear-gradient(#000, #000)"],
    ["-webkit-mask-image", "linear-gradient(#000, #000)"],
  ]);

  return supportsFilter && supportsBlendMode && supportsBackdropFilter && supportsMaskImage;
}

export function getAndroidWebViewCompatInfo(input: AndroidWebViewCompatInput): AndroidWebViewCompatInfo {
  const platform = input.platform.trim().toLowerCase();
  const isAndroidNative = input.isNativePlatform && platform === "android";
  const androidVersion = parseAndroidVersion(input.userAgent);
  const webViewMajorVersion = parseWebViewMajorVersion(input.userAgent);
  const override = getRenderingCompatOverride(input.storageValue);
  const missingRenderingSupport = !hasExpectedRenderingSupport(input.cssSupports);

  if (!isAndroidNative) {
    return {
      androidVersion,
      webViewMajorVersion,
      isAndroidNative,
      missingRenderingSupport,
      needsCompat: false,
      override,
    };
  }

  if (override === "on") {
    return {
      androidVersion,
      webViewMajorVersion,
      isAndroidNative,
      missingRenderingSupport,
      needsCompat: true,
      override,
    };
  }

  if (override === "off") {
    return {
      androidVersion,
      webViewMajorVersion,
      isAndroidNative,
      missingRenderingSupport,
      needsCompat: false,
      override,
    };
  }

  const oldAndroid = androidVersion !== null && androidVersion <= MAX_COMPAT_ANDROID_MAJOR;
  const oldWebView = webViewMajorVersion !== null && webViewMajorVersion < MIN_STABLE_WEBVIEW_MAJOR;

  return {
    androidVersion,
    webViewMajorVersion,
    isAndroidNative,
    missingRenderingSupport,
    needsCompat: oldAndroid || oldWebView || missingRenderingSupport,
    override,
  };
}
