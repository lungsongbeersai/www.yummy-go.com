"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { LoadingState } from "@/components/common/loading-state";
import { NativeLoadingScreen } from "@/components/layout/capacitor/native-loading-screen";
import { isCapacitorNativeApp } from "@/lib/capacitor-platform";
import { getOfflineRedirectPath, isOfflineAllowedPath } from "@/lib/offline-routes";
import { internalRoute } from "@/lib/routes";
import { useIsAndroidNativeApp } from "@/hooks/use-android-native-app";
import { useIsCapacitorNativeApp } from "@/hooks/use-capacitor-native-app";
import { useAuthStore } from "@/stores/auth-store";

export function unauthenticatedEntryPath(pathname: string, nativeApp: boolean) {
  const entryPath = nativeApp ? "/login" : "/home";
  return `${entryPath}?redirect=${encodeURIComponent(pathname)}`;
}

// เครื่องที่ session ค้างไว้แล้ว hydrate เร็วมาก (<100ms) จน NativeLoadingScreen ไม่ทันโชว์ให้เห็นเลย —
// บังคับโชว์ splash แบรนด์อย่างน้อยเท่านี้เสมอตอนเปิดแอป (ตาม pattern ของแอป reference ที่ล็อกเวลาไว้คงที่)
const MIN_NATIVE_SPLASH_MS = 1200;

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useAuthStore((state) => state.hydrated);
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const offlineSession = useAuthStore((state) => state.offlineSession);
  const isNativeApp = useIsCapacitorNativeApp();
  const isAndroidNative = useIsAndroidNativeApp();
  const [minSplashElapsed, setMinSplashElapsed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMinSplashElapsed(true), MIN_NATIVE_SPLASH_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!isLoggedIn) {
      // Native app ต้องเปิดฟังก์ชัน POS ให้ผู้ตรวจ/พนักงานเข้าถึงตรง ๆ; หน้าแนะนำบริษัทยังคงใช้บนเว็บ
      router.replace(internalRoute(unauthenticatedEntryPath(pathname, isCapacitorNativeApp())));
    }
  }, [hydrated, isLoggedIn, pathname, router]);

  // เน็ตหลุดกลางหน้าที่ไม่รองรับออฟไลน์ (เช่น /settings/user) หรือพิมพ์ URL ตรง ๆ ตอนออฟไลน์
  // ต้องเด้งไปเพจที่จำเป็นสำหรับงานขายทันที — Android เหลือแค่หน้าที่อ่านอย่างเดียวได้ (ดู offline-routes.ts)
  useEffect(() => {
    if (!hydrated || !isLoggedIn || !offlineSession) return;
    if (isOfflineAllowedPath(pathname, isAndroidNative)) return;
    router.replace(internalRoute(getOfflineRedirectPath(isAndroidNative)));
  }, [hydrated, isAndroidNative, isLoggedIn, offlineSession, pathname, router]);

  const showNativeSplash = isNativeApp && !minSplashElapsed;

  if (!hydrated || !isLoggedIn || showNativeSplash) {
    return isNativeApp ? (
      <NativeLoadingScreen />
    ) : (
      <LoadingState label={t("common.processing")} />
    );
  }

  return <>{children}</>;
}
