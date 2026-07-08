import { Capacitor } from "@capacitor/core";

export function isCapacitorNativeApp() {
  return typeof window !== "undefined" && Capacitor.isNativePlatform();
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
