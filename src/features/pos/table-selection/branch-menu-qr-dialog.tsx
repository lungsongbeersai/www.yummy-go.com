"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { Copy, Download, ExternalLink, Minus, Plus, Printer, QrCode as QrCodeIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { fullscreenPrintWindowFeatures, maximizePrintWindow } from "@/services/printer/invoice-print-window";
import { useIsCapacitorNativeApp } from "@/hooks/use-capacitor-native-app";
import { useResetOnChange, useResetOnDeps } from "@/hooks/use-reset-on-change";
import { openWindowOutsideNativeApp } from "@/lib/capacitor-platform";
import { optionalString } from "@/lib/values";
import {
  WINDOW_OPEN_FONT_CLASS_NAME,
  WINDOW_OPEN_FONT_STYLESHEET_LINK,
  WINDOW_OPEN_PRINT_ON_LOAD_SCRIPT,
} from "@/lib/window-open-fonts";
import type { BranchMenuQRResponse } from "@/services/pos";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { usePosStore } from "@/stores/pos-store";
import { usePrinterStore } from "@/stores/printer-store";
<<<<<<< HEAD
import { useAuthStore } from "@/stores/auth-store";
import {
  resolveTableQrPrinterContext,
  tableQrPendingJobUuid,
  tableQrPrintOutcome,
} from "./table-qr-printing";
=======
>>>>>>> feature-73
import { useToastStore } from "@/stores/toast-store";
import { resolveTableQrPrinterContext, tableQrPrintOutcome } from "./table-qr-printing";

<<<<<<< HEAD
// ระดับสาขา ไม่ผูกโต๊ะ — พิมพ์ผ่านคิวเครื่องพิมพ์ role q-001 เดียวกับ TableQrDialog
// (document_type qr_table ตัวเดียวกัน ใบที่ออกมาจึงหน้าตาเหมือนกัน ต่างแค่ footer)
// ไม่มี qr_ver ให้ revoke จึงไม่มี regenerate ทุกครั้งที่เปิด แค่ขอ token เดิมซ้ำก็ยังใช้ได้
=======
const MIN_PRINT_COPIES = 1;
const MAX_PRINT_COPIES = 20;

