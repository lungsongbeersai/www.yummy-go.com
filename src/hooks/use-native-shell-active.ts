"use client";

import { useIsCapacitorNativeApp } from "./use-capacitor-native-app";
import { useSwan1DesktopPosLayout } from "./use-swan1-desktop-pos-layout";

// Swan 1 retains NativeAppShell for Android back handling, but its two POS
// screens render the existing desktop page branch without the native chrome.
export function useIsNativeShellActive() {
  const isNativeApp = useIsCapacitorNativeApp();
  const desktopPosLayout = useSwan1DesktopPosLayout();
  return isNativeApp && !desktopPosLayout;
}
