"use client";

import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Activity, CheckCircle2, ListRestart, Network, Printer as PrinterIcon, RefreshCw, Wrench } from "lucide-react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createUuid } from "@/lib/uuid";
import type { Printer } from "@/services/printer";
import { usePrinterStore } from "@/stores/printer-store";
import { PrinterSupportPanel } from "./printer-support-panel";
import { printerSupportPending } from "./printer-support-utils";
import { parsePrinterMaintenanceEndpoint, printerMaintenanceEndpoint, printerMaintenanceProblemKey } from "./printer-maintenance-utils";

interface PrinterMaintenanceDialogProps {
  printer: Printer;
  canTest: boolean;
  printing: boolean;
  onClose: () => void;
  onTest: (printer: Printer) => void;
  onUpdated: (printer: Printer) => void;
}

export function PrinterMaintenanceDialog({ printer, canTest, printing, onClose, onTest, onUpdated }: PrinterMaintenanceDialogProps) {
  const { t, i18n } = useTranslation();
  const fieldId = useId();
  const initial = parsePrinterMaintenanceEndpoint(printer.interface_value);
  const [ip, setIp] = useState(initial?.ip ?? "");
  const [port, setPort] = useState(initial?.port ?? "9100");
  const [confirmation, setConfirmation] = useState<"connection" | "queue" | null>(null);
  const summary = usePrinterStore((state) => state.supportPrinterUuid === printer.print_config_uuid ? state.supportSummary : null);
  const supportCommand = usePrinterStore((state) => state.supportPrinterUuid === printer.print_config_uuid ? state.supportCommand : null);
  const supportLoading = usePrinterStore((state) => state.supportLoading || state.supportSending);
  const queue = usePrinterStore((state) => state.maintenancePrinterUuid === printer.print_config_uuid ? state.maintenanceQueue : null);
  const loading = usePrinterStore((state) => state.maintenanceLoading);
  const saving = usePrinterStore((state) => state.maintenanceSaving);
  const error = usePrinterStore((state) => state.maintenanceError);
  const errorCode = usePrinterStore((state) => state.maintenanceErrorCode);
  const connectionResult = usePrinterStore((state) => state.maintenanceConnectionResult);
  const clearResult = usePrinterStore((state) => state.maintenanceClearResult);
  const loadQueue = usePrinterStore((state) => state.loadMaintenanceQueue);
  const loadSupport = usePrinterStore((state) => state.loadPrinterSupport);
  const updateConnection = usePrinterStore((state) => state.updateMaintenanceConnection);
  const clearQueue = usePrinterStore((state) => state.clearMaintenanceQueue);
  const reset = usePrinterStore((state) => state.resetMaintenance);
  const endpoint = printerMaintenanceEndpoint(ip, port);
  const busy = saving || loading || supportLoading || printerSupportPending(supportCommand) || printing;
  const currentVersion = queue && queue.configuration_version === summary?.printer.configuration_version;
  const canUpdate = !busy && currentVersion && summary?.capabilities?.connection_update === true;
  const canClear = !busy && currentVersion && summary?.capabilities?.queue_management === true && Boolean(queue?.clearable_job_count);
  const connectionDisabled = !canUpdate || !endpoint || endpoint === printer.interface_value;

  useEffect(() => {
    void loadQueue(printer.print_config_uuid);
    return reset;
  }, [loadQueue, printer.print_config_uuid, reset]);

  const refresh = () => {
    void loadQueue(printer.print_config_uuid);
    void loadSupport(printer.print_config_uuid);
  };
  const confirm = async () => {
    if (confirmation === "connection" && !connectionDisabled && endpoint && queue) {
      setConfirmation(null);
      const result = await updateConnection({ print_config_uuid: printer.print_config_uuid, configuration_version: queue.configuration_version, interface_value: endpoint });
      if (result) {
        onUpdated({ ...printer, interface_value: result.printer.interface_value });
        void loadQueue(printer.print_config_uuid);
      }
    } else if (confirmation === "queue" && canClear && queue) {
      setConfirmation(null);
      const result = await clearQueue({ request_uuid: createUuid(), print_config_uuid: printer.print_config_uuid, configuration_version: queue.configuration_version, queue_version: queue.queue_version });
      if (result) refresh();
    }
  };

  return (
    <>
      <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
        <DialogContent className="gap-0 p-0 font-lao sm:max-w-4xl" onEscapeKeyDown={(event) => { if (saving) event.preventDefault(); }} onPointerDownOutside={(event) => { if (saving) event.preventDefault(); }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Wrench className="size-5 text-primary" />{t("printer.maintenance.title")}</DialogTitle>
            <DialogDescription className="break-all">{printer.printer_name} · {printer.interface_value}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
              <p className="text-sm text-muted-foreground">{t("printer.maintenance.intro")}</p>
              <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={refresh}>
                {loading || supportLoading ? <Spinner data-icon="inline-start" /> : <RefreshCw data-icon="inline-start" />}{t("printer.maintenance.refresh")}
              </Button>
            </div>
            {error ? <Alert variant="destructive"><AlertTitle>{t(printerMaintenanceProblemKey(errorCode))}</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
            {connectionResult ? <Alert><CheckCircle2 /><AlertTitle>{t("printer.maintenance.connectionSaved")}</AlertTitle><AlertDescription>{t("printer.maintenance.verifyAfterSave", { endpoint: connectionResult.printer.interface_value })}</AlertDescription></Alert> : null}
            {clearResult ? <Alert><CheckCircle2 /><AlertTitle>{t("printer.maintenance.queueCleared", { count: clearResult.cleared_jobs })}</AlertTitle><AlertDescription>{t("printer.maintenance.clearComplete")}</AlertDescription></Alert> : null}
            <Tabs defaultValue="status" className="gap-4">
              <TabsList className="grid h-auto! min-h-12 w-full grid-cols-3">
                <TabsTrigger value="status" className="min-h-11 text-sm"><Activity />{t("printer.maintenance.statusTab")}</TabsTrigger>
                <TabsTrigger value="connection" className="min-h-11 text-sm"><Network />{t("printer.maintenance.connectionTab")}</TabsTrigger>
                <TabsTrigger value="queue" className="min-h-11 text-sm"><ListRestart />{t("printer.maintenance.queueTab")}</TabsTrigger>
              </TabsList>
              <TabsContent value="status" forceMount className="grid gap-4 data-[state=inactive]:hidden">
                <PrinterSupportPanel key={`${printer.print_config_uuid}:${printer.interface_value}`} printer={printer} dirty={false} disabled={saving || printing} />
                <div className="grid gap-2 rounded-lg border p-4">
                  <Button type="button" className="min-h-11" disabled={!canTest || busy} onClick={() => onTest(printer)}>
                    {printing ? <Spinner data-icon="inline-start" /> : <PrinterIcon data-icon="inline-start" />}{t("printer.maintenance.test")}
                  </Button>
                  <p className="text-sm text-muted-foreground">{t("printer.maintenance.testHint")}</p>
                </div>
              </TabsContent>
              <TabsContent value="connection" className="grid gap-4">
                <Alert><Network /><AlertTitle>{t("printer.maintenance.connectionTitle")}</AlertTitle><AlertDescription>{t("printer.maintenance.ipExplanation")}</AlertDescription></Alert>
                {summary && !summary.capabilities?.connection_update ? <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">{t("printer.maintenance.ownerRequired")}</p> : null}
                <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
                  <Field>
                    <FieldLabel htmlFor={`${fieldId}-ip`}>{t("printer.maintenance.ip")}</FieldLabel>
                    <Input id={`${fieldId}-ip`} value={ip} onChange={(event) => setIp(event.target.value)} placeholder="192.168.100.202" inputMode="decimal" autoComplete="off" disabled={busy || !summary?.capabilities?.connection_update} className="h-11 font-mono" aria-invalid={Boolean(ip && !printerMaintenanceEndpoint(ip, "9100"))} />
                    <FieldDescription>{t("printer.maintenance.privateIp")}</FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`${fieldId}-port`}>{t("printer.maintenance.port")}</FieldLabel>
                    <Input id={`${fieldId}-port`} value={port} onChange={(event) => setPort(event.target.value)} inputMode="numeric" autoComplete="off" disabled={busy || !summary?.capabilities?.connection_update} className="h-11 font-mono" aria-invalid={Boolean(port && !printerMaintenanceEndpoint("192.168.1.1", port))} />
                  </Field>
                </div>
                {!endpoint ? <p role="status" className="text-sm text-destructive">{t("printer.maintenance.invalidAddress")}</p> : null}
                <Button type="button" className="min-h-11" disabled={connectionDisabled} onClick={() => setConfirmation("connection")}>
                  {saving ? <Spinner data-icon="inline-start" /> : <Network data-icon="inline-start" />}{t("printer.maintenance.saveConnection")}
                </Button>
              </TabsContent>
              <TabsContent value="queue" className="grid gap-4">
                <div className="grid gap-1"><h3 className="text-base font-semibold">{t("printer.maintenance.queueTitle")}</h3><p className="text-sm text-muted-foreground">{t("printer.maintenance.queueExplanation")}</p></div>
                {loading ? <div role="status" className="flex items-center gap-2 py-4"><Spinner />{t("printer.maintenance.loadingQueue")}</div> : queue ? (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      {[["clearable", queue.clearable_job_count], ["pending", queue.pending_job_count], ["blocked", queue.blocked_job_count]].map(([key, count]) => (
                        <div key={key} className="rounded-lg border p-3 text-center"><p className="text-2xl font-semibold tabular-nums">{count}</p><p className="mt-1 text-sm text-muted-foreground">{t(`printer.maintenance.${key}`)}</p></div>
                      ))}
                    </div>
                    {queue.blocked_job_count > 0 ? <Alert><AlertDescription>{t("printer.maintenance.blockedHint")}</AlertDescription></Alert> : null}
                    {queue.clearable_jobs.length ? <ul className="max-h-60 divide-y overflow-y-auto rounded-lg border" aria-label={t("printer.maintenance.queueTitle")}>
                      {queue.clearable_jobs.map((job) => <li key={job.print_job_uuid} className="flex flex-wrap items-center justify-between gap-2 p-3">
                        <div><p className="text-sm font-medium">{t("printer.maintenance.items", { count: job.item_count })}</p><p className="text-sm text-muted-foreground">{new Date(job.created_at).toLocaleString(i18n.language === "en" ? "en-GB" : "lo-LA")}</p></div>
                        <Badge variant="outline">{t(`printer.maintenance.jobStatus.${job.job_status}`)}</Badge>
                      </li>)}
                    </ul> : <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{t("printer.maintenance.noStuckJobs")}</p>}
                    {!summary?.capabilities?.queue_management ? <p className="text-sm text-muted-foreground">{t("printer.maintenance.ownerRequired")}</p> : null}
                    <Button type="button" variant="destructive" className="min-h-11" disabled={!canClear} onClick={() => setConfirmation("queue")}><ListRestart data-icon="inline-start" />{t("printer.maintenance.clearQueue", { count: queue.clearable_job_count })}</Button>
                  </>
                ) : <p className="text-sm text-muted-foreground">{t("printer.maintenance.refreshQueue")}</p>}
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmation !== null}
        title={t(confirmation === "connection" ? "printer.maintenance.confirmConnectionTitle" : "printer.maintenance.confirmClearTitle")}
        description={confirmation === "connection" ? t("printer.maintenance.confirmConnection", { name: printer.printer_name, before: printer.interface_value, after: endpoint }) : t("printer.maintenance.confirmClear", { name: printer.printer_name, count: queue?.clearable_job_count ?? 0 })}
        confirmLabel={t(confirmation === "connection" ? "printer.maintenance.saveConnection" : "printer.maintenance.confirmClearAction")}
        confirmVariant={confirmation === "connection" ? "default" : "destructive"}
        confirmDisabled={confirmation === "connection" ? connectionDisabled : !canClear}
        cancelLabel={t("actions.cancel")}
        onConfirm={() => void confirm()}
        onOpenChange={(open) => { if (!open) setConfirmation(null); }}
      />
    </>
  );
}
