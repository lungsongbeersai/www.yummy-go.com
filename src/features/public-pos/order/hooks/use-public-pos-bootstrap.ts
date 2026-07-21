"use client";

import type { TFunction } from "i18next";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toApiLanguage, toLanguage, type Language } from "@/lib/language";
import { useAppStore } from "@/stores/app-store";
import { usePublicPosStore } from "@/stores/public-pos-store";
import { PUBLIC_LOADING_MIN_MS } from "@/features/public-pos/order/constants";
import { useMinimumVisibleLoading } from "@/features/public-pos/order/hooks/use-minimum-visible-loading";
import {
  currentPublicQrScanStatus,
  INITIAL_PUBLIC_QR_SCAN_STATE,
  isPublicQrScanLoading,
  PUBLIC_QR_SCAN_STATUS,
  publicQrScanRequestKey,
  type PublicQrScanState,
} from "@/features/public-pos/order/public-qr-scan-state";
import { tableStatusLabel, totalCartQty } from "@/features/public-pos/order/utils";

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
  const [scanAttempt, setScanAttempt] = useState(0);
  const [scanRequest, setScanRequest] = useState<PublicQrScanState>(
    INITIAL_PUBLIC_QR_SCAN_STATE,
  );
  const searchParamsString = searchParams.toString();
  const activeLanguage = appLanguage;
  const hasToken = Boolean(token.trim());
  const qrDisabled = Boolean(table && !table.qr_enabled);
  const scanKey =
    hasToken && languageReady
      ? publicQrScanRequestKey(token, activeLanguage, scanAttempt)
      : "";
  const lastStartedScanKey = useRef("");
  const cartQty = useMemo(() => totalCartQty(cart), [cart]);
  const scanStatus = currentPublicQrScanStatus(scanRequest, scanKey);
  const publicLoadingActive = isPublicQrScanLoading({
    hasToken,
    languageReady,
    storeLoading: loading,
    status: scanStatus,
  });
  const canRetryScan = Boolean(
    hasToken &&
      languageReady &&
      scanStatus === PUBLIC_QR_SCAN_STATUS.ERROR,
  );
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
    // replace บน pathname ปัจจุบัน (เปลี่ยนเฉพาะ query) — ปลอดภัยเสมอ จึง cast ได้
    router.replace(`${pathname}${nextQuery ? `?${nextQuery}` : ""}` as Route, {
      scroll: false,
    });
  }, [activeLanguage, languageReady, pathname, router, searchParamsString]);

  useEffect(() => {
    if (!hasToken) {
      reset();
      lastStartedScanKey.current = "";
      setScanRequest({
        requestKey: "",
        status: PUBLIC_QR_SCAN_STATUS.ERROR,
      });
      setError(t("pos.missingToken"));
      return;
    }

    if (
      !languageReady ||
      !scanKey ||
      lastStartedScanKey.current === scanKey
    ) {
      return;
    }

    lastStartedScanKey.current = scanKey;
    setScanRequest({
      requestKey: scanKey,
      status: PUBLIC_QR_SCAN_STATUS.LOADING,
    });

    void scanTable(token, activeLanguage)
      .then(() => {
        if (lastStartedScanKey.current !== scanKey) return;
        setScanRequest({
          requestKey: scanKey,
          status: PUBLIC_QR_SCAN_STATUS.SUCCESS,
        });
      })
      .catch((error) => {
        if (lastStartedScanKey.current !== scanKey) return;
        setScanRequest({
          requestKey: scanKey,
          status: PUBLIC_QR_SCAN_STATUS.ERROR,
        });
        setError(
          error instanceof Error ? error.message : t("pos.qrScanFailed"),
        );
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

  const retryScan = useCallback(() => {
    if (!hasToken || !languageReady) return;
    setError(null);
    setScanAttempt((attempt) => attempt + 1);
  }, [hasToken, languageReady, setError]);

  return {
    activeLanguage,
    canRetryScan,
    cartQty,
    error,
    isPublicLoading,
    languageReady,
    qrDisabled,
    statusLabel,
    table,
    retryScan,
  };
}