// ระดับสาขา ไม่ผูกโต๊ะ ไม่มี qr_ver ให้ revoke จึงไม่ต้อง regenerate token ทุกครั้ง
// ที่เปิด (แค่ขอ token เดิมซ้ำก็ยังใช้ได้) แต่คิวพิมพ์จริง (print_job/pending_query)
// ใช้ pattern เดียวกับ TableQrDialog ทุกอย่าง (P-72) — ต้องมี device_code/agent_id
// ไปด้วย ไม่งั้น backend คืน print_job: null พร้อม fallback_print แทน
>>>>>>> feature-73
export function BranchMenuQrDialog({
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const { t } = useTranslation();
  const language = useAppStore((state) => state.language);
  const loginUuid = useAuthStore((state) => state.user?.uuid);
  const createBranchMenuQr = usePosStore((state) => state.createBranchMenuQr);
<<<<<<< HEAD
  const loginUuid = useAuthStore((state) => state.user?.uuid);
=======
>>>>>>> feature-73
  const executeInvoice = usePrinterStore((state) => state.executeInvoice);
  const resolveDeviceContext = usePrinterStore((state) => state.resolveDeviceContext);
  const resolveDeviceIdentity = usePrinterStore((state) => state.resolveDeviceIdentity);
  const showToast = useToastStore((state) => state.show);
  const nativeApp = useIsCapacitorNativeApp();
  const [pending, setPending] = useState(false);
  const [response, setResponse] = useState<BranchMenuQRResponse | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [printing, setPrinting] = useState(false);
  const [printCopies, setPrintCopies] = useState(MIN_PRINT_COPIES);
  const targetUrl = response?.qr_url ?? null;
  const pendingJobUuid = branchMenuQrPendingJobUuid(response);
  const canOpenBrowserWindow = !nativeApp;
  const canDownload = Boolean(qrDataUrl);
<<<<<<< HEAD
  const pendingJobUuid = useMemo(() => tableQrPendingJobUuid(response), [response]);
  // A queued job prints without a browser window, so a native app can still print.
=======
>>>>>>> feature-73
  const canPrint = Boolean(pendingJobUuid || (qrDataUrl && canOpenBrowserWindow));

  // เปิด dialog = ล้างผลเดิม แล้วค่อยขอ token ใหม่ (ไม่มี qr_ver ให้ revoke จึง
  // ไม่จำเป็นต้อง regenerate ทุกครั้ง แต่ขอซ้ำเพื่อความสด/ง่ายต่อการดีบัก)
  useResetOnChange(open, () => {
    if (!open) return;
    setResponse(null);
    setQrDataUrl("");
    setPrintCopies(MIN_PRINT_COPIES);
    setPending(Boolean(loginUuid));
  });

  useEffect(() => {
    if (!open) return;

    if (!loginUuid) {
      showToast({ title: t("pos.qrCreateFailed"), description: "login_uuid_fk is required", tone: "error" });
      return;
    }

    const activeLoginUuid = loginUuid;
    let ignore = false;

<<<<<<< HEAD
    // Backend has to know the device/agent of whoever pressed print before it can
    // queue the job; without it the menu QR comes back as a browser fallback even
    // where Auto Print is set up.
    async function createMenuQrWithPrinterContext() {
=======
    async function createQrWithPrinterContext() {
      // เหตุผลเดียวกับ TableQrDialog — backend ต้องรู้ device/agent ของผู้กดพิมพ์
      // ก่อนสร้างคิว มิฉะนั้นจะคืน browser fallback แม้มี Auto Print อยู่จริง
>>>>>>> feature-73
      const printerContext = await resolveTableQrPrinterContext({
        loginUuid: activeLoginUuid,
        resolveDeviceContext,
        resolveDeviceIdentity,
      });

      return createBranchMenuQr({
        lang: language,
        login_uuid_fk: activeLoginUuid,
        device_code: printerContext?.device_code,
        agent_id: printerContext?.agent_id,
        print_mode: printerContext?.print_mode,
<<<<<<< HEAD
      });
    }

    createMenuQrWithPrinterContext()
=======
        print: printCopies,
      });
    }

    createQrWithPrinterContext()
>>>>>>> feature-73
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
  }, [
    createBranchMenuQr,
    language,
    loginUuid,
    open,
<<<<<<< HEAD
=======
    printCopies,
>>>>>>> feature-73
    resolveDeviceContext,
    resolveDeviceIdentity,
    showToast,
    t,
  ]);

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

