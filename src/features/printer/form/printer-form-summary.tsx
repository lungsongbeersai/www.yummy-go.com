"use client";

import type * as React from "react";
import { CircleCheck, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { accessModeLabelKey } from "./printer-output-settings";
import type { PrinterFormWorkflow } from "./use-printer-form";

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-semibold break-words">{children}</dd>
    </div>
  );
}

export function PrinterFormSummary({
  form,
  onCancel,
}: {
  form: PrinterFormWorkflow;
  onCancel: () => void;
}) {
  const { t } = form;
  const notSet = <span className="font-normal text-muted-foreground">{t("printer.summaryNotSet")}</span>;

  const usbName = form.usbOptions.find((item) => item.interface_value === form.selectedDevice)?.name;
  const connection =
    form.connectType === "usb"
      ? usbName || form.selectedDevice || null
      : form.ip.trim()
        ? [form.ip.trim(), form.port.trim()].filter(Boolean).join(":")
        : null;

  const roleLabels = form.roleOptions
    .filter((option) => form.selectedRoles.includes(option.value))
    .map((option) => option.label);

  const receivers = form.internetSettings?.receivers ?? [];
  const onlineReceivers = receivers.filter((receiver) => receiver.online).length;

  const mappingLabel =
    form.mappingType === "ZONE"
      ? `${t("printer.mappingTypeZone")} · ${form.selectedZones.length} / ${t("printer.mappingTypeCategory")} · ${form.selectedCategories.length}`
      : form.mappingType === "CATEGORY"
        ? `${t("printer.mappingTypeCategory")} · ${form.selectedCategories.length}`
        : t("printer.mappingTypeOff");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("printer.summaryTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="flex flex-col gap-2.5">
          <SummaryRow label={t("fields.displayName")}>{form.displayName.trim() || notSet}</SummaryRow>
          <SummaryRow label={t("fields.connectType")}>
            {form.connectType === "usb" ? t("printer.usbPrinter") : t("printer.tcpPrinter")}
          </SummaryRow>
          <SummaryRow label={form.connectType === "usb" ? t("printer.selectedPrinter") : t("fields.ip")}>
            {connection ?? notSet}
          </SummaryRow>
          <SummaryRow label={t("fields.paperWidth")}>
            {form.paperWidth.trim() ? `${form.paperWidth.trim()} mm` : notSet}
          </SummaryRow>
          <Separator className="my-1" />
          <SummaryRow label={t("printer.accessMode")}>{t(accessModeLabelKey(form.accessMode))}</SummaryRow>
          {form.accessMode === "INTERNET" ? (
            <SummaryRow label={t("printer.internetPrintReceivers")}>
              <Badge variant="outline" className={onlineReceivers ? "text-success" : "text-destructive"}>
                {t("printer.summaryReceiversOnline", { online: onlineReceivers, total: receivers.length })}
              </Badge>
            </SummaryRow>
          ) : null}
          <Separator className="my-1" />
          <SummaryRow label={t("printer.roles")}>{roleLabels.length ? roleLabels.join(", ") : notSet}</SummaryRow>
          <SummaryRow label={t("printer.mappingType")}>{mappingLabel}</SummaryRow>
        </dl>
      </CardContent>
      <CardFooter className="flex flex-col items-stretch gap-3">
        {!form.saving && form.validationMessage ? (
          <p className="text-sm text-destructive" aria-live="polite">
            {form.validationMessage}
          </p>
        ) : !form.saving && form.canSubmit ? (
          <p className="flex items-center gap-1.5 text-sm text-success" aria-live="polite">
            <CircleCheck className="size-4" />
            {t("printer.summaryReady")}
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" disabled={form.saving} onClick={onCancel}>
            {t("actions.cancel")}
          </Button>
          {/* กดได้เสมอแม้ยังกรอกไม่ครบ — validationMessage ด้านบนบอกเหตุผลอยู่แล้ว ส่วน submit() no-op
              เองถ้ายัง !canSubmit ปุ่มที่ disable ล่วงหน้าทำให้ผู้ใช้งงว่าทำไมกดไม่ได้ */}
          <Button type="submit" disabled={form.saving || form.loading}>
            {form.saving ? <Spinner data-icon="inline-start" /> : <Save data-icon="inline-start" />}
            {form.saving ? t("common.processing") : t("actions.save")}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
