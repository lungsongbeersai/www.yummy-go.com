"use client";

import { useSyncExternalStore } from "react";
import { Capacitor } from "@capacitor/core";
import { usePathname } from "next/navigation";
import { usesSwan1DesktopPosLayout } from "@/lib/android-webview-compat";

// The model and pathname are stable until navigation; the server snapshot keeps
// hydration identical before the native WebView can report its user agent.
const subscribe = () => () => {};

export function useSwan1DesktopPosLayout() {
  const pathname = usePathname();
  return useSyncExternalStore(
    subscribe,
    () => usesSwan1DesktopPosLayout({
      isNativePlatform: Capacitor.isNativePlatform(),
      platform: Capacitor.getPlatform(),
      userAgent: navigator.userAgent,
    }, pathname),
    () => false,
  );
}
