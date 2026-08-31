import { Capacitor } from "@capacitor/core";

export const CAPACITOR_NATIVE_CLASS = "capacitor-native";
export const CAPACITOR_IOS_CLASS = "capacitor-ios";

export function isCapacitorNativeApp() {
  return typeof window !== "undefined" && Capacitor.isNativePlatform();
}

export function isAndroidNativeApp() {
  return isCapacitorNativeApp() && Capacitor.getPlatform() === "android";
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
