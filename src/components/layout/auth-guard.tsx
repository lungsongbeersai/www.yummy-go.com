"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { LoadingState } from "@/components/common/loading-state";
import { NativeLoadingScreen } from "@/components/layout/capacitor/native-loading-screen";
import { isCapacitorNativeApp } from "@/lib/capacitor-platform";
import { internalRoute } from "@/lib/routes";
import { useIsCapacitorNativeApp } from "@/hooks/use-capacitor-native-app";
import { useAuthStore } from "@/stores/auth-store";

export function unauthenticatedEntryPath(pathname: string, nativeApp: boolean) {
  const entryPath = nativeApp ? "/login" : "/home";
  return `${entryPath}?redirect=${encodeURIComponent(pathname)}`;
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useAuthStore((state) => state.hydrated);
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const isNativeApp = useIsCapacitorNativeApp();

  useEffect(() => {
    if (!hydrated) return;
    if (!isLoggedIn) {
      // Native app ต้องเปิดฟังก์ชัน POS ให้ผู้ตรวจ/พนักงานเข้าถึงตรง ๆ; หน้าแนะนำบริษัทยังคงใช้บนเว็บ
      router.replace(internalRoute(unauthenticatedEntryPath(pathname, isCapacitorNativeApp())));
    }
  }, [hydrated, isLoggedIn, pathname, router]);

  if (!hydrated || !isLoggedIn) {
    return isNativeApp ? (
      <NativeLoadingScreen />
    ) : (
      <LoadingState label={t("common.processing")} />
    );
  }

  return <>{children}</>;
}
