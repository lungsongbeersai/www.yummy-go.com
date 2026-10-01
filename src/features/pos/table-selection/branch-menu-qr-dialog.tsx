"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { Copy, Download, ExternalLink, Minus, Plus, Printer, QrCode as QrCodeIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PrintLoadingDialog } from "@/components/common/print-loading-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group";
import { Field, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useIsCapacitorNativeApp } from "@/hooks/use-capacitor-native-app";
import { useResetOnChange, useResetOnDeps } from "@/hooks/use-reset-on-change";
import { openWindowOutsideNativeApp } from "@/lib/capacitor-platform";
import { optionalString } from "@/lib/values";
import type { BranchMenuQRResponse } from "@/services/pos";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { usePosStore } from "@/stores/pos-store";
import { usePrinterStore } from "@/stores/printer-store";
import { useToastStore } from "@/stores/toast-store";
import { resolveTableQrPrinterContext, tableQrPrintAttemptResponse, tableQrPrintOutcome } from "./table-qr-printing";

const MIN_PRINT_COPIES = 1;
const MAX_PRINT_COPIES = 20;

// ระดับสาขา ไม่ผูกโต๊ะ ไม่มี qr_ver ให้ revoke จึงไม่ต้อง regenerate token ทุกครั้ง
// ที่เปิด (แค่ขอ token เดิมซ้ำก็ยังใช้ได้) แต่คิวพิมพ์จริง (print_job/pending_query)
// ใช้ pattern เดียวกับ TableQrDialog ทุกอย่าง (P-72) — ต้องมี device_code/agent_id
// ไปด้วย ไม่งั้น backend คืน print_job: null พร้อม fallback_print แทน
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
  const canDownload = Boolean(qrDataUrl);
  const canPrint = Boolean(pendingJobUuid || qrDataUrl);

  const requestQrWithPrinterContext = useCallback(async (copies: number) => {
    if (!loginUuid) throw new Error("login_uuid_fk is required");

    const printerContext = await resolveTableQrPrinterContext({
      loginUuid,
      resolveDeviceContext,
      resolveDeviceIdentity,
    });

    return createBranchMenuQr({
      lang: language,
      login_uuid_fk: loginUuid,
      device_code: printerContext?.device_code,
      agent_id: printerContext?.agent_id,
      print_mode: printerContext?.print_mode,
      print: copies,
    });
  }, [
    createBranchMenuQr,
    language,
    loginUuid,
    resolveDeviceContext,
    resolveDeviceIdentity,
  ]);

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

    let ignore = false;

    // เปิด modal มีหน้าที่สร้าง/แสดง QR เท่านั้น ห้ามสร้าง print job
    requestQrWithPrinterContext(0)
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
    loginUuid,
    open,
    requestQrWithPrinterContext,
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

  // QR ต้องพิมพ์ผ่าน queue/role ที่ backend resolve ไว้เท่านั้น เพื่อไม่ให้ browser
  // หรือ Android system print ข้ามค่าการตั้งค่า printer ของสาขา
  async function printQr() {
    if (!canPrint || printing) return;

    setPrinting(true);
    try {
      const printResponse = await tableQrPrintAttemptResponse({
        // ทุก click คือคำสั่งพิมพ์ใหม่ จึงค่อยสร้าง queue ตามจำนวนที่เลือก
        refreshQueue: true,
        requestQueue: () => requestQrWithPrinterContext(printCopies),
        response,
      });
      setResponse(printResponse);

      if (!branchMenuQrPendingJobUuid(printResponse)) {
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

      const printResult = await executeInvoice({
        print_job: printResponse?.print_job ?? undefined,
        pending_query: printResponse?.pending_query,
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
            onClick: () => void printQr(),
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
          onClick: () => void printQr(),
        },
      });
    } finally {
      setPrinting(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[calc(100dvh-2rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] gap-0 overflow-hidden p-0 duration-200 sm:max-w-130">
        <DialogHeader className="px-5 pb-3 pt-5 pr-12 text-left">
          <DialogTitle className="text-xl font-bold leading-6">{t("pos.createBranchMenuQr")}</DialogTitle>
          <DialogDescription>{t("pos.branchMenuQrDescription")}</DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-5 pb-5">
          {/* การ์ดตัวอย่างแบบเดียวกับ QR โต๊ะ (table-qr-dialog.tsx) — ชื่อสาขาเหนือ QR */}
          <div className="flex flex-col items-center rounded-xl border bg-muted/40 p-4">
            <div className="flex flex-col items-center gap-2 rounded-xl bg-card p-4 shadow-sm ring-1 ring-border">
              {response?.branch_name ? (
                <p className="max-w-56 truncate text-lg font-bold leading-7 text-foreground">{response.branch_name}</p>
              ) : null}
              {pending ? (
                <Skeleton className="size-52 rounded-lg sm:size-56" />
              ) : qrDataUrl ? (
                <Image src={qrDataUrl} alt={`${response?.branch_name ?? ""} QR`} width={224} height={224} unoptimized className="size-52 object-contain sm:size-56" />
              ) : (
                <div className="grid size-52 place-items-center rounded-lg bg-muted text-muted-foreground sm:size-56">
                  <QrCodeIcon />
                </div>
              )}
            </div>
          </div>

          <Field className="gap-2">
            <FieldLabel htmlFor="branch-menu-qr-url">{t("pos.menuLink")}</FieldLabel>
            <InputGroup className="h-10">
              <InputGroupInput
                id="branch-menu-qr-url"
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

          <Field orientation="horizontal" className="items-center justify-between">
            <FieldLabel id="branch-menu-qr-print-copies-label">{t("pos.printCopies")}</FieldLabel>
            <ButtonGroup aria-labelledby="branch-menu-qr-print-copies-label">
              <Button
                type="button"
                aria-label={`${t("pos.printCopies")} -`}
                size="icon"
                variant="outline"
                disabled={pending || printCopies <= MIN_PRINT_COPIES}
                onClick={() => setPrintCopies((copies) => Math.max(MIN_PRINT_COPIES, copies - 1))}
              >
                <Minus />
              </Button>
              <ButtonGroupText aria-live="polite" className="min-w-10 justify-center bg-background text-sm font-semibold tabular-nums">
                {printCopies}
              </ButtonGroupText>
              <Button
                type="button"
                aria-label={`${t("pos.printCopies")} +`}
                size="icon"
                variant="outline"
                disabled={pending || printCopies >= MAX_PRINT_COPIES}
                onClick={() => setPrintCopies((copies) => Math.min(MAX_PRINT_COPIES, copies + 1))}
              >
                <Plus />
              </Button>
            </ButtonGroup>
          </Field>
        </div>

        {/* งานหลักคือพิมพ์ QR ไปวางหน้าร้าน/โต๊ะ — ปุ่มหลักจึงเป็นพิมพ์ ดาวน์โหลดเป็นทางเลือกรอง */}
        <DialogFooter className="grid grid-cols-2 gap-2 border-t border-border p-4 sm:flex sm:justify-end">
          <Button type="button" size="lg" variant="outline" disabled={!canDownload || pending} onClick={downloadQr}>
            <Download data-icon="inline-start" />
            {t("pos.downloadQr")}
          </Button>
          <Button type="button" size="lg" disabled={!canPrint || pending || printing} onClick={() => void printQr()}>
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

function branchMenuQrPendingJobUuid(response: BranchMenuQRResponse | null) {
  return (
    optionalString(response?.pending_query?.print_job_uuid) ??
    optionalString(response?.print_job?.print_job_uuid) ??
    ""
  );
}
