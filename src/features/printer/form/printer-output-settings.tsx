"use client";

import { useTranslation } from "react-i18next";
import { CircleAlert } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioOptionList } from "./printer-form-fields";
import type { InternetPrintSettings, PrinterAccessMode, PrinterKitchenCutMode } from "@/services/printer";

export function accessModeHintKey(mode: PrinterAccessMode) {
  if (mode === "INTERNET") return "printer.accessInternetHint";
  if (mode === "LAN") return "printer.accessLanHint";
  return "printer.accessDirectHint";
}

export function accessModeLabelKey(mode: PrinterAccessMode) {
  if (mode === "INTERNET") return "printer.accessInternet";
  if (mode === "LAN") return "printer.accessLan";
  return "printer.accessDirect";
}

interface PrinterAccessSettingsProps {
  accessMode: PrinterAccessMode;
  connectType: "usb" | "tcp";
  saving: boolean;
  loadingInternetSettings: boolean;
  internetSettings: InternetPrintSettings | null;
  onAccessModeChange: (value: PrinterAccessMode) => void;
}

export function PrinterAccessSettings(props: PrinterAccessSettingsProps) {
  const { t } = useTranslation();
  const canChooseInternet = props.internetSettings?.available === true && props.internetSettings.can_manage;
  const receivers = props.internetSettings?.receivers ?? [];
  const anyReceiverOnline = receivers.some((receiver) => receiver.online);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <RadioOptionList
        legend={t("printer.accessMode")}
        description={t(accessModeHintKey(props.accessMode))}
        name="printer-access-mode"
        value={props.accessMode}
        disabled={props.saving || props.loadingInternetSettings || (props.accessMode === "INTERNET" && !canChooseInternet)}
        optionsClassName="sm:grid-cols-3"
        onValueChange={(value) => props.onAccessModeChange(value as PrinterAccessMode)}
        options={[
          { value: "DIRECT", label: t("printer.accessDirect") },
          { value: "LAN", label: t("printer.accessLan"), disabled: props.connectType !== "tcp" },
          { value: "INTERNET", label: t("printer.accessInternet"), disabled: !canChooseInternet || props.connectType !== "tcp" },
        ]}
      />
      {props.connectType !== "tcp" ? (
        <FieldDescription>{t("printer.accessUsbOnlyHint")}</FieldDescription>
      ) : null}
      {props.accessMode === "INTERNET" ? (
        <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/30 p-3">
          <p className="text-sm font-semibold">{t("printer.internetPrintReceivers")}</p>
          {receivers.length ? (
            <div className="flex flex-wrap gap-2">
              {receivers.map((receiver) => (
                <Badge key={receiver.device_code} variant="outline" className={receiver.online ? "text-success" : "text-muted-foreground"}>
                  {receiver.agent_name || receiver.device_code} · {t(receiver.online ? "printer.internetPrintConnected" : "printer.internetPrintOffline")}
                </Badge>
              ))}
            </div>
          ) : null}
          {anyReceiverOnline ? (
            <FieldDescription>{t("printer.accessReceiverHint")}</FieldDescription>
          ) : (
            <Alert>
              <CircleAlert />
              <AlertDescription>{t("printer.internetPrintNoReceiver")}</AlertDescription>
            </Alert>
          )}
        </div>
      ) : null}
    </div>
  );
}

interface PrinterTicketHardwareSettingsProps {
  kitchenCutMode: PrinterKitchenCutMode;
  queueTicketEnabled: boolean;
  showQueueTicketOption: boolean;
  cashDrawerEnabled: boolean;
  buzzerOnCut: boolean;
  cutFeedLines: string;
  saving: boolean;
  onKitchenCutModeChange: (value: PrinterKitchenCutMode) => void;
  onQueueTicketEnabledChange: (value: boolean) => void;
  onCashDrawerEnabledChange: (value: boolean) => void;
  onBuzzerOnCutChange: (value: boolean) => void;
  onCutFeedLinesChange: (value: string) => void;
}

export function PrinterTicketHardwareSettings(props: PrinterTicketHardwareSettingsProps) {
  const { t } = useTranslation();

  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-2">
      <RadioOptionList
        className={props.showQueueTicketOption ? "min-w-0" : "min-w-0 lg:col-span-2"}
        legend={t("printer.kitchenCutMode")}
        description={t("printer.kitchenCutModeHint")}
        name="printer-kitchen-cut"
        value={props.kitchenCutMode}
        disabled={props.saving}
        onValueChange={(value) => props.onKitchenCutModeChange(value as PrinterKitchenCutMode)}
        options={[
          { value: "per_ticket", label: t("printer.kitchenCutPerTicket") },
          { value: "none", label: t("printer.kitchenCutNone") },
        ]}
      />
      {props.showQueueTicketOption ? (
        <RadioOptionList
          className="min-w-0"
          legend={t("printer.queueTicketMode")}
          description={t("printer.queueTicketModeHint")}
          name="printer-queue-ticket"
          value={props.queueTicketEnabled ? "enabled" : "disabled"}
          disabled={props.saving}
          onValueChange={(value) => props.onQueueTicketEnabledChange(value === "enabled")}
          options={[
            { value: "enabled", label: t("pos.printQueueTicket") },
            { value: "disabled", label: t("pos.skipQueueTicket") },
          ]}
        />
      ) : null}
      <RadioOptionList
        className="min-w-0"
        legend={t("printer.cashDrawerMode")}
        description={t("printer.cashDrawerModeHint")}
        name="printer-cash-drawer"
        value={props.cashDrawerEnabled ? "enabled" : "disabled"}
        disabled={props.saving}
        onValueChange={(value) => props.onCashDrawerEnabledChange(value === "enabled")}
        options={[
          { value: "enabled", label: t("printer.cashDrawerEnabled") },
          { value: "disabled", label: t("printer.cashDrawerDisabled") },
        ]}
      />
      <RadioOptionList
        className="min-w-0"
        legend={t("printer.buzzerOnCutMode")}
        description={t("printer.buzzerOnCutModeHint")}
        name="printer-buzzer-on-cut"
        value={props.buzzerOnCut ? "enabled" : "disabled"}
        disabled={props.saving}
        onValueChange={(value) => props.onBuzzerOnCutChange(value === "enabled")}
        options={[
          { value: "enabled", label: t("printer.buzzerOnCutEnabled") },
          { value: "disabled", label: t("printer.buzzerOnCutDisabled") },
        ]}
      />
      <Field className="min-w-0 lg:col-span-2">
        <FieldLabel htmlFor="printer-cut-feed-lines">{t("printer.cutFeedLines")}</FieldLabel>
        <Input id="printer-cut-feed-lines" name="printer_cut_feed_lines" className="max-w-sm" value={props.cutFeedLines} disabled={props.saving} type="number" inputMode="numeric" min={1} onChange={(event) => props.onCutFeedLinesChange(event.target.value)} />
        <FieldDescription>{t("printer.cutFeedLinesPlaceholder")}</FieldDescription>
      </Field>
    </div>
  );
}
