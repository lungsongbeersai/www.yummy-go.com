"use client";

import type { TFunction } from "i18next";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type QrScanner from "qr-scanner";
import { useIsCapacitorNativeApp } from "@/hooks/use-capacitor-native-app";
import { isBranchMenuQrToken } from "@/services/public-pos/qr-token";
import type { ToastInput } from "@/stores/toast-store";

export type PublicQrOrderScannerStatus =
  | "idle"
  | "requestingPermission"
  | "starting"
  | "scanning"
  | "error";

// สแกน QR โต๊ะ (ที่พนักงานโชว์ให้) ด้วยกล้องเครื่องลูกค้าเอง เพื่อสลับจากเมนู
// ดูอย่างเดียว (view_only) ไปเป็นโหมดสั่งอาหารได้จริง — ไลบรารีเดียวใช้ได้ทั้ง
// web / Electron / Capacitor Android WebView ไม่ต้องแยก native path (P-72)
export function usePublicQrOrderScanner({
  currentToken,
  t,
  toast,
}: {
  currentToken: string;
  t: TFunction;
  toast: (toast: ToastInput) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const nativeApp = useIsCapacitorNativeApp();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<PublicQrOrderScannerStatus>("idle");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const searchParamsString = searchParams.toString();

  const openScanner = useCallback(() => {
    setStatus("starting");
    setOpen(true);
  }, []);

  const closeScanner = useCallback(() => {
    setOpen(false);
  }, []);

  const applyScannedToken = useCallback(
    (scannedToken: string, scannedLang: string | null) => {
      const params = new URLSearchParams(searchParamsString);
      params.set("t", scannedToken);
      if (scannedLang) params.set("lang", scannedLang);

      setOpen(false);
      router.replace(`${pathname}?${params.toString()}` as Route, { scroll: false });
    },
    [pathname, router, searchParamsString],
  );

  const handleDecoded = useCallback(
    (rawValue: string) => {
      let scanned: URL;
      try {
        scanned = new URL(rawValue, window.location.origin);
      } catch {
        toast({ title: t("pos.qrScannerInvalidCode"), tone: "error" });
        return;
      }

      // ตารางจริง (ສ້າງ QR ໂຕະ) เข้ารหัสเป็น /q/<token> (short link, redirect ผ่าน
      // next.config.ts) ไม่ใช่ /pos?t=... — ต้องรองรับทั้งสองแบบ
      const shortLinkMatch = scanned.pathname.match(/^\/q\/([^/]+)\/?$/);
      const scannedToken =
        (shortLinkMatch?.[1] ? decodeURIComponent(shortLinkMatch[1]) : "") ||
        scanned.searchParams.get("t")?.trim() ||
        "";
      const isValidOrderToken =
        scanned.origin === window.location.origin &&
        scannedToken.length > 0 &&
        !isBranchMenuQrToken(scannedToken) &&
        scannedToken !== currentToken;

      if (!isValidOrderToken) {
        toast({ title: t("pos.qrScannerInvalidCode"), tone: "error" });
        return;
      }

      applyScannedToken(scannedToken, scanned.searchParams.get("lang"));
    },
    [applyScannedToken, currentToken, t, toast],
  );

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    let scanner: QrScanner | null = null;

    async function start() {
      if (nativeApp) {
        setStatus("requestingPermission");
        try {
          const { Camera } = await import("@capacitor/camera");
          const permission = await Camera.requestPermissions({ permissions: ["camera"] });
          if (permission.camera !== "granted" && permission.camera !== "limited") {
            if (!cancelled) {
              setStatus("error");
              toast({ title: t("pos.qrScannerPermissionDenied"), tone: "error" });
            }
            return;
          }
        } catch {
          // ไม่ใช่ Android/plugin ใช้ไม่ได้ (เช่น Electron) — ปล่อยให้ getUserMedia ขอสิทธิ์เอง
        }
      }

      if (cancelled || !videoRef.current) return;
      setStatus("starting");

      const { default: QrScannerCtor } = await import("qr-scanner");
      if (cancelled || !videoRef.current) return;

      scanner = new QrScannerCtor(
        videoRef.current,
        (result) => handleDecoded(result.data),
        {
          preferredCamera: "environment",
          highlightScanRegion: true,
          highlightCodeOutline: true,
          returnDetailedScanResult: true,
        },
      );

      try {
        await scanner.start();
        if (!cancelled) setStatus("scanning");
      } catch {
        if (!cancelled) {
          setStatus("error");
          toast({ title: t("pos.qrScannerCameraUnavailable"), tone: "error" });
        }
      }
    }

    void start();

    return () => {
      cancelled = true;
      scanner?.stop();
      scanner?.destroy();
    };
  }, [handleDecoded, nativeApp, open, t, toast]);

  return {
    qrOrderScannerOpen: open,
    qrOrderScannerStatus: status,
    qrOrderScannerVideoRef: videoRef,
    openQrOrderScanner: openScanner,
    closeQrOrderScanner: closeScanner,
  };
}
