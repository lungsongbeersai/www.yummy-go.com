"use client";

import { useEffect, useRef } from "react";
import { useIsMounted } from "@/hooks/use-is-mounted";
import { Capacitor } from "@capacitor/core";
import { I18nextProvider } from "react-i18next";
import i18n from "@/lib/i18n";
import {
  ANDROID_WEBVIEW_COMPAT_CLASS,
  ANDROID_WEBVIEW_COMPAT_STORAGE_KEY,
  CAPACITOR_ANDROID_CLASS,
  getAndroidWebViewCompatInfo,
} from "@/lib/android-webview-compat";
import {
  CAPACITOR_IOS_CLASS,
  CAPACITOR_NATIVE_CLASS,
} from "@/lib/capacitor-platform";
import { LANGUAGE_COOKIE, type Language } from "@/lib/language";
import { syncNativeStatusBarTheme } from "@/lib/native-theme-bridge";
import { useAppStore, type FontScale, type ThemeColor, type ThemeMode } from "@/stores/app-store";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppUpdateChecker } from "@/features/app-update/app-update-checker";
import { OfflineAppRuntime } from "@/features/offline/offline-app-runtime";
import { OfflineConnectivityDialog } from "@/features/offline/offline-connectivity-dialog";

interface ProvidersProps {
  children: React.ReactNode;
  initialLanguage: Language;
}

const THEME_SWEEP_DURATION_MS = 850;
const THEME_TRANSITION_SETTLE_MS = THEME_SWEEP_DURATION_MS + 120;
const THEME_TRANSITION_CLASS = "theme-transition-active";

type ThemeTransitionDirection = "ltr" | "rtl";

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => { finished: Promise<unknown> };
};

function applyDocumentTheme(theme: ThemeMode) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  // status/navigation bar (Capacitor Android) ต้องตามธีมที่ผู้ใช้เลือกในแอป ไม่ใช่ธีมของ OS
  syncNativeStatusBarTheme(theme === "dark");
}

function applyDocumentThemeColor(themeColor: ThemeColor) {
  document.documentElement.dataset.themeColor = themeColor;
}

function applyDocumentFontScale(fontScale: FontScale) {
  document.documentElement.dataset.fontScale = fontScale;
}

function shouldReduceThemeMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getThemeTransitionDirection(theme: ThemeMode): ThemeTransitionDirection {
  return theme === "light" ? "ltr" : "rtl";
}

function clearThemeTransitionState() {
  const root = document.documentElement;
  root.classList.remove(THEME_TRANSITION_CLASS);
  delete root.dataset.themeTransitionDirection;
}

function readAndroidWebViewCompatOverride() {
  try {
    return window.localStorage.getItem(ANDROID_WEBVIEW_COMPAT_STORAGE_KEY);
  } catch {
    return null;
  }
}

function cssSupports(property: string, value: string) {
  return typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports(property, value);
}

function applyCapacitorPlatformClasses() {
  const isNativePlatform = Capacitor.isNativePlatform();
  const platform = Capacitor.getPlatform();
  const info = getAndroidWebViewCompatInfo({
    isNativePlatform,
    platform,
    userAgent: window.navigator.userAgent,
    cssSupports,
    storageValue: readAndroidWebViewCompatOverride(),
  });
  const targets = [document.documentElement, document.body].filter(Boolean);

  targets.forEach((target) => {
    target.classList.toggle(CAPACITOR_NATIVE_CLASS, isNativePlatform);
    target.classList.toggle(CAPACITOR_IOS_CLASS, isNativePlatform && platform === "ios");
    target.classList.toggle(CAPACITOR_ANDROID_CLASS, info.isAndroidNative);
    target.classList.toggle(ANDROID_WEBVIEW_COMPAT_CLASS, info.needsCompat);
  });
  document.documentElement.dataset.androidWebviewCompat = info.needsCompat ? "on" : "off";

  return () => {
    targets.forEach((target) => {
      target.classList.remove(
        CAPACITOR_NATIVE_CLASS,
        CAPACITOR_IOS_CLASS,
        CAPACITOR_ANDROID_CLASS,
        ANDROID_WEBVIEW_COMPAT_CLASS,
      );
    });
    delete document.documentElement.dataset.androidWebviewCompat;
  };
}

