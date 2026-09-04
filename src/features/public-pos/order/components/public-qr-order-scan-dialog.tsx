"use client";

import type { RefObject } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, Camera, Loader2, ScanLine } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PublicQrOrderScannerStatus } from "../hooks/use-public-qr-order-scanner";

// dialog เต็มจอ (แนวตั้ง) โชว์ preview กล้องสด ให้ลูกค้าเล็ง QR โต๊ะที่พนักงานถือมาให้
export function PublicQrOrderScanDialog({
  open,
  status,
  videoRef,
  onOpenChange,
}: {
  open: boolean;
  status: PublicQrOrderScannerStatus;
  videoRef: RefObject<HTMLVideoElement | null>;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const showOverlayMessage = status !== "scanning";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] gap-0 overflow-hidden p-0 duration-200 sm:max-w-110">
        <DialogHeader className="px-5 pb-3 pt-5 pr-12">
          <DialogTitle className="flex items-center gap-2 text-xl font-black leading-6">
            <ScanLine className="size-5" aria-hidden="true" />
            {t("pos.qrScannerTitle")}
          </DialogTitle>
          <DialogDescription>{t("pos.qrScannerHint")}</DialogDescription>
        </DialogHeader>

        <div className="relative mx-5 mb-5 aspect-square overflow-hidden rounded-2xl bg-muted">
          <video
            ref={videoRef}
            className="size-full object-cover"
            muted
            playsInline
          />

          {showOverlayMessage ? (
            <div className="absolute inset-0 grid place-items-center bg-background/85 px-6 text-center backdrop-blur-sm">
              <ScanOverlayMessage status={status} />
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ScanOverlayMessage({ status }: { status: PublicQrOrderScannerStatus }) {
  const { t } = useTranslation();

  if (status === "error") {
    return (
      <div className="flex flex-col items-center gap-2 text-destructive">
        <AlertCircle className="size-8" aria-hidden="true" />
        <p className="text-sm font-bold">{t("pos.qrScannerCameraUnavailable")}</p>
      </div>
    );
  }

  if (status === "requestingPermission") {
    return (
      <div className="flex flex-col items-center gap-2 text-muted-foreground">
        <Camera className="size-8" aria-hidden="true" />
        <p className="text-sm font-bold">{t("pos.qrScannerRequestingPermission")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 text-muted-foreground">
      <Loader2 className="size-8 animate-spin" aria-hidden="true" />
      <p className="text-sm font-bold">{t("pos.qrScannerStarting")}</p>
    </div>
  );
}
