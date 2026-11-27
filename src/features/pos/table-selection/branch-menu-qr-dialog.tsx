"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Clock3, Copy, Download, ExternalLink, Minus, Plus, Printer } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group";
import { Field, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { useIsCapacitorNativeApp } from "@/hooks/use-capacitor-native-app";
import { useResetOnChange, useResetOnDeps } from "@/hooks/use-reset-on-change";
import { openWindowOutsideNativeApp } from "@/lib/capacitor-platform";
import { copyTextToClipboard } from "@/lib/clipboard";
import { useExportCurrent } from "@/hooks/use-export-current";
import { saveExportFile } from "@/lib/export/file-output";
import { pngDataUrlFile } from "@/lib/export/image-file";
import { optionalString } from "@/lib/values";
import type { BranchMenuQRResponse } from "@/services/pos";
import type { PrintProgress } from "@/services/printer";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { usePosStore } from "@/stores/pos-store";
import { usePrinterStore } from "@/stores/printer-store";
import { useToastStore } from "@/stores/toast-store";
import { createQrPrintRound, tableQrPrintAttemptResponse, tableQrPrintOutcome, tableQrPrintProgress, tableQrPrintProgressUpdate } from "./table-qr-printing";
import { QrPrintPreview } from "./qr-print-preview";

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
  const showToast = useToastStore((state) => state.show);
  const nativeApp = useIsCapacitorNativeApp();
  const [pending, setPending] = useState(false);
  const [response, setResponse] = useState<BranchMenuQRResponse | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [printing, setPrinting] = useState(false);
  const [printChecking, setPrintChecking] = useState(false);
  const [printPending, setPrintPending] = useState(false);
  const [printProgress, setPrintProgress] = useState<PrintProgress | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [printCopies, setPrintCopies] = useState(MIN_PRINT_COPIES);
  const targetUrl = response?.qr_url ?? null;
  const pendingJobUuid = branchMenuQrPendingJobUuid(response);
  const canDownload = Boolean(qrDataUrl);
  const canPrint = Boolean(pendingJobUuid || qrDataUrl);
  const exportCurrent = useExportCurrent(JSON.stringify([open, targetUrl, qrDataUrl]));
  const printCurrent = useExportCurrent(JSON.stringify([open, language, loginUuid]));
  const printRound = useMemo(() => createQrPrintRound<BranchMenuQRResponse>(undefined, printCurrent), [printCurrent]);
  const printPreparing = printing && !printChecking && (!printProgress || printProgress.phase === "fetching");
  const confirmedPrint = tableQrPrintProgress(printProgress ?? {}, printCopies);
  const printActionKey = printChecking ? "pos.paidReceiptCheckStatus" : printing
    ? printPreparing ? "pos.qrPrintPreparing" : "common.printing"
    : printPending ? "pos.paidReceiptCheckStatus" : "pos.printQr";

  const requestQr = useCallback(async (copies: number, isCurrent: () => boolean = () => true, operationUuid?: string) => {
    if (!loginUuid) throw new Error("login_uuid_fk is required");
    if (!isCurrent()) throw new DOMException("QR print cancelled", "AbortError");

    return createBranchMenuQr({
      lang: language,
      login_uuid_fk: loginUuid,
      print: copies,
      ...(copies > 0 && operationUuid ? { operation_uuid: operationUuid } : {}),
    });
  }, [
    createBranchMenuQr,
    language,
    loginUuid,
  ]);

  useResetOnChange(printCurrent, () => {
    setPrinting(false);
    setPrintChecking(false);
    setPrintPending(false);
    setPrintProgress(null);
  });

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
    requestQr(0)
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
    requestQr,
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
    QRCode.toDataURL(targetUrl, { errorCorrectionLevel: "M", margin: 4, width: 320 })
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
    const copied = await copyTextToClipboard(targetUrl);
    showToast({ title: t(copied ? "dashboard.copied" : "pos.qrCopyFailed"), tone: copied ? "success" : "error" });
  }

  async function downloadQr() {
    if (!qrDataUrl || downloading || !exportCurrent()) return;
    const isCurrent = exportCurrent;
    setDownloading(true);
    try {
      await saveExportFile(pngDataUrlFile(qrDataUrl, `${response?.branch_name || "menu"}-qr.png`), { isCurrent });
    } catch (error) {
      if (isCurrent() && !(error instanceof Error && error.name === "AbortError")) {
        showToast({ title: t("report.exportFailed"), description: error instanceof Error ? error.message : "", tone: "error" });
      }
    } finally { setDownloading(false); }
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
    const isCurrent = printCurrent;
    if (!canPrint || printing || !isCurrent()) return;
    const attempt = printRound.begin(printCopies);
    if (!attempt) return;

    let attemptActive = true;
    const observing = Boolean(attempt.response);
    setPrinting(true);
    setPrintChecking(observing);
    setPrintPending(true);
    if (!observing) setPrintProgress({ phase: "fetching", total: attempt.copies, completed: 0, successCount: 0, failedCount: 0 });
    try {
      const printResponse = await tableQrPrintAttemptResponse({
        refreshQueue: !attempt.response,
        requestQueue: () => requestQr(attempt.copies, isCurrent, attempt.operationUuid),
        response: attempt.response,
        isCurrent,
      });
      setResponse(printResponse);

      if (!printResponse || !branchMenuQrPendingJobUuid(printResponse)) {
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
        pending_query: printResponse?.pending_query,
        login_uuid_fk: loginUuid,
        onProgress: (progress) => {
          if (attemptActive && isCurrent()) setPrintProgress((previous) => tableQrPrintProgressUpdate(previous, progress, observing));
        },
      });
      if (!isCurrent()) return;

      setPrintProgress((previous) => tableQrPrintProgressUpdate(previous, {
        ...printResult, completed: printResult.successCount + printResult.failedCount, phase: printResult.pending ? "printing" : "done",
      }, observing && printResult.pending === true));
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
      attemptActive = false;
      attempt.release();
      if (isCurrent()) {
        setPrinting(false);
        setPrintChecking(false);
      }
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(nextOpen) => { if (nextOpen || !printRound.isActive()) onOpenChange(nextOpen); }}>
        <DialogContent showCloseButton={!printing} className="max-h-[calc(100dvh-2rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 duration-200 sm:max-w-130">
        <DialogHeader className="gap-2 px-5 pb-5 pt-5 pr-12 text-left">
          <DialogTitle className="text-xl font-bold leading-6">{t("pos.createBranchMenuQr")}</DialogTitle>
          <DialogDescription>{t("pos.branchMenuQrDescription")}</DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto overscroll-contain px-5 pb-5 [&>*]:shrink-0">
          <QrPrintPreview
            title={response?.branch_name || t("pos.foodMenu")}
            caption={t("pos.scanQrToViewMenu")}
            imageUrl={qrDataUrl}
            loading={pending}
          />

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
                disabled={pending || printing || printPending || printCopies <= MIN_PRINT_COPIES}
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
                disabled={pending || printing || printPending || printCopies >= MAX_PRINT_COPIES}
                onClick={() => setPrintCopies((copies) => Math.min(MAX_PRINT_COPIES, copies + 1))}
              >
                <Plus />
              </Button>
            </ButtonGroup>
          </Field>
        </div>

        {/* งานหลักคือพิมพ์ QR ไปวางหน้าร้าน/โต๊ะ — ปุ่มหลักจึงเป็นพิมพ์ ดาวน์โหลดเป็นทางเลือกรอง */}
        <DialogFooter className="grid grid-cols-2 gap-2 border-t border-border p-4 sm:flex sm:flex-wrap sm:justify-end">
          {printing || printPending ? (
            <Alert role="status" aria-live="polite" aria-atomic="true" className="col-span-2 basis-full" data-qr-print-status="true">
              {printPreparing ? <Spinner aria-hidden="true" /> : printing && !printChecking ? <Printer aria-hidden="true" /> : <Clock3 aria-hidden="true" />}
              <AlertTitle>{t(printActionKey)}</AlertTitle>
              <AlertDescription>{t("pos.qrPrintProgress", confirmedPrint)}</AlertDescription>
            </Alert>
          ) : null}
          <Button type="button" size="lg" variant="outline" disabled={!canDownload || pending || downloading} onClick={() => void downloadQr()}>
            <Download data-icon="inline-start" />
            {t("pos.downloadQr")}
          </Button>
          <Button type="button" size="lg" className="h-auto min-h-11 min-w-0 whitespace-normal" disabled={!canPrint || pending || printing} onClick={() => void printQr()}>
            <Printer data-icon="inline-start" />
            {t(printActionKey)}
          </Button>
        </DialogFooter>
        </DialogContent>
      </Dialog>
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
