"use client";

import type { TFunction } from "i18next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toApiLanguage, toLanguage, type Language } from "@/lib/language";
import { useAppStore } from "@/stores/app-store";
import { usePublicPosStore } from "@/stores/public-pos-store";
import { PUBLIC_LOADING_MIN_MS } from "@/features/public-pos/constants";
import { useMinimumVisibleLoading } from "@/features/public-pos/hooks/use-minimum-visible-loading";
import { tableStatusLabel, totalCartQty } from "@/features/public-pos/utils";

export function usePublicPosBootstrap({
  token,
  queryLang,
  t,
}: {
  token: string;
  queryLang: string | null;
  t: TFunction;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const appLanguage = useAppStore((state) => state.language);
  const hydrated = useAppStore((state) => state.hydrated);
  const setLanguage = useAppStore((state) => state.setLanguage);
  const table = usePublicPosStore((state) => state.scan);
  const cart = usePublicPosStore((state) => state.cart);
  const loading = usePublicPosStore((state) => state.loading);
  const error = usePublicPosStore((state) => state.error);
  const setError = usePublicPosStore((state) => state.setError);
  const scanTable = usePublicPosStore((state) => state.scanTable);
  const reset = usePublicPosStore((state) => state.reset);
  const queryLanguage = useMemo<Language | null>(
    () => (queryLang?.trim() ? toLanguage(queryLang) : null),
    [queryLang],
  );
  const initialQueryLanguage = useRef<Language | null>(queryLanguage);
  const initialQueryLanguageApplied = useRef(!queryLanguage);
  const [languageReady, setLanguageReady] = useState(false);
  const searchParamsString = searchParams.toString();
  const activeLanguage = appLanguage;
  const hasToken = Boolean(token.trim());
  const qrDisabled = Boolean(table && !table.qr_enabled);
  const scanKey = hasToken && languageReady ? `${token}:${activeLanguage}` : "";
  const lastScanKey = useRef("");
  const cartQty = useMemo(() => totalCartQty(cart), [cart]);
  const pendingScan = Boolean(
    hasToken && languageReady && lastScanKey.current !== scanKey,
  );
  const publicLoadingActive = loading || !languageReady || pendingScan;
  const isPublicLoading = useMinimumVisibleLoading(
    publicLoadingActive,
    PUBLIC_LOADING_MIN_MS,
  );
  const statusLabel = table ? tableStatusLabel(table.table_status, t) : "";

  useEffect(() => {
    const languageFromUrl = initialQueryLanguage.current;

    if (!hydrated) {
      if (languageFromUrl && appLanguage !== languageFromUrl) {
        setLanguage(languageFromUrl);
      }
      setLanguageReady(false);
      return;
    }

    if (!initialQueryLanguageApplied.current && languageFromUrl) {
      if (appLanguage !== languageFromUrl) {
        setLanguage(languageFromUrl);
        setLanguageReady(false);
        return;
      }
      initialQueryLanguageApplied.current = true;
    }

    setLanguageReady(true);
  }, [appLanguage, hydrated, setLanguage]);

  useEffect(() => {
    if (!languageReady) return;

    const params = new URLSearchParams(searchParamsString);
    const nextLang = toApiLanguage(activeLanguage);
    if (params.get("lang") === nextLang) return;

    params.set("lang", nextLang);
    const nextQuery = params.toString();
    router.replace(`${pathname}${nextQuery ? `?${nextQuery}` : ""}`, {
      scroll: false,
    });
  }, [activeLanguage, languageReady, pathname, router, searchParamsString]);

  useEffect(() => {
    if (!hasToken) {
      reset();
      lastScanKey.current = "";
      setError(t("pos.missingToken"));
      return;
    }

    if (!languageReady || lastScanKey.current === scanKey) return;
    lastScanKey.current = scanKey;

    void scanTable(token, activeLanguage).catch((error) => {
      lastScanKey.current = "";
      setError(error instanceof Error ? error.message : t("pos.qrScanFailed"));
    });
  }, [
    activeLanguage,
    hasToken,
    languageReady,
    reset,
    scanKey,
    scanTable,
    setError,
    t,
    token,
  ]);

  const clearError = useCallback(() => {
    setError(null);
  }, [setError]);

  return {
    activeLanguage,
    cartQty,
    error,
    isPublicLoading,
    languageReady,
    qrDisabled,
    statusLabel,
    table,
    clearError,
  };
}
