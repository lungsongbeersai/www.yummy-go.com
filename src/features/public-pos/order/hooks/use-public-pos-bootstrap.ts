"use client";

import type { TFunction } from "i18next";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useResetOnDeps } from "@/hooks/use-reset-on-change";
import { ServiceError } from "@/lib/api";
import { toApiLanguage, toLanguage, type Language } from "@/lib/language";
import type { QRScanErrorPayload } from "@/services/public-pos";
import { useAppStore } from "@/stores/app-store";
import { usePublicPosStore } from "@/stores/public-pos-store";
import { PUBLIC_LOADING_MIN_MS } from "@/features/public-pos/order/constants";
import { useMinimumVisibleLoading } from "@/features/public-pos/order/hooks/use-minimum-visible-loading";
import {
  currentPublicQrScanStatus,
  initialPublicLanguageApplied,
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
  const [initialQueryLanguage] = useState<Language | null>(() => queryLanguage);
  const [initialQueryLanguageApplied, setInitialQueryLanguageApplied] =
    useState(() =>
      initialPublicLanguageApplied({
        activeLanguage: appLanguage,
        hydrated,
        initialQueryLanguage: queryLanguage,
      }),
    );
  const [scanAttempt, setScanAttempt] = useState(0);
  const [scanRequest, setScanRequest] = useState<PublicQrScanState>(
    INITIAL_PUBLIC_QR_SCAN_STATE,
  );
  const searchParamsString = searchParams.toString();
  const activeLanguage = appLanguage;
  const languageReady = hydrated && initialQueryLanguageApplied;
  const hasToken = Boolean(token.trim());
  const qrDisabled = Boolean(table && !table.qr_enabled);
  const scanKey =
    hasToken && languageReady
      ? publicQrScanRequestKey(token, activeLanguage, scanAttempt)
      : "";
  const lastStartedScanKey = useRef("");
  const cartQty = useMemo(() => totalCartQty(cart), [cart]);
  const scanStatus = currentPublicQrScanStatus(scanRequest, scanKey, hasToken);
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

  useResetOnDeps([
    activeLanguage,
    hydrated,
    initialQueryLanguage,
    initialQueryLanguageApplied,
  ], () => {
    if (
      hydrated &&
      !initialQueryLanguageApplied &&
      initialQueryLanguage &&
      activeLanguage === initialQueryLanguage
    ) {
      setInitialQueryLanguageApplied(true);
    }
  });

  useEffect(() => {
    if (
      initialQueryLanguageApplied ||
      !initialQueryLanguage ||
      activeLanguage === initialQueryLanguage
    ) {
      return;
    }

    setLanguage(initialQueryLanguage);
  }, [
    activeLanguage,
    initialQueryLanguage,
    initialQueryLanguageApplied,
    setLanguage,
  ]);

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

  // QR โต๊ะหมดอายุ/ถูก revoke แล้ว (ปิดบิล/เคลียร์โต๊ะ) แต่ backend แนบลิงก์เมนู
  // อย่างเดียวของสาขามาบน error body (P-72 fallback contract) — สลับไปโหมดดูเมนู
  // อย่างเดียวแทนที่จะค้างที่หน้า error เดิม คืน true เมื่อ redirect จริง (ผู้เรียก
  // จะได้ไม่ setError ทับ)
  const redirectToFallbackViewOnlyMenu = useCallback(
    (error: unknown) => {
      if (!(error instanceof ServiceError)) return false;

      const payload = error.payload as QRScanErrorPayload | undefined;
      const rawFallbackUrl = payload?.fallback_view_only_url;
      if (typeof rawFallbackUrl !== "string" || !rawFallbackUrl.trim()) return false;

      let fallbackUrl: URL;
      try {
        fallbackUrl = new URL(rawFallbackUrl, window.location.origin);
      } catch {
        return false;
      }
      if (fallbackUrl.origin !== window.location.origin) return false;

      const fallbackToken = fallbackUrl.searchParams.get("t");
      if (!fallbackToken || fallbackToken === token) return false;

      const params = new URLSearchParams(searchParamsString);
      params.set("t", fallbackToken);
      const fallbackLang = fallbackUrl.searchParams.get("lang");
      if (fallbackLang) params.set("lang", fallbackLang);

      router.replace(`${pathname}?${params.toString()}` as Route, { scroll: false });
      return true;
    },
    [pathname, router, searchParamsString, token],
  );

  useEffect(() => {
    if (!hasToken) {
      reset();
      lastStartedScanKey.current = "";
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

        // QR โต๊ะหมดอายุ/ลูกค้า checkout ไปแล้ว → backend ตอบ status !== "success"
        // (ยืนยันจากของจริง: HTTP 200, {"status":"error","message":"invalid/expired
        // token"}) แปลว่าไม่มีทาง set `table` ได้เลย ต้องอ่าน fallback URL จาก error
        // payload ตรงนี้แทน (P-72 — ยังไม่มีจริงจนกว่า backend จะเพิ่ม field)
        if (redirectToFallbackViewOnlyMenu(error)) return;

        setError(
          error instanceof Error ? error.message : t("pos.qrScanFailed"),
        );
      });
  }, [
    activeLanguage,
    hasToken,
    languageReady,
    redirectToFallbackViewOnlyMenu,
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
