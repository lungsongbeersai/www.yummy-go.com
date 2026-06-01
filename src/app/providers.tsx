"use client";

import { useEffect, useRef, useState } from "react";
import { I18nextProvider } from "react-i18next";
import i18n from "@/lib/i18n";
import { LANGUAGE_COOKIE, type Language } from "@/lib/language";
import { useAppStore, type ThemeMode } from "@/stores/app-store";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

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

export function Providers({ children, initialLanguage }: ProvidersProps) {
  const [mounted, setMounted] = useState(false);
  const appliedThemeRef = useRef(false);
  const themeTransitionIdRef = useRef(0);
  const themeTransitionCleanupTimerRef = useRef<number | null>(null);
  const theme = useAppStore((state) => state.theme);
  const language = useAppStore((state) => state.language);
  const hydrated = useAppStore((state) => state.hydrated);

  if (!mounted && i18n.language !== initialLanguage) {
    void i18n.changeLanguage(initialLanguage);
  }

  useEffect(() => {
    setMounted(true);
    void useAppStore.persist.rehydrate();
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
    if (i18n.language !== language) {
      void i18n.changeLanguage(language);
    }
    document.documentElement.lang = language;
    document.cookie = `${LANGUAGE_COOKIE}=${language}; path=/; max-age=31536000; samesite=lax`;
  }, [hydrated, language, mounted]);

  return (
    <I18nextProvider i18n={i18n}>
      <TooltipProvider delayDuration={150}>
        {children}
        <Toaster />
      </TooltipProvider>
    </I18nextProvider>
  );
}
