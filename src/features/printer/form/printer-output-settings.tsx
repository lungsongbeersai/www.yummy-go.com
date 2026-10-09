"use client";

import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Field, FieldDescription, FieldLabel, FieldSet, FieldLegend } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioOptionList } from "./printer-form-fields";
import type { InternetPrintSettings, PrinterAccessMode, PrinterKitchenCutMode } from "@/services/printer";

interface PrinterOutputSettingsProps {
  accessMode: PrinterAccessMode;
  kitchenCutMode: PrinterKitchenCutMode;
  queueTicketEnabled: boolean;
  showQueueTicketOption: boolean;
  cashDrawerEnabled: boolean;
  buzzerOnCut: boolean;
  cutFeedLines: string;
  connectType: "usb" | "tcp";
  saving: boolean;
  loadingInternetSettings: boolean;
  internetSettings: InternetPrintSettings | null;
  onAccessModeChange: (value: PrinterAccessMode) => void;
  onKitchenCutModeChange: (value: PrinterKitchenCutMode) => void;
  onQueueTicketEnabledChange: (value: boolean) => void;
  onCashDrawerEnabledChange: (value: boolean) => void;
  onBuzzerOnCutChange: (value: boolean) => void;
  onCutFeedLinesChange: (value: string) => void;
}

export function PrinterOutputSettings(props: PrinterOutputSettingsProps) {
  const { t } = useTranslation();
  const canChooseInternet = props.internetSettings?.available === true && props.internetSettings.can_manage;
  const showInternet = canChooseInternet || props.accessMode === "INTERNET";
  const modeHint = props.accessMode === "INTERNET" ? "printer.accessInternetHint" : props.accessMode === "LAN" ? "printer.accessLanHint" : "printer.accessDirectHint";

  return (
    <div className="flex min-w-0 flex-col gap-4 md:col-span-2">
      <FieldSet className="gap-4 rounded-lg border border-border bg-card p-4">
        <FieldLegend className="mb-0 text-base font-black">{t("printer.outputSettings")}</FieldLegend>
        <div className="grid min-w-0 gap-4 lg:grid-cols-2">
          <div className="min-w-0 lg:col-span-2">
            <RadioOptionList
              legend={t("printer.accessMode")}
              description={t(modeHint)}
              name="printer-access-mode"
              value={props.accessMode}
              disabled={props.saving || props.loadingInternetSettings || (props.accessMode === "INTERNET" && !canChooseInternet)}
              optionsClassName={showInternet ? "sm:grid-cols-3" : undefined}
              onValueChange={(value) => props.onAccessModeChange(value as PrinterAccessMode)}
              options={[
                { value: "DIRECT", label: t("printer.accessDirect") },
                { value: "LAN", label: t("printer.accessLan"), disabled: props.connectType !== "tcp" },
                ...(showInternet ? [{ value: "INTERNET", label: t("printer.accessInternet"), disabled: !canChooseInternet || props.connectType !== "tcp" }] : []),
              ]}
            />
            {props.accessMode === "INTERNET" ? (
              <div className="mt-2 flex flex-col gap-1.5">
                <div className="flex flex-wrap gap-2">
                  {props.internetSettings?.receivers.map((receiver) => (
                    <Badge key={receiver.device_code} variant="outline" className={receiver.online ? "text-success" : "text-muted-foreground"}>
                      {receiver.agent_name || receiver.device_code} · {t(receiver.online ? "printer.internetPrintConnected" : "printer.internetPrintOffline")}
                    </Badge>
                  ))}
                </div>
                <FieldDescription>{t("printer.accessReceiverHint")}</FieldDescription>
              </div>
            ) : null}
          </div>
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
        </div>
      </FieldSet>
      <FieldSet className="gap-4 rounded-lg border border-border bg-card p-4">
        <FieldLegend className="mb-0 text-base font-black">{t("printer.hardwareSettings")}</FieldLegend>
        <div className="grid min-w-0 gap-4 lg:grid-cols-2">
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
      </FieldSet>
    </div>
  );
}
