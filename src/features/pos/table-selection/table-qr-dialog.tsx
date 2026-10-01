"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useResetOnChange, useResetOnDeps } from "@/hooks/use-reset-on-change";
import Image from "next/image";
import QRCode from "qrcode";
import { Copy, Download, ExternalLink, Printer, QrCode as QrCodeIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PrintLoadingDialog } from "@/components/common/print-loading-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useIsCapacitorNativeApp } from "@/hooks/use-capacitor-native-app";
import { openWindowOutsideNativeApp } from "@/lib/capacitor-platform";
import type { CreateTableQRResponse, PosTable } from "@/services/pos";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { usePosStore } from "@/stores/pos-store";
import { usePrinterStore } from "@/stores/printer-store";
import { useToastStore } from "@/stores/toast-store";
import { resolveTableQrPrinterContext, tableQrPendingJobUuid, tableQrPrintAttemptResponse, tableQrPrintOutcome } from "./table-qr-printing";
import { optionalString } from "./utils";

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
  const resolveDeviceContext = usePrinterStore((state) => state.resolveDeviceContext);
  const resolveDeviceIdentity = usePrinterStore((state) => state.resolveDeviceIdentity);
  const showToast = useToastStore((state) => state.show);
  const nativeApp = useIsCapacitorNativeApp();
  const [pending, setPending] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [response, setResponse] = useState<CreateTableQRResponse | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const printingRef = useRef(false);
  const retryPrintRef = useRef<() => void>(() => undefined);
  const targetUrl = useMemo(() => tableQrTargetUrl(response, table), [response, table]);
  const qrImageUrl = useMemo(() => tableQrImageUrl(response), [response]);
  const previewUrl = qrImageUrl || qrDataUrl;
  const pendingJobUuid = useMemo(() => tableQrPendingJobUuid(response), [response]);
  const canDownload = Boolean(previewUrl || targetUrl);
  const canPrint = Boolean(pendingJobUuid || previewUrl || targetUrl);

  const requestQrWithPrinterContext = useCallback(async () => {
    if (!loginUuid) throw new Error("login_uuid_fk is required");

    // Resolve the route again for an explicit retry. A failed-before-print QR
    // job is terminal, while its Shared owner may have connected afterwards.
    const printerContext = await resolveTableQrPrinterContext({
      loginUuid,
      resolveDeviceContext,
      resolveDeviceIdentity,
    });

    return createTableQr({
      table_uuid: table.table_uuid,
      lang: language,
      login_uuid_fk: loginUuid,
      device_code: printerContext?.device_code,
      agent_id: printerContext?.agent_id,
      print_mode: printerContext?.print_mode,
    });
  }, [
    createTableQr,
    language,
    loginUuid,
    resolveDeviceContext,
    resolveDeviceIdentity,
    table.table_uuid,
  ]);

  const runQrPrint = useCallback(async (
    getPrintResponse: () => Promise<CreateTableQRResponse | null>,
  ) => {
    if (printingRef.current) return;

    printingRef.current = true;
    setPrinting(true);
    try {
      const printResponse = await getPrintResponse();
      if (!tableQrPendingJobUuid(printResponse)) {
        showToast({
          title: t("pos.printQr"),
          description: t("pos.systemPrinterUnavailable"),
          tone: "error",
          action: {
            label: t("actions.tryAgain"),
            onClick: () => retryPrintRef.current(),
          },
        });
        return;
      }

      const printResult = await executeInvoice({
        print_job: printResponse?.print_job ?? undefined,
        pending_query: printResponse?.pending_query ?? undefined,
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

      if (printOutcome === "error") {
        showToast({
          title: t("pos.printQr"),
          description: printResult.errorMessage || t("pos.systemPrinterUnavailable"),
          tone: "error",
          action: {
            label: t("actions.tryAgain"),
            onClick: () => retryPrintRef.current(),
          },
        });
        return;
      }

      showToast({ title: t("common.printSuccess"), tone: "success" });
    } catch (error) {
      showToast({
        title: t("pos.printQr"),
        description: error instanceof Error ? error.message : t("pos.systemPrinterUnavailable"),
        tone: "error",
        action: {
          label: t("actions.tryAgain"),
          onClick: () => retryPrintRef.current(),
        },
      });
    } finally {
      printingRef.current = false;
      setPrinting(false);
    }
  }, [executeInvoice, loginUuid, showToast, t]);

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

    requestQrWithPrinterContext()
      .then(async (result) => {
        if (ignore) return;
        setResponse(result);
        showToast({ title: t("pos.qrCreated"), tone: "success" });
        // Creating a table QR already creates its q-001 queue. Dispatch that
        // exact job once so opening this dialog remains the auto-print action.
        await runQrPrint(async () => result);
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
    requestQrWithPrinterContext,
    runQrPrint,
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

  const printQr = useCallback(async (refreshQueue = false) => {
    if (!canPrint || printingRef.current) return;

    await runQrPrint(async () => {
      const printResponse = await tableQrPrintAttemptResponse({
        refreshQueue,
        requestQueue: requestQrWithPrinterContext,
        response,
      });
      if (refreshQueue) setResponse(printResponse);
      return printResponse;
    });
  }, [canPrint, requestQrWithPrinterContext, response, runQrPrint]);

  useEffect(() => {
    retryPrintRef.current = () => void printQr(true);
  }, [printQr]);

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
        <DialogContent className="max-h-[calc(100dvh-2rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] gap-0 overflow-hidden p-0 duration-200 sm:max-w-130">
        <DialogHeader className="px-5 pb-3 pt-5 pr-12 text-left">
          <DialogTitle className="text-xl font-bold leading-6">{t("pos.createTableQr")}</DialogTitle>
          <DialogDescription>{t("pos.tableQrDescription", { table: table.table_name })}</DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-5 pb-5">
          {/* ตัวอย่างหน้าตาเดียวกับกระดาษที่พิมพ์ออก (ชื่อโต๊ะ + QR) — ให้เห็นก่อนพิมพ์ว่าเป็นโต๊ะไหน */}
          <div className="flex flex-col items-center gap-3 rounded-xl border bg-muted/40 p-4">
            <div className="flex flex-col items-center gap-2 rounded-xl bg-card p-4 shadow-sm ring-1 ring-border">
              <p className="text-xs font-medium text-muted-foreground">{t("nav.table")}</p>
              <p className="-mt-2 max-w-56 truncate text-2xl font-bold leading-8 text-foreground">{table.table_name}</p>
              {pending ? (
                <Skeleton className="size-52 rounded-lg sm:size-56" />
              ) : previewUrl ? (
                <Image src={previewUrl} alt={`${table.table_name} QR`} width={224} height={224} unoptimized className="size-52 object-contain sm:size-56" />
              ) : (
                <div className="grid size-52 place-items-center rounded-lg bg-muted text-muted-foreground sm:size-56">
                  <QrCodeIcon />
                </div>
              )}
            </div>
          </div>

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
          <Button type="button" size="lg" variant="outline" disabled={!canDownload || pending} onClick={() => void downloadQr()}>
            <Download data-icon="inline-start" />
            {t("pos.downloadQr")}
          </Button>
          <Button type="button" size="lg" disabled={!canPrint || pending || printing} onClick={() => void printQr(true)}>
            {printing ? <Spinner data-icon="inline-start" /> : <Printer data-icon="inline-start" />}
            {t("pos.printQr")}
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
  return QRCode.toDataURL(value, { errorCorrectionLevel: "M", margin: 2, width: 320 });
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
