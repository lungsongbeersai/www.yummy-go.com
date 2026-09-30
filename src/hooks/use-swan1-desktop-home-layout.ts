"use client";

import { useSyncExternalStore } from "react";
import { Capacitor } from "@capacitor/core";
import { usePathname } from "next/navigation";
import { usesSwan1DesktopHomeLayout } from "@/lib/android-webview-compat";

const subscribe = () => () => {};

export function useSwan1DesktopHomeLayout() {
  const pathname = usePathname();
  return useSyncExternalStore(
    subscribe,
    () => usesSwan1DesktopHomeLayout({
      isNativePlatform: Capacitor.isNativePlatform(),
      platform: Capacitor.getPlatform(),
      userAgent: navigator.userAgent,
    }, pathname),
    () => false,
  );
}