export function Providers({ children, initialLanguage }: ProvidersProps) {
  const mounted = useIsMounted();
  const appliedThemeRef = useRef(false);
  const themeTransitionIdRef = useRef(0);
  const themeTransitionCleanupTimerRef = useRef<number | null>(null);
  const theme = useAppStore((state) => state.theme);
  const themeColor = useAppStore((state) => state.themeColor);
  const fontScale = useAppStore((state) => state.fontScale);
  const language = useAppStore((state) => state.language);
  const hydrated = useAppStore((state) => state.hydrated);

  if (!mounted && i18n.language !== initialLanguage) {
    void i18n.changeLanguage(initialLanguage);
  }

  useEffect(() => {
    const cleanupCapacitorPlatformClasses = applyCapacitorPlatformClasses();
    void useAppStore.persist.rehydrate();

    return cleanupCapacitorPlatformClasses;
  }, []);

  useEffect(() => {
    if (!mounted || !hydrated) return;

    if (!appliedThemeRef.current) {
      appliedThemeRef.current = true;
      applyDocumentTheme(theme);
      return;
    }

    if (themeTransitionCleanupTimerRef.current) {
      window.clearTimeout(themeTransitionCleanupTimerRef.current);
      themeTransitionCleanupTimerRef.current = null;
    }

    const viewTransitionDocument = document as ViewTransitionDocument;
    if (shouldReduceThemeMotion()) {
      clearThemeTransitionState();
      applyDocumentTheme(theme);
      return;
    }

    if (typeof viewTransitionDocument.startViewTransition !== "function") {
      clearThemeTransitionState();
      applyDocumentTheme(theme);
      return;
    }

    const transitionId = themeTransitionIdRef.current + 1;
    themeTransitionIdRef.current = transitionId;
    const root = document.documentElement;
    root.dataset.themeTransitionDirection = getThemeTransitionDirection(theme);
    root.classList.add(THEME_TRANSITION_CLASS);

    try {
      const transition = viewTransitionDocument.startViewTransition(() => {
        applyDocumentTheme(theme);
      });

      const cleanupTransition = () => {
        if (themeTransitionIdRef.current !== transitionId) return;
        if (themeTransitionCleanupTimerRef.current) {
          window.clearTimeout(themeTransitionCleanupTimerRef.current);
          themeTransitionCleanupTimerRef.current = null;
        }
        clearThemeTransitionState();
      };

      themeTransitionCleanupTimerRef.current = window.setTimeout(cleanupTransition, THEME_TRANSITION_SETTLE_MS);
      void transition.finished.then(cleanupTransition, cleanupTransition);
    } catch {
      clearThemeTransitionState();
      applyDocumentTheme(theme);
    }
  }, [hydrated, mounted, theme]);

  useEffect(
    () => () => {
      themeTransitionIdRef.current += 1;
      if (themeTransitionCleanupTimerRef.current) {
        window.clearTimeout(themeTransitionCleanupTimerRef.current);
        themeTransitionCleanupTimerRef.current = null;
      }
      clearThemeTransitionState();
    },
    []
  );

  useEffect(() => {
    if (!mounted || !hydrated) return;
    applyDocumentThemeColor(themeColor);
  }, [hydrated, mounted, themeColor]);

  useEffect(() => {
    if (!mounted || !hydrated) return;
    applyDocumentFontScale(fontScale);
  }, [fontScale, hydrated, mounted]);

  useEffect(() => {
    if (!mounted || !hydrated) return;
    if (i18n.language !== language) {
      void i18n.changeLanguage(language);
    }
    document.documentElement.lang = language;
    document.documentElement.classList.toggle("font-lao", language === "la");
    document.documentElement.classList.toggle("font-sans", language !== "la");
    document.cookie = `${LANGUAGE_COOKIE}=${language}; path=/; max-age=31536000; samesite=lax`;
  }, [hydrated, language, mounted]);

  return (
    <I18nextProvider i18n={i18n}>
      <TooltipProvider delayDuration={150}>
        {children}
        <OfflineAppRuntime />
        <OfflineConnectivityDialog />
        <AppUpdateChecker />
        <Toaster />
      </TooltipProvider>
    </I18nextProvider>
  );
}
