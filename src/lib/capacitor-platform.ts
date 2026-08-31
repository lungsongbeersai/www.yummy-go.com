import { Capacitor } from "@capacitor/core";

export const CAPACITOR_NATIVE_CLASS = "capacitor-native";
export const CAPACITOR_IOS_CLASS = "capacitor-ios";
export const CAPACITOR_ANDROID_USER_AGENT = "YummyGoCapacitorAndroid";

export function detectCapacitorAndroidApp(
  isNativePlatform: boolean,
  platform: string,
  userAgent = "",
) {
  return (isNativePlatform && platform === "android") ||
    userAgent.includes(CAPACITOR_ANDROID_USER_AGENT);
}

export function isCapacitorNativeApp() {
  return typeof window !== "undefined" && Capacitor.isNativePlatform();
}

export function isCapacitorAndroidApp() {
  if (typeof window === "undefined") return false;
  return detectCapacitorAndroidApp(
    Capacitor.isNativePlatform(),
    Capacitor.getPlatform(),
    navigator.userAgent,
  );
}

export function isAndroidNativeApp() {
  return isCapacitorAndroidApp();
}

export function canUseWindowOpen() {
  return !isCapacitorNativeApp();
}

export function openWindowOutsideNativeApp(
  url?: string | URL,
  target?: string,
  features?: string,
) {
  if (!canUseWindowOpen()) return null;
  return window.open(url, target, features);
}
