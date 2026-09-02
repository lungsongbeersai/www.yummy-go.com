"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { Copy, Download, ExternalLink, Printer, QrCode as QrCodeIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { fullscreenPrintWindowFeatures, maximizePrintWindow } from "@/services/printer/invoice-print-window";
import { useIsCapacitorNativeApp } from "@/hooks/use-capacitor-native-app";
import { useResetOnChange, useResetOnDeps } from "@/hooks/use-reset-on-change";
import { openWindowOutsideNativeApp } from "@/lib/capacitor-platform";
import {
  WINDOW_OPEN_FONT_CLASS_NAME,
  WINDOW_OPEN_FONT_STYLESHEET_LINK,
  WINDOW_OPEN_PRINT_ON_LOAD_SCRIPT,
} from "@/lib/window-open-fonts";
import type { BranchMenuQRResponse } from "@/services/pos";
import { useAppStore } from "@/stores/app-store";
import { usePosStore } from "@/stores/pos-store";
import { useToastStore } from "@/stores/toast-store";

// ระดับสาขา ไม่ผูกโต๊ะ — ต่าง TableQrDialog ตรงที่ไม่มีคิวเครื่องพิมพ์จริง (ไม่มี
// pending_query/print_job) และไม่มี qr_ver ให้ revoke จึงไม่มี regenerate ทุกครั้ง
// ที่เปิด แค่ขอ token เดิมซ้ำก็ยังใช้ได้ ฉีก QR ออกมาเป็น data URL ฝั่ง client ล้วนๆ
export function BranchMenuQrDialog({
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const { t } = useTranslation();
  const language = useAppStore((state) => state.language);
  const createBranchMenuQr = usePosStore((state) => state.createBranchMenuQr);
  const showToast = useToastStore((state) => state.show);
  const nativeApp = useIsCapacitorNativeApp();
  const [pending, setPending] = useState(false);
  const [response, setResponse] = useState<BranchMenuQRResponse | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [printing, setPrinting] = useState(false);
  const targetUrl = response?.qr_url ?? null;
  const canOpenBrowserWindow = !nativeApp;
  const canDownload = Boolean(qrDataUrl);
  const canPrint = Boolean(qrDataUrl && canOpenBrowserWindow);

  // เปิด dialog = ล้างผลเดิม แล้วค่อยขอ token ใหม่ (ไม่มี qr_ver ให้ revoke จึง
  // ไม่จำเป็นต้อง regenerate ทุกครั้ง แต่ขอซ้ำเพื่อความสด/ง่ายต่อการดีบัก)
  useResetOnChange(open, () => {
    if (!open) return;
    setResponse(null);
    setQrDataUrl("");
    setPending(true);
  });

  useEffect(() => {
    if (!open) return;

    let ignore = false;

    createBranchMenuQr({ lang: language })
      .then((result) => {
        if (ignore) return;
        setResponse(result);
      })
      .catch((error) => {
        if (ignore) return;
        showToast({
          title: t("pos.qrCreateFailed"),
          description: error instanceof Error ? error.message : "",
          tone: "error",
        });
      })
      .finally(() => {
        if (!ignore) setPending(false);
      });

    return () => {
      ignore = true;
    };
  }, [createBranchMenuQr, language, open, showToast, t]);

  // targetUrl หายไป (ยังไม่มี/สร้างไม่สำเร็จ) = เคลียร์ QR เก่าทิ้งก่อน
  useResetOnDeps([targetUrl], () => {
    if (!targetUrl) setQrDataUrl("");
  });

  useEffect(() => {
    if (!targetUrl) return;

    let ignore = false;
    QRCode.toDataURL(targetUrl, { errorCorrectionLevel: "M", margin: 2, width: 320 })
      .then((dataUrl) => {
        if (!ignore) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (!ignore) setQrDataUrl("");
      });

    return () => {
      ignore = true;
    };
  }, [targetUrl]);

  async function copyLink() {
    if (!targetUrl) return;
    await navigator.clipboard.writeText(targetUrl);
    showToast({ title: t("dashboard.copied"), tone: "success" });
  }

  function downloadQr() {
    if (!qrDataUrl) return;
    const anchor = document.createElement("a");
    anchor.href = qrDataUrl;
    anchor.download = `${response?.branch_name || "menu"}-qr.png`;
    anchor.rel = "noopener noreferrer";
    anchor.click();
  }

  function openMenu() {
    if (!targetUrl) return;
    const opened = openWindowOutsideNativeApp(targetUrl, "_blank", "noopener,noreferrer");
    if (!opened) {
      showToast({
        title: t("pos.qrLinkUnavailable"),
        description: t("pos.invoicePrintPopupBlocked"),
        tone: "info",
      });
    }
  }

  function printQr() {
    if (!canPrint || printing) return;

    setPrinting(true);
    try {
      const printWindow = openWindowOutsideNativeApp("", "_blank", fullscreenPrintWindowFeatures());
      if (!printWindow) {
        showToast({
          title: t("pos.printQr"),
          description: t("pos.invoicePrintPopupBlocked"),
          tone: "error",
        });
        return;
      }
      maximizePrintWindow(printWindow);

      const safeTitle = escapeHtml(response?.branch_name || t("pos.createBranchMenuQr"));
      const safeImage = escapeHtml(qrDataUrl);
      printWindow.document.write(`<!doctype html>
<html>
  <head>
    ${WINDOW_OPEN_FONT_STYLESHEET_LINK}
    <title>${safeTitle} QR</title>
    <style>
      * { box-sizing: border-box; }
      html, body { margin: 0; }
      body { color: #111; text-align: center; padding: 16mm; }
      .title { font-size: 18pt; font-weight: 800; margin: 0 0 8mm; }
      img { width: 70mm; height: 70mm; object-fit: contain; margin: 0 auto; }
    </style>
  </head>
  <body class="${WINDOW_OPEN_FONT_CLASS_NAME}">
    <p class="title">${safeTitle}</p>
    <img src="${safeImage}" alt="${safeTitle} QR" />
    <script>${WINDOW_OPEN_PRINT_ON_LOAD_SCRIPT}</script>
  </body>
</html>`);
      printWindow.document.close();
    } finally {
      setPrinting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-hidden p-0 duration-200 sm:max-w-130">
        <DialogHeader className="px-5 pb-3 pt-5 pr-12">
          <DialogTitle className="text-xl font-black leading-6">{t("pos.createBranchMenuQr")}</DialogTitle>
          <DialogDescription>{t("pos.branchMenuQrDescription")}</DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-5 pb-5">
          <div className="grid place-items-center rounded-2xl bg-muted p-6">
            {pending ? (
              <Skeleton className="size-58 rounded-xl sm:size-65" />
            ) : qrDataUrl ? (
              <Image src={qrDataUrl} alt={`${response?.branch_name ?? ""} QR`} width={260} height={260} unoptimized className="size-58 rounded-xl bg-background object-contain p-2 sm:size-65" />
            ) : (
              <div className="grid size-58 place-items-center rounded-xl bg-background text-muted-foreground sm:size-65">
                <QrCodeIcon />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="branch-menu-qr-url" className="text-sm font-black text-foreground">
              {t("pos.openMenu")}
            </Label>
            <div className="grid grid-cols-[minmax(0,1fr)_44px] gap-2">
              <Input id="branch-menu-qr-url" readOnly className="h-11 rounded-xl font-semibold" value={targetUrl ?? t("pos.qrLinkUnavailable")} />
              <TooltipProvider>
                <IconActionButton label={t("pos.copyQrLink")} disabled={!targetUrl || pending} onClick={() => void copyLink()}>
                  <Copy />
                </IconActionButton>
              </TooltipProvider>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-border bg-muted/30 p-3 sm:p-4">
          <TooltipProvider>
            <div className="grid w-full grid-cols-[44px_44px_minmax(0,1fr)] gap-2">
              <IconActionButton label={t("pos.downloadQr")} disabled={!canDownload || pending} onClick={downloadQr}>
                <Download />
              </IconActionButton>
              <IconActionButton label={t("pos.printQr")} disabled={!canPrint || pending || printing} onClick={printQr}>
                <Printer />
              </IconActionButton>
              <Button type="button" className="h-11 min-w-0 rounded-xl px-4 font-black" disabled={!targetUrl || pending || nativeApp} onClick={openMenu}>
                <ExternalLink data-icon="inline-start" />
                <span className="truncate">{t("pos.openMenu")}</span>
              </Button>
            </div>
          </TooltipProvider>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IconActionButton({
  children,
  disabled,
  label,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" aria-label={label} size="icon" variant="outline" className="size-11 rounded-xl" disabled={disabled} onClick={onClick}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "\"":
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}