<<<<<<< HEAD
  // Same contract as TableQrDialog: when Backend queued a real job, run it through
  // the printer store and only fall back to the browser window if that job cannot
  // reach a printer. Falling straight to the window would ignore an Auto Print
  // printer the branch already has mapped for its table QR.
  async function printQr() {
    if (!canPrint || printing) return;

    setPrinting(true);
    try {
      if (pendingJobUuid) {
        try {
          const printResult = await executeInvoice({
            print_job: response?.print_job,
            pending_query: response?.pending_query,
            login_uuid_fk: loginUuid,
          });

          const printOutcome = tableQrPrintOutcome(printResult);
          if (printOutcome === "pending") {
            showToast({
              title: t("pos.printQr"),
              description: t("orderQueue.kitchenPrintQueued"),
              tone: "info",
            });
            return;
          }
          if (printOutcome !== "fallback") {
            showToast({ title: t("pos.printQr"), tone: "success" });
            return;
          }
        } catch (error) {
          showToast({
            title: t("pos.printQr"),
            description: error instanceof Error ? error.message : "",
            tone: "info",
          });
        }
      }

      if (!canOpenBrowserWindow) {
        showToast({
          title: t("pos.printQr"),
          description: t("pos.invoicePrintPopupBlocked"),
          tone: "error",
        });
        return;
      }

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
=======
  function openFallbackPrintWindow() {
    if (!qrDataUrl) return;
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
>>>>>>> feature-73
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
  }

  // เหมือน TableQrDialog.printQr() ทุกอย่าง — มี pendingJobUuid = ยิงเข้าคิวเครื่องพิมพ์
  // จริงผ่าน executeInvoice, ไม่มี (หรือคิวล้มเหลว) = fallback เป็นหน้าต่างพิมพ์จาก browser
  async function printQr() {
    if (!canPrint || printing) return;

    setPrinting(true);
    try {
      if (pendingJobUuid) {
        try {
          const printResult = await executeInvoice({
            print_job: response?.print_job ?? undefined,
            pending_query: response?.pending_query,
            login_uuid_fk: loginUuid,
          });

          const printOutcome = tableQrPrintOutcome(printResult);
          if (printOutcome === "pending") {
            showToast({
              title: t("pos.printQr"),
              description: t("orderQueue.kitchenPrintQueued"),
              tone: "info",
            });
            return;
          }

          if (printOutcome === "fallback") {
            if (canOpenBrowserWindow) {
              openFallbackPrintWindow();
              showToast({ title: t("pos.printQr"), tone: "info" });
            } else {
              showToast({
                title: t("pos.printQr"),
                description: t("pos.invoicePrintPopupBlocked"),
                tone: "error",
              });
            }
            return;
          }

          showToast({ title: t("pos.printQr"), tone: "success" });
        } catch (error) {
          if (canOpenBrowserWindow) {
            openFallbackPrintWindow();
            showToast({
              title: t("pos.printQr"),
              description: error instanceof Error ? error.message : "",
              tone: "info",
            });
          } else {
            showToast({
              title: t("pos.printQr"),
              description: error instanceof Error ? error.message : t("pos.invoicePrintPopupBlocked"),
              tone: "error",
            });
          }
        }
        return;
      }

      if (canOpenBrowserWindow) openFallbackPrintWindow();
    } finally {
      setPrinting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] gap-0 overflow-hidden p-0 duration-200 sm:max-w-130">
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

          <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
            <Label htmlFor="branch-menu-qr-print-copies" className="text-sm font-black text-foreground">
              {t("pos.printCopies")}
            </Label>
            <div
              id="branch-menu-qr-print-copies"
              className="flex h-10 items-center overflow-hidden rounded-full border border-primary/50 bg-primary/5"
            >
              <Button
                type="button"
                aria-label={`${t("pos.printCopies")} -`}
                size="icon-sm"
                variant="ghost"
                className="size-9 rounded-full bg-primary/10 text-primary hover:bg-primary/20"
                disabled={pending || printCopies <= MIN_PRINT_COPIES}
                onClick={() => setPrintCopies((copies) => Math.max(MIN_PRINT_COPIES, copies - 1))}
              >
                <Minus className="size-3.5" />
              </Button>
              <span className="min-w-8 text-center text-sm font-black text-primary tabular-nums">
                {printCopies}
              </span>
              <Button
                type="button"
                aria-label={`${t("pos.printCopies")} +`}
                size="icon-sm"
                variant="ghost"
                className="size-9 rounded-full bg-primary/10 text-primary hover:bg-primary/20"
                disabled={pending || printCopies >= MAX_PRINT_COPIES}
                onClick={() => setPrintCopies((copies) => Math.min(MAX_PRINT_COPIES, copies + 1))}
              >
                <Plus className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-border bg-muted/30 p-3 sm:p-4">
          <TooltipProvider>
            <div className="grid w-full grid-cols-[44px_44px_minmax(0,1fr)] gap-2">
              <IconActionButton label={t("pos.downloadQr")} disabled={!canDownload || pending} onClick={downloadQr}>
                <Download />
              </IconActionButton>
              <IconActionButton label={t("pos.printQr")} disabled={!canPrint || pending || printing} onClick={() => void printQr()}>
                {printing ? <Spinner /> : <Printer />}
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

function branchMenuQrPendingJobUuid(response: BranchMenuQRResponse | null) {
  return (
    optionalString(response?.pending_query?.print_job_uuid) ??
    optionalString(response?.print_job?.print_job_uuid) ??
    ""
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
