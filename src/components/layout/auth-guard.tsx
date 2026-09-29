"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { LoadingState } from "@/components/common/loading-state";
import { NativeLoadingScreen } from "@/components/layout/capacitor/native-loading-screen";
import { AppShellSkeleton } from "@/components/layout/web/app-shell-skeleton";
import { isCapacitorNativeApp } from "@/lib/capacitor-platform";
import { internalRoute } from "@/lib/routes";
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
  const token = useAuthStore((state) => state.token);
  const validateSession = useAuthStore((state) => state.validateSession);
  const isNativeApp = useIsCapacitorNativeApp();
  const [minSplashElapsed, setMinSplashElapsed] = useState(false);
  const [validatedToken, setValidatedToken] = useState<string | null>(null);

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

  useEffect(() => {
    if (!hydrated || !isLoggedIn || !token) {
      return;
    }

    let cancelled = false;
    validateSession()
      .catch(() => false)
      .finally(() => {
        const current = useAuthStore.getState();
        if (!cancelled && current.isLoggedIn && current.token === token) {
          setValidatedToken(token);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [hydrated, isLoggedIn, token, validateSession]);

  useEffect(() => {
    if (!hydrated || !isLoggedIn || !token || validatedToken !== token) return;

    const checkSession = () => {
      void validateSession().catch(() => false);
    };
    const checkVisibleSession = () => {
      if (document.visibilityState === "visible") checkSession();
    };

    checkSession();
    window.addEventListener("focus", checkSession);
    document.addEventListener("visibilitychange", checkVisibleSession);
    const interval = window.setInterval(checkSession, 30_000);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", checkSession);
      document.removeEventListener("visibilitychange", checkVisibleSession);
    };
  }, [hydrated, isLoggedIn, pathname, token, validateSession, validatedToken]);

  const showNativeSplash = isNativeApp && !minSplashElapsed;

  const validatingSession = hydrated && isLoggedIn && Boolean(token) && validatedToken !== token;

  if (!hydrated || !isLoggedIn || validatingSession || showNativeSplash) {
    if (isNativeApp) return <NativeLoadingScreen />;
    // Signed out and about to be redirected to the public entry page: no app chrome.
    if (hydrated && !isLoggedIn) return <LoadingState label={t("common.processing")} />;
    // Restoring the session: show the app's own frame so the first paint already looks
    // like the page that is about to appear.
    return <AppShellSkeleton label={t("common.processing")} />;
  }

  return <>{children}</>;
}
