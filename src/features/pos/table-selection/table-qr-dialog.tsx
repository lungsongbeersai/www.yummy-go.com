"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { Copy, Download, ExternalLink, Printer, QrCode as QrCodeIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { CreateTableQRResponse, PosTable } from "@/services/pos";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { usePosStore } from "@/stores/pos-store";
import { usePrinterStore } from "@/stores/printer-store";
import { useToastStore } from "@/stores/toast-store";
import { optionalString } from "./utils";

const localQrTargetUrl = "http://localhost:3001/sales/open-table-sale";
const productionQrOrigin = "https://yummy-go.com";

export function TableQrDialog({
  onOpenChange,
  open,
  table
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  table: PosTable;
}) {
  const { t } = useTranslation();
  const language = useAppStore((state) => state.language);
  const loginUuid = useAuthStore((state) => state.user?.uuid);
  const createTableQr = usePosStore((state) => state.createTableQr);
  const printTableQr = usePrinterStore((state) => state.printTableQr);
  const showToast = useToastStore((state) => state.show);
  const [pending, setPending] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [response, setResponse] = useState<CreateTableQRResponse | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const targetUrl = useMemo(() => tableQrTargetUrl(response, table), [response, table]);
  const qrImageUrl = useMemo(() => tableQrImageUrl(response), [response]);
  const previewUrl = qrImageUrl || qrDataUrl;
  const printJob = useMemo(() => tableQrPrintJob(response), [response]);
  const canUseFrontendQrFallback = Boolean(targetUrl && !printJob);
  const canDownload = Boolean(previewUrl || canUseFrontendQrFallback);
  const canPrint = Boolean(printJob || previewUrl || canUseFrontendQrFallback);

  useEffect(() => {
    if (!open) return;

    let ignore = false;
    setPending(true);
    setResponse(null);
    setQrDataUrl("");

    if (!loginUuid) {
      showToast({ title: t("pos.qrCreateFailed"), description: "login_uuid_fk is required", tone: "error" });
      setPending(false);
      return;
    }

    createTableQr({ table_uuid: table.table_uuid, lang: language, login_uuid_fk: loginUuid })
      .then((result) => {
        if (ignore) return;
        setResponse(result);
        showToast({ title: t("pos.qrCreated"), tone: "success" });
      })
      .catch((error) => {
        if (ignore) return;
        showToast({
          title: t("pos.qrCreateFailed"),
          description: error instanceof Error ? error.message : "",
          tone: "error"
        });
      })
      .finally(() => {
        if (!ignore) setPending(false);
      });

    return () => {
      ignore = true;
    };
  }, [createTableQr, language, loginUuid, open, showToast, table.table_uuid, t]);

  useEffect(() => {
    if (!targetUrl || qrImageUrl || printJob) {
      setQrDataUrl("");
      return;
    }

    let ignore = false;
    createFallbackQrDataUrl(targetUrl)
      .then((dataUrl) => {
        if (!ignore) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (!ignore) setQrDataUrl("");
      });

    return () => {
      ignore = true;
    };
  }, [printJob, qrImageUrl, targetUrl]);

  async function copyLink() {
    if (!targetUrl) return;
    await navigator.clipboard.writeText(targetUrl);
    showToast({ title: t("dashboard.copied"), tone: "success" });
  }

  async function downloadQr() {
    const imageUrl = await fallbackPrintImageUrl();
    if (!imageUrl) return;

    const anchor = document.createElement("a");
    anchor.href = imageUrl;
    anchor.download = `${table.table_name || "table"}-qr.png`;
    anchor.rel = "noopener noreferrer";
    anchor.click();
  }

  function openMenu() {
    if (!targetUrl) return;
    window.open(targetUrl, "_blank", "noopener,noreferrer");
  }

  async function printQr() {
    if (!canPrint || printing) return;

    setPrinting(true);
    try {
      if (printJob) {
        try {
          await printTableQr(printJob);
          showToast({ title: t("pos.printQr"), tone: "success" });
          return;
        } catch (error) {
          if (previewUrl && isAgentContactError(error)) {
            openFallbackPrintWindow();
            return;
          }

          if (isAgentContactError(error)) {
            const imageUrl = await fallbackPrintImageUrl();
            if (imageUrl) {
              openFallbackPrintWindow(imageUrl);
              return;
            }
          }

          showToast({
            title: t("report.printFailed"),
            description: error instanceof Error ? error.message : "",
            tone: "error"
          });
          return;
        }
      }

      const imageUrl = await fallbackPrintImageUrl();
      if (imageUrl) openFallbackPrintWindow(imageUrl);
    } finally {
      setPrinting(false);
    }
  }

  async function fallbackPrintImageUrl() {
    if (previewUrl) return previewUrl;
    if (!targetUrl) return null;

    try {
      const dataUrl = await createFallbackQrDataUrl(targetUrl);
      setQrDataUrl(dataUrl);
      return dataUrl;
    } catch {
      return null;
    }
  }

  function openFallbackPrintWindow(imageUrl = previewUrl) {
    if (!imageUrl) return;
    const printWindow = window.open("", "_blank", "width=320,height=520");
    if (!printWindow) return;

    const safeTableName = escapeHtml(table.table_name);
    const safeImage = escapeAttribute(imageUrl);
    printWindow.document.write(`<!doctype html>
<html>
  <head>
    <title>${safeTableName} QR</title>
    <style>
      @page { size: 57mm 90mm; margin: 0; }
      * { box-sizing: border-box; }
      html, body { width: 57mm; min-height: 90mm; margin: 0; }
      body { font-family: Arial, sans-serif; color: #111; text-align: center; }
      .paper { width: 57mm; min-height: 90mm; padding: 4mm 3mm; }
      .table { font-size: 14pt; font-weight: 800; line-height: 1.1; margin: 0 0 2mm; }
      img { width: 46mm; height: 46mm; object-fit: contain; margin: 0 auto 2mm; }
      @media print {
        html, body, .paper { width: 57mm; min-height: 90mm; }
      }
    </style>
  </head>
  <body>
    <main class="paper">
      <p class="table">${safeTableName}</p>
      <img src="${safeImage}" alt="${safeTableName} QR" />
    </main>
    <script>
      window.addEventListener("load", () => {
        window.focus();
        window.print();
      });
    </script>
  </body>
</html>`);
    printWindow.document.close();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-[520px]">
        <DialogHeader className="px-5 pb-3 pt-5 pr-12">
          <DialogTitle className="text-xl font-black leading-6">{t("pos.createTableQr")}</DialogTitle>
          <DialogDescription>{t("pos.tableQrDescription", { table: table.table_name })}</DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-5 pb-5">
          <div className="grid place-items-center rounded-2xl border border-border bg-muted/30 p-4 shadow-inner">
            {pending ? (
              <Skeleton className="size-[232px] rounded-xl sm:size-[260px]" />
            ) : previewUrl ? (
              <Image src={previewUrl} alt={`${table.table_name} QR`} width={260} height={260} unoptimized className="size-[232px] rounded-xl bg-background object-contain p-2 shadow-sm sm:size-[260px]" />
            ) : (
              <div className="grid size-[232px] place-items-center rounded-xl bg-muted text-muted-foreground sm:size-[260px]">
                <QrCodeIcon />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="table-qr-url" className="text-sm font-black text-foreground">
              {t("pos.openMenu")}
            </label>
            <div className="grid grid-cols-[minmax(0,1fr)_44px] gap-2">
              <Input id="table-qr-url" readOnly className="h-11 rounded-xl font-semibold" value={targetUrl ?? t("pos.qrLinkUnavailable")} />
              <TooltipProvider>
                <IconActionButton
                  label={t("pos.copyQrLink")}
                  disabled={!targetUrl || pending}
                  onClick={() => void copyLink()}
                >
                  <Copy />
                </IconActionButton>
              </TooltipProvider>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-border bg-muted/30 p-3 sm:p-4">
          <TooltipProvider>
            <div className="grid w-full grid-cols-[44px_44px_minmax(0,1fr)] gap-2">
              <IconActionButton label={t("pos.downloadQr")} disabled={!canDownload || pending} onClick={() => void downloadQr()}>
                <Download />
              </IconActionButton>
              <IconActionButton label={t("pos.printQr")} disabled={!canPrint || pending || printing} onClick={() => void printQr()}>
                {printing ? <Spinner /> : <Printer />}
              </IconActionButton>
              <Button type="button" className="h-11 min-w-0 rounded-xl px-4 font-black" disabled={!targetUrl || pending} onClick={openMenu}>
              {pending ? <Spinner data-icon="inline-start" /> : <ExternalLink data-icon="inline-start" />}
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
  onClick
}: {
  children: ReactNode;
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

function tableQrTargetUrl(response: CreateTableQRResponse | null, table: PosTable) {
  if (!response) return null;

  const backendUrl = optionalString(response.qr_url, response.public_url, response.menu_url, response.link, response.url);
  if (backendUrl && !looksLikeImageUrl(backendUrl)) return normalizePublicUrl(backendUrl);

  const tableUuid = optionalString(response.table_uuid, table.table_uuid);
  const tableName = optionalString(response.table_name, table.table_name);
  const token = optionalString(response.table_token, response.token, response.qr_token, response.t);

  if (!isLocalBrowser() && token) return `${productionQrOrigin}/q/${encodeURIComponent(token)}`;

  const url = new URL(tableQrTargetBaseUrl());
  if (tableUuid) url.searchParams.set("table_uuid", tableUuid);
  if (tableName) url.searchParams.set("table_name", tableName);
  if (token) url.searchParams.set("t", token);

  return tableUuid || token ? url.toString() : null;
}

function tableQrImageUrl(response: CreateTableQRResponse | null) {
  if (!response) return null;

  const imageUrl = optionalString(response.qr_image, response.image_url);
  if (imageUrl && looksLikeImageUrl(imageUrl)) return normalizePublicUrl(imageUrl);

  const printImageUrl = tableQrPrintImageUrl(response);
  if (printImageUrl) return printImageUrl;

  const qrUrl = optionalString(response.qr_url);
  if (qrUrl && looksLikeImageUrl(qrUrl)) return normalizePublicUrl(qrUrl);

  return null;
}

function tableQrPrintImageUrl(response: CreateTableQRResponse | null) {
  const ops = response?.print_job?.payload?.job?.ops;
  if (!Array.isArray(ops)) return null;

  for (const op of ops) {
    if (op.type !== "qr") continue;
    const source = optionalString(op.data, op.text, op.src, op.image, op.qr_image);
    if (source && looksLikeImageUrl(source)) return normalizePublicUrl(source);
  }

  return null;
}

function tableQrPrintJob(response: CreateTableQRResponse | null) {
  const agentJob = response?.print_job?.payload?.job;
  if (agentJob && Array.isArray(agentJob.ops) && agentJob.ops.length) {
    return agentJob;
  }

  return null;
}

function tableQrTargetBaseUrl() {
  return isLocalBrowser() ? localQrTargetUrl : `${productionQrOrigin}/pos`;
}

function isLocalBrowser() {
  if (typeof window === "undefined") return false;
  return ["localhost", "127.0.0.1"].includes(window.location.hostname);
}

function isAgentContactError(error: unknown) {
  const record = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const code = optionalString(record.code)?.toUpperCase();
  const message = optionalString(record.message)?.toLowerCase() ?? "";

  return (
    Boolean(code && ["ECONNABORTED", "ECONNREFUSED", "ERR_NETWORK", "ETIMEDOUT"].includes(code)) ||
    message.includes("network error") ||
    message.includes("timeout") ||
    message.includes("failed to fetch")
  );
}

function createFallbackQrDataUrl(value: string) {
  return QRCode.toDataURL(value, { errorCorrectionLevel: "M", margin: 1, width: 320 });
}

function normalizePublicUrl(value: string) {
  if (/^https?:\/\//i.test(value) || value.startsWith("data:")) return value;
  if (typeof window === "undefined") return value;
  if (value.startsWith("/")) return `${window.location.origin}${value}`;
  return `${window.location.origin}/${value.replace(/^\/+/, "")}`;
}

function looksLikeImageUrl(value: string) {
  return value.startsWith("data:image/") || /\.(png|jpe?g|webp|gif|svg)(\?|#|$)/i.test(value);
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

function escapeAttribute(value: string) {
  return escapeHtml(value);
}
