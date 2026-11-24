"use client";

import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Activity, CheckCircle2, RefreshCw, Wrench } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { createUuid } from "@/lib/uuid";
import { useResetOnDeps } from "@/hooks/use-reset-on-change";
import type { Printer, PrinterSupportAction } from "@/services/printer";
import { usePrinterStore } from "@/stores/printer-store";
import { useToastStore } from "@/stores/toast-store";
import { freshPrinterSupportDiagnosis, normalizeVerifiedPrinterMac, printerSupportChangeKey, printerSupportPending, printerSupportProblemKey, printerSupportRepairAvailable, printerSupportTransportReady } from "@/features/printer/printer-support-utils";

interface PrinterSupportPanelProps { printer: Printer; dirty: boolean; disabled?: boolean }

export function PrinterSupportPanel({ printer, dirty, disabled = false }: PrinterSupportPanelProps) {
  const { t, i18n } = useTranslation();
  const fieldId = useId();
  const summary = usePrinterStore((state) => state.supportPrinterUuid === printer.print_config_uuid ? state.supportSummary : null);
  const command = usePrinterStore((state) => state.supportPrinterUuid === printer.print_config_uuid ? state.supportCommand : null);
  const loading = usePrinterStore((state) => state.supportLoading);
  const sending = usePrinterStore((state) => state.supportSending);
  const error = usePrinterStore((state) => state.supportError);
  const errorCode = usePrinterStore((state) => state.supportErrorCode);
  const load = usePrinterStore((state) => state.loadPrinterSupport);
  const request = usePrinterStore((state) => state.requestPrinterSupport);
  const check = usePrinterStore((state) => state.checkPrinterSupportCommand);
  const clear = usePrinterStore((state) => state.clearPrinterSupport);
  const showToast = useToastStore((state) => state.show);
  const [mac, setMac] = useState("");
  const [macConfirmed, setMacConfirmed] = useState(false);
  const [confirmation, setConfirmation] = useState<Exclude<PrinterSupportAction, "diagnose"> | null>(null);
  const [pollTimedOut, setPollTimedOut] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const commandUuid = command?.command_uuid;
  const pending = printerSupportPending(command);
  const diagnosis = freshPrinterSupportDiagnosis(summary?.commands ?? [], now);
  const result = command?.result;
  const repairsAvailable = printerSupportRepairAvailable(diagnosis?.result);
  const verifiedMac = normalizeVerifiedPrinterMac(mac);
  const busy = loading || sending || pending || disabled;
  const blocked = busy || dirty || !summary || summary.printer.agent_online !== true;
  const mismatch = Boolean(verifiedMac && diagnosis?.result?.neighbor?.mac && verifiedMac !== normalizeVerifiedPrinterMac(diagnosis.result.neighbor.mac));
  const problem = printerSupportProblemKey(command?.error_code ?? result?.code);
  const errorKey = printerSupportProblemKey(errorCode);
  const ready = printerSupportTransportReady(command);
  const formatDate = (value: string | null | undefined) => value ? new Date(value).toLocaleString(i18n.language === "en" ? "en-GB" : "lo-LA") : "—";

  useResetOnDeps([printer.print_config_uuid], () => {
    setMac(""); setMacConfirmed(false); setConfirmation(null); setPollTimedOut(false);
  });
  useResetOnDeps([commandUuid], () => setPollTimedOut(false));
  useEffect(() => {
    void load(printer.print_config_uuid);
    const timer = globalThis.setInterval(() => setNow(Date.now()), 15000);
    return () => { globalThis.clearInterval(timer); clear(); };
  }, [printer.print_config_uuid, load, clear]);
  useEffect(() => {
    if (!pending || !commandUuid) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const deadline = Date.now() + 130000;
    async function poll() {
      await check();
      if (stopped) return;
      const latest = usePrinterStore.getState().supportCommand;
      if (latest?.command_uuid !== commandUuid) return;
      if (!printerSupportPending(latest)) { void load(printer.print_config_uuid); return; }
      if (Date.now() >= deadline) { setPollTimedOut(true); return; }
      timer = globalThis.setTimeout(() => { void poll(); }, 2000);
    }
    timer = globalThis.setTimeout(() => { void poll(); }, 2000);
    return () => { stopped = true; globalThis.clearTimeout(timer); };
  }, [commandUuid, pending, check, load, printer.print_config_uuid]);

  async function run(action: PrinterSupportAction) {
    if (blocked || (action !== "diagnose" && (!diagnosis || !repairsAvailable)) ||
        (action === "pin_neighbor" && (!verifiedMac || !macConfirmed))) return;
    setConfirmation(null);
    const created = await request({
      print_config_uuid: printer.print_config_uuid, action, request_uuid: createUuid(),
      ...(action !== "diagnose" && diagnosis ? { evidence_command_uuid: diagnosis.command_uuid } : {}),
      ...(action === "pin_neighbor" && verifiedMac ? { verified_mac: verifiedMac, mac_confirmed: true } : {}),
    });
    const state = usePrinterStore.getState();
    const failureKey = printerSupportProblemKey(state.supportErrorCode);
    showToast({ title: t(created ? "printer.support.requestQueued" : "printer.support.requestFailed"),
      description: created ? t("printer.support.waitForShop") : failureKey ? t(failureKey) : state.supportError ?? "",
      tone: created ? "info" : "error" });
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border bg-card p-4 sm:p-5" aria-labelledby={`${fieldId}-title`} data-printer-support-panel data-testid="printer-support-panel">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Wrench className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <div className="flex min-w-0 flex-col gap-1">
            <h2 id={`${fieldId}-title`} className="font-semibold">{t("printer.support.title")}</h2>
            <p className="text-sm text-muted-foreground">{t("printer.support.hint")}</p>
            <p className="break-all text-sm">{printer.interface_value} · {printer.device_code || printer.agent_id}</p>
          </div>
        </div>
        <Button type="button" className="min-h-11 shrink-0" variant="outline" disabled={loading || sending} onClick={() => void load(printer.print_config_uuid)}>
          {loading ? <Spinner data-icon="inline-start" /> : <RefreshCw data-icon="inline-start" />}{t("printer.support.refreshStatus")}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">{t("printer.support.receiverRequirement")}</p>
      {dirty ? <Alert><AlertDescription>{t("printer.support.saveFirst")}</AlertDescription></Alert> : null}
      {error ? <Alert variant="destructive"><AlertTitle>{t("printer.support.requestFailed")}</AlertTitle><AlertDescription className="break-words">{errorKey ? t(errorKey) : error}</AlertDescription></Alert> : null}
      {summary ? (
        <>
          <div className="flex flex-wrap gap-2" aria-live="polite">
            <Badge variant="outline">{t(summary.printer.agent_online ? "printer.support.receiverOnline" : "printer.support.receiverOffline")}</Badge>
            <Badge variant="outline">{t("printer.support.recentSuccess", { count: summary.recent.success })}</Badge>
            <Badge variant="outline">{t("printer.support.recentPending", { count: summary.recent.pending })}</Badge>
            <Badge variant="outline">{t("printer.support.recentFailed", { count: summary.recent.failed })}</Badge>
            <Badge variant="outline">{t("printer.support.recentUnknown", { count: summary.recent.unknown })}</Badge>
          </div>
          {summary.recent.last_error ? <p className="break-words text-sm text-muted-foreground">{t("printer.support.lastError")}: {summary.recent.last_error} · {formatDate(summary.recent.last_error_at)}</p> : null}
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button type="button" className="min-h-11" data-testid="printer-support-diagnose" disabled={blocked} onClick={() => void run("diagnose")}>
              {pending || sending ? <Spinner data-icon="inline-start" /> : <Activity data-icon="inline-start" />}{t("printer.support.actions.diagnose")}
            </Button>
            <Button type="button" variant="outline" className="min-h-11" disabled={blocked || !diagnosis || !repairsAvailable} data-testid="printer-support-refresh" onClick={() => setConfirmation("refresh_neighbor")}>{t("printer.support.actions.refresh_neighbor")}</Button>
            <Button type="button" variant="outline" className="min-h-11" disabled={blocked || !diagnosis || !repairsAvailable || !diagnosis.result?.rollback_available} data-testid="printer-support-remove-pin" onClick={() => setConfirmation("remove_pin")}>{t("printer.support.actions.remove_pin")}</Button>
          </div>
          {command ? (
            <div className="flex flex-col gap-3 rounded-lg border p-3" aria-live="polite" data-printer-support-status={command.status}>
              <div className="flex flex-wrap items-center gap-2">
                {pending ? <Spinner className="size-4" /> : ready ? <CheckCircle2 className="size-4 text-success-text" aria-hidden="true" /> : <Activity className="size-4 text-muted-foreground" aria-hidden="true" />}
                <span className="font-medium">{t(`printer.support.actions.${command.action}`)}</span>
                <Badge variant="outline">{t(`printer.support.status.${command.status}`)}</Badge>
              </div>
              {pending ? <p className="text-sm text-muted-foreground">{t("printer.support.waitForShop")}</p> : null}
              {pollTimedOut ? <Alert><AlertDescription>{t("printer.support.pollTimedOut")}</AlertDescription></Alert> : null}
              {problem ? <Alert variant="destructive"><AlertDescription>{t(problem)}</AlertDescription></Alert> : null}
              {command.status === "unknown" || command.status === "expired" ? <Alert><AlertDescription>{t(command.status === "expired" ? "printer.support.expired" : "printer.support.uncertain")}</AlertDescription></Alert> : null}
              {result ? (
                <>
                  <dl className="grid gap-2 text-sm sm:grid-cols-2">
                    <div><dt className="text-muted-foreground">{t("printer.support.portStatus")}</dt><dd>{result.tcp ? t(`printer.support.tcp.${result.tcp.state}`) : t("printer.support.notChecked")}</dd></div>
                    <div><dt className="text-muted-foreground">{t("printer.support.currentMac")}</dt><dd className="break-all font-mono">{result.neighbor?.mac || "—"}</dd></div>
                    <div><dt className="text-muted-foreground">{t("printer.support.checkedAt")}</dt><dd>{formatDate(result.checked_at)}</dd></div>
                    <div><dt className="text-muted-foreground">{t("printer.support.changeResult")}</dt><dd>{t(printerSupportChangeKey(command))}</dd></div>
                  </dl>
                  {result.tcp && result.tcp.state !== "open" ? <Alert variant="destructive"><AlertDescription>{t("printer.support.portNotReady")}</AlertDescription></Alert> : null}
                  {result.platform === "win32" && !result.admin ? <Alert><AlertDescription>{t("printer.support.adminRequired")}</AlertDescription></Alert> : null}
                  {result.platform !== "win32" ? <p className="text-sm text-muted-foreground">{t("printer.support.windowsRepairOnly")}</p> : null}
                  {ready ? <p className="text-sm text-success-text">{t("printer.support.transportReady")}</p> : null}
                  <p className="text-sm text-muted-foreground">{t("printer.support.paperUnconfirmed")}</p>
                </>
              ) : null}
              {command.error_code || result?.code ? <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">{t("printer.support.technicalDetails")}</summary><p className="break-all pt-1">{command.error_code || result?.code}</p></details> : null}
              <p className="text-xs text-muted-foreground">{formatDate(command.finished_at ?? command.created_at)}</p>
            </div>
          ) : null}
          <div className="flex flex-col gap-3 rounded-lg border p-3">
            <Field>
              <FieldLabel htmlFor={`${fieldId}-mac`}>{t("printer.support.verifiedMac")}</FieldLabel>
              <Input id={`${fieldId}-mac`} data-testid="printer-support-mac" value={mac} onChange={(event) => { setMac(event.target.value); setMacConfirmed(false); }}
                onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} placeholder="00-11-22-33-44-55" autoComplete="off" maxLength={17} disabled={busy} className="font-mono" />
              <FieldDescription>{t("printer.support.verifiedMacHint")}</FieldDescription>
            </Field>
            {mismatch ? <Alert variant="destructive"><AlertDescription>{t("printer.support.macMismatch")}</AlertDescription></Alert> : null}
            <label className="flex min-h-11 items-center gap-3 text-sm" htmlFor={`${fieldId}-verified`}>
              <Checkbox id={`${fieldId}-verified`} data-testid="printer-support-mac-confirmed" checked={macConfirmed} disabled={busy || !verifiedMac} onCheckedChange={(value) => setMacConfirmed(value === true)} />{t("printer.support.confirmMac")}
            </label>
            <Button type="button" variant="outline" className="min-h-11 w-full sm:w-auto sm:self-start" disabled={blocked || !diagnosis || !repairsAvailable || !verifiedMac || !macConfirmed} data-testid="printer-support-pin" onClick={() => setConfirmation("pin_neighbor")}>{t("printer.support.actions.pin_neighbor")}</Button>
            {!diagnosis ? <p className="text-sm text-muted-foreground">{t("printer.support.freshDiagnosisRequired")}</p> : null}
          </div>
        </>
      ) : null}
      <AlertDialog open={Boolean(confirmation)} onOpenChange={(open) => { if (!open) setConfirmation(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmation ? t(`printer.support.actions.${confirmation}`) : ""}</AlertDialogTitle>
            <AlertDialogDescription>{t("printer.support.confirmChange", { endpoint: printer.interface_value, device: printer.device_code || printer.agent_id })}</AlertDialogDescription>
          </AlertDialogHeader>
          {confirmation === "pin_neighbor" ? <p className="break-all font-mono text-sm">{verifiedMac}</p> : null}
          {confirmation === "remove_pin" ? <p className="text-sm">{t("printer.support.removePinHint")}</p> : null}
          <AlertDialogFooter>
            <Button type="button" className="min-h-11" variant="outline" onClick={() => setConfirmation(null)}>{t("actions.cancel")}</Button>
            <Button type="button" data-testid="printer-support-confirm" className="min-h-11" disabled={blocked} onClick={() => { if (confirmation) void run(confirmation); }}>{t("printer.support.confirmAction")}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
