"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useResetOnChange, useResetOnDeps } from "@/hooks/use-reset-on-change";
import QRCode from "qrcode";
import { Copy, Download, ExternalLink, Printer } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PrintLoadingDialog } from "@/components/common/print-loading-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { useIsCapacitorNativeApp } from "@/hooks/use-capacitor-native-app";
import { openWindowOutsideNativeApp } from "@/lib/capacitor-platform";
import { copyTextToClipboard } from "@/lib/clipboard";
import { useExportCurrent } from "@/hooks/use-export-current";
import { saveExportFile } from "@/lib/export/file-output";
import { imageExportFile } from "@/lib/export/image-file";
import type { CreateTableQRResponse, PosTable } from "@/services/pos";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { usePosStore } from "@/stores/pos-store";
import { usePrinterStore } from "@/stores/printer-store";
import { useToastStore } from "@/stores/toast-store";
import { createQrPrintRound, tableQrPendingJobUuid, tableQrPrintAttemptResponse, tableQrPrintOutcome } from "./table-qr-printing";
import { optionalString } from "./utils";
import { QrPrintPreview } from "./qr-print-preview";

const localQrTargetUrl = "http://localhost:3001/posAll/tables";
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
  const executeInvoice = usePrinterStore((state) => state.executeInvoice);
  const showToast = useToastStore((state) => state.show);
  const nativeApp = useIsCapacitorNativeApp();
  const [pending, setPending] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [printPending, setPrintPending] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [response, setResponse] = useState<CreateTableQRResponse | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const targetUrl = useMemo(() => tableQrTargetUrl(response, table), [response, table]);
  const qrImageUrl = useMemo(() => tableQrImageUrl(response), [response]);
  const previewUrl = qrImageUrl || qrDataUrl;
  const pendingJobUuid = useMemo(() => tableQrPendingJobUuid(response), [response]);
  const canDownload = Boolean(previewUrl || targetUrl);
  const canPrint = Boolean(pendingJobUuid || previewUrl || targetUrl);
  const exportCurrent = useExportCurrent(JSON.stringify([open, table.table_uuid, targetUrl, previewUrl]));
  const printCurrent = useExportCurrent(JSON.stringify([open, table.table_uuid, language, loginUuid]));
  const printRound = useMemo(() => createQrPrintRound<CreateTableQRResponse>(undefined, printCurrent), [printCurrent]);

  const requestQr = useCallback(async (print: 0 | 1, isCurrent: () => boolean = () => true, operationUuid?: string) => {
    if (!loginUuid) throw new Error("login_uuid_fk is required");
    if (!isCurrent()) throw new DOMException("QR print cancelled", "AbortError");

    // The POS store resolves and registers the live requester once. Backend
    // selects its configured QR printer without another catalogue lookup here.
    return createTableQr({
      table_uuid: table.table_uuid,
      lang: language,
      login_uuid_fk: loginUuid,
      print,
      ...(print > 0 && operationUuid ? { operation_uuid: operationUuid } : {}),
    });
  }, [
    createTableQr,
    language,
    loginUuid,
    table.table_uuid,
  ]);

  useResetOnChange(printCurrent, () => {
    setPrinting(false);
    setPrintPending(false);
  });

  // เปิด dialog = ล้างผลเดิม และตั้ง pending เฉพาะกรณีที่จะยิงคำขอจริง
  useResetOnChange(open, () => {
    if (!open) return;
    setResponse(null);
    setQrDataUrl("");
    setPending(Boolean(loginUuid));
  });

  useEffect(() => {
    if (!open) return;

    if (!loginUuid) {
      showToast({ title: t("pos.qrCreateFailed"), description: "login_uuid_fk is required", tone: "error" });
      return;
    }

    let ignore = false;

    // เปิด modal มีหน้าที่สร้าง/แสดง QR เท่านั้น ห้ามสร้าง print job
    requestQr(0)
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
  }, [
    loginUuid,
    open,
    requestQr,
    showToast,
    t,
  ]);

  // มีรูป QR จากเซิร์ฟเวอร์แล้ว (หรือยังไม่มี URL) = ไม่ต้องใช้ fallback ที่สร้างเอง
  useResetOnDeps([targetUrl, qrImageUrl], () => {
    if (!targetUrl || qrImageUrl) setQrDataUrl("");
  });

  useEffect(() => {
    if (!targetUrl || qrImageUrl) return;

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
  }, [qrImageUrl, targetUrl]);

  async function copyLink() {
    if (!targetUrl) return;
    const copied = await copyTextToClipboard(targetUrl);
    showToast({ title: t(copied ? "dashboard.copied" : "pos.qrCopyFailed"), tone: copied ? "success" : "error" });
  }

  async function downloadQr() {
    if (downloading || !exportCurrent()) return;
    const isCurrent = exportCurrent;
    setDownloading(true);
    try {
      const imageUrl = await fallbackPrintImageUrl();
      if (!imageUrl || !isCurrent()) return;
      const file = await imageExportFile(imageUrl, `${table.table_name || "table"}-qr.png`, isCurrent);
      await saveExportFile(file, { isCurrent });
    } catch (error) {
      if (isCurrent() && !(error instanceof Error && error.name === "AbortError")) {
        showToast({ title: t("report.exportFailed"), description: error instanceof Error ? error.message : "", tone: "error" });
      }
    } finally { setDownloading(false); }
  }

  function openMenu() {
    if (!targetUrl) return;
    const opened = openWindowOutsideNativeApp(
      targetUrl,
      "_blank",
      "noopener,noreferrer",
    );
    if (!opened) {
      showToast({
        title: t("pos.qrLinkUnavailable"),
        description: t("pos.invoicePrintPopupBlocked"),
        tone: "info",
      });
    }
  }

  async function printQr() {
    const isCurrent = printCurrent;
    if (!canPrint || printing || !isCurrent()) return;
    const attempt = printRound.begin();
    if (!attempt) return;

    setPrinting(true);
    setPrintPending(true);
    try {
      const printResponse = await tableQrPrintAttemptResponse({
        refreshQueue: !attempt.response,
        requestQueue: () => requestQr(1, isCurrent, attempt.operationUuid),
        response: attempt.response,
        isCurrent,
      });
      setResponse(printResponse);

      if (!printResponse || !tableQrPendingJobUuid(printResponse)) {
        showToast({
          title: t("pos.printQr"),
          description: t("pos.systemPrinterUnavailable"),
          tone: "error",
          action: {
            label: t("actions.tryAgain"),
            onClick: () => void printQr(),
          },
        });
        return;
      }
      attempt.remember(printResponse);
      setPrintPending(true);

      const printResult = await executeInvoice({
        print_job: printResponse?.print_job ?? undefined,
        pending_query: printResponse?.pending_query ?? undefined,
        login_uuid_fk: loginUuid,
      });
      if (!isCurrent()) return;

      const printOutcome = tableQrPrintOutcome(printResult, attempt.copies);
      attempt.settle(printOutcome);
      setPrintPending(printOutcome === "pending");
      if (printOutcome === "pending") {
        showToast({
          title: t("pos.printQr"),
          description: t("pos.documentPrintQueued"),
          tone: "info",
          action: { label: t("pos.paidReceiptCheckStatus"), onClick: () => void printQr() },
        });
        return;
      }

      if (printOutcome === "error") {
        showToast({
          title: t("pos.printQr"),
          description: printResult.errorMessage || t("pos.qrPrintIncomplete", {
            printed: printResult.successCount, total: Math.max(printResult.total, attempt.copies),
          }),
          tone: "error",
          action: {
            label: t("pos.manualReprint"),
            onClick: () => void printQr(),
          },
        });
        return;
      }

      showToast({ title: t("common.printSuccess"), tone: "success" });
    } catch (error) {
      if (!isCurrent() || (error instanceof Error && error.name === "AbortError")) return;
      showToast({
        title: t("pos.printQr"),
        description: error instanceof Error ? error.message : t("pos.systemPrinterUnavailable"),
        tone: "error",
        action: {
          label: t("actions.tryAgain"),
          onClick: () => void printQr(),
        },
      });
    } finally {
      attempt.release();
      if (isCurrent()) setPrinting(false);
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


  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[calc(100dvh-2rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 duration-200 sm:max-w-130">
        <DialogHeader className="gap-2 px-5 pb-5 pt-5 pr-12 text-left">
          <DialogTitle className="text-xl font-bold leading-6">{t("pos.createTableQr")}</DialogTitle>
          <DialogDescription>{t("pos.tableQrDescription", { table: table.table_name })}</DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto overscroll-contain px-5 pb-5 [&>*]:shrink-0">
          <QrPrintPreview
            title={`${t("nav.table")}: ${table.table_name}`}
            caption={t("pos.scanQrToOrder")}
            imageUrl={previewUrl}
            loading={pending}
          />

          <Field className="gap-2">
            <FieldLabel htmlFor="table-qr-url">{t("pos.menuLink")}</FieldLabel>
            <InputGroup className="h-10">
              <InputGroupInput
                id="table-qr-url"
                readOnly
                className="text-sm text-muted-foreground"
                value={targetUrl ?? t("pos.qrLinkUnavailable")}
                onFocus={(event) => event.currentTarget.select()}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  aria-label={t("pos.copyQrLink")}
                  title={t("pos.copyQrLink")}
                  size="icon-sm"
                  disabled={!targetUrl || pending}
                  onClick={() => void copyLink()}
                >
                  <Copy />
                </InputGroupButton>
                {/* เปิดดูเมนูจริงเป็นงานรอง (ตรวจลิงก์) — ไว้ข้างลิงก์ ไม่แย่งที่ปุ่มพิมพ์ */}
                <InputGroupButton
                  aria-label={t("pos.openMenu")}
                  title={t("pos.openMenu")}
                  size="icon-sm"
                  disabled={!targetUrl || pending || nativeApp}
                  onClick={openMenu}
                >
                  <ExternalLink />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </Field>
        </div>

        {/* งานหลักของหน้านี้คือ "พิมพ์ QR" ไปแปะโต๊ะ — ปุ่มหลักจึงเป็นพิมพ์ ดาวน์โหลดเป็นทางเลือกรอง */}
        <DialogFooter className="grid grid-cols-2 gap-2 border-t border-border p-4 sm:flex sm:justify-end">
          <Button type="button" size="lg" variant="outline" disabled={!canDownload || pending || downloading} onClick={() => void downloadQr()}>
            <Download data-icon="inline-start" />
            {t("pos.downloadQr")}
          </Button>
          <Button type="button" size="lg" className="h-auto min-h-11 min-w-0 whitespace-normal" disabled={!canPrint || pending || printing} onClick={() => void printQr()}>
            {printing ? <Spinner data-icon="inline-start" /> : <Printer data-icon="inline-start" />}
            {t(printPending ? "pos.paidReceiptCheckStatus" : "pos.printQr")}
          </Button>
        </DialogFooter>
        </DialogContent>
      </Dialog>
      <PrintLoadingDialog open={printing} />
    </>
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

  const qrUrl = optionalString(response.qr_url);
  if (qrUrl && looksLikeImageUrl(qrUrl)) return normalizePublicUrl(qrUrl);

  return null;
}

function tableQrTargetBaseUrl() {
  return isLocalBrowser() ? localQrTargetUrl : `${productionQrOrigin}/posAll`;
}

function isLocalBrowser() {
  if (typeof window === "undefined") return false;
  return ["localhost", "127.0.0.1"].includes(window.location.hostname);
}

function createFallbackQrDataUrl(value: string) {
  return QRCode.toDataURL(value, { errorCorrectionLevel: "M", margin: 4, width: 320 });
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
