"use client";

import { useTranslation } from "react-i18next";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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

function ToggleSetting({ id, label, checked, disabled, onChange }: {
  id: string; label: string; checked: boolean; disabled: boolean; onChange: (value: boolean) => void;
}) {
  return (
    <Field orientation="horizontal" className="min-h-11 items-center justify-between gap-3">
      <FieldLabel htmlFor={id} className="min-w-0 flex-1">{label}</FieldLabel>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </Field>
  );
}

export function PrinterOutputSettings(props: PrinterOutputSettingsProps) {
  const { t } = useTranslation();
  const canChooseInternet = props.internetSettings?.available === true && props.internetSettings.can_manage;
  const showInternet = canChooseInternet || props.accessMode === "INTERNET";
  const modeHint = props.accessMode === "INTERNET" ? "printer.accessInternetHint" : props.accessMode === "LAN" ? "printer.accessLanHint" : "printer.accessDirectHint";

  return (
    <div className="flex min-w-0 flex-col gap-3 md:col-span-2">
      <div className="rounded-lg border border-border bg-muted/20 p-3">
        <Field className="gap-2">
          <FieldLabel htmlFor="printer-access-mode" className="font-black">{t("printer.accessMode")}</FieldLabel>
          <Select value={props.accessMode} onValueChange={(value) => props.onAccessModeChange(value as PrinterAccessMode)} disabled={props.saving || props.loadingInternetSettings || (props.accessMode === "INTERNET" && !canChooseInternet)}>
            <SelectTrigger id="printer-access-mode" className="w-full"><SelectValue>{t(props.accessMode === "INTERNET" ? "printer.accessInternet" : props.accessMode === "LAN" ? "printer.accessLan" : "printer.accessDirect")}</SelectValue></SelectTrigger>
            <SelectContent>
              <SelectItem value="DIRECT">{t("printer.accessDirect")}</SelectItem>
              <SelectItem value="LAN" disabled={props.connectType !== "tcp"}>{t("printer.accessLan")}</SelectItem>
              {showInternet ? <SelectItem value="INTERNET" disabled={!canChooseInternet || props.connectType !== "tcp"}>{t("printer.accessInternet")}</SelectItem> : null}
            </SelectContent>
          </Select>
          <FieldDescription>{t(modeHint)}</FieldDescription>
        </Field>
        {props.accessMode === "INTERNET" ? (
          <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
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

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1 rounded-lg border border-border p-3">
          <p className="mb-1 text-sm font-black">{t("printer.outputSettings")}</p>
          <Field orientation="horizontal" className="min-h-11 items-center justify-between gap-3">
            <FieldLabel htmlFor="printer-kitchen-cut" className="min-w-0 flex-1">{t("printer.kitchenCutMode")}</FieldLabel>
            <Select value={props.kitchenCutMode} onValueChange={(value) => props.onKitchenCutModeChange(value as PrinterKitchenCutMode)} disabled={props.saving}>
              <SelectTrigger id="printer-kitchen-cut" className="w-40 shrink-0"><SelectValue>{t(props.kitchenCutMode === "none" ? "printer.kitchenCutNone" : "printer.kitchenCutPerTicket")}</SelectValue></SelectTrigger>
              <SelectContent>
                <SelectItem value="per_ticket">{t("printer.kitchenCutPerTicket")}</SelectItem>
                <SelectItem value="none">{t("printer.kitchenCutNone")}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {props.showQueueTicketOption ? <ToggleSetting id="printer-queue-ticket" label={t("pos.printQueueTicket")} checked={props.queueTicketEnabled} disabled={props.saving} onChange={props.onQueueTicketEnabledChange} /> : null}
          <FieldDescription>{t("printer.outputSettingsHint")}</FieldDescription>
        </div>
        <div className="flex flex-col gap-1 rounded-lg border border-border p-3">
          <p className="mb-1 text-sm font-black">{t("printer.hardwareSettings")}</p>
          <ToggleSetting id="printer-cash-drawer" label={t("printer.cashDrawerEnabled")} checked={props.cashDrawerEnabled} disabled={props.saving} onChange={props.onCashDrawerEnabledChange} />
          <ToggleSetting id="printer-buzzer-on-cut" label={t("printer.buzzerOnCutEnabled")} checked={props.buzzerOnCut} disabled={props.saving} onChange={props.onBuzzerOnCutChange} />
        </div>
      </div>
      <Accordion type="single" collapsible>
        <AccordionItem value="advanced">
          <AccordionTrigger className="px-3 py-3 font-semibold">{t("printer.advancedSettings")}</AccordionTrigger>
          <AccordionContent className="px-3 pb-3">
            <Field className="max-w-sm">
              <FieldLabel htmlFor="printer-cut-feed-lines">{t("printer.cutFeedLines")}</FieldLabel>
              <Input id="printer-cut-feed-lines" name="printer_cut_feed_lines" value={props.cutFeedLines} disabled={props.saving} type="number" inputMode="numeric" min={1} onChange={(event) => props.onCutFeedLinesChange(event.target.value)} />
              <FieldDescription>{t("printer.cutFeedLinesPlaceholder")}</FieldDescription>
            </Field>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
