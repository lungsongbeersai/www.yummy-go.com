"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Ban,
  Cable,
  CheckCircle2,
  MapPinned,
  Printer,
  ReceiptText,
  RefreshCw,
  Route,
  Save,
  ScrollText,
  SlidersHorizontal,
  Tags,
  Usb,
  Wifi,
} from "lucide-react";
import { BackButton } from "@/components/common/back-button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type {
  SearchPrinterResult,
} from "@/services/printer";
import { CheckboxOptionList } from "./printer-form-fields";
import { ChoiceCards, FormSection } from "./printer-form-sections";
import {
  formatIpInput,
  toggleAllValues,
  toggleValue,
  type ConnectType,
  type MappingTypeSelection,
} from "./printer-form-utils";
import { usePrinterForm } from "./use-printer-form";
import { PrinterOutputSettings } from "./printer-output-settings";
import { PrinterSelfTestDialog } from "@/features/printer/printer-self-test-dialog";

export function PrinterFormPage() {
  const form = usePrinterForm();
  const { t } = form;
  // dialog นี้เป็น UI state ล้วนๆ ของหน้านี้ ไม่เกี่ยวกับ business logic จึงไม่ย้ายเข้า usePrinterForm
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);

  function handleCancel() {
    if (form.isDirty) {
      setConfirmDiscardOpen(true);
      return;
    }
    form.router.push("/printers");
  }

  const connectionSummary =
    form.connectType === "usb"
      ? t("printer.usbPrinter")
      : form.ip
        ? `${t("printer.tcpPrinter")} · ${form.ip}:${form.port}`
        : t("printer.tcpPrinter");

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <BackButton
        fallbackHref="/printers"
        label={t("printer.title")}
        className="self-start"
        onClick={handleCancel}
      />
      {form.recordMissing ? (
        <Alert variant="destructive">
          <AlertTitle>{t("printer.printerNotFound")}</AlertTitle>
          <AlertDescription>
            {t("printer.printerNotFoundDescription")}
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Header: what this screen is for, and the printer's current connection at a glance. */}
      <header className="relative isolate flex flex-col gap-4 overflow-hidden rounded-2xl bg-primary p-5 text-primary-foreground shadow-dash-plate sm:flex-row sm:items-center sm:p-6">
        <span aria-hidden="true" className="pointer-events-none absolute -top-16 -right-16 -z-10 size-56 rounded-full bg-(--dash-sheen)" />
        <span aria-hidden="true" className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-(--dash-shade)">
          <Printer className="size-7" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold sm:text-2xl">
              {form.isEditing ? t("printer.edit") : t("printer.add")}
            </h1>
            {form.isEditing ? (
              <Badge className="h-auto border-transparent bg-(--dash-shade) py-0.5 text-2xs text-primary-foreground">
                {t("actions.edit")}
              </Badge>
            ) : null}
          </div>
          <p className="text-sm">{t("printer.formHint")}</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end">
          <Badge className="h-auto gap-1.5 border-transparent bg-(--dash-shade) py-1 text-xs text-primary-foreground">
            {form.connectType === "usb" ? <Usb data-icon="inline-start" /> : <Wifi data-icon="inline-start" />}
            {connectionSummary}
          </Badge>
          {form.displayName ? (
            <Badge className="h-auto gap-1.5 border-transparent bg-(--dash-shade) py-1 text-xs text-primary-foreground">
              <Printer data-icon="inline-start" />
              {form.displayName}
            </Badge>
          ) : null}
        </div>
      </header>

      <form onSubmit={form.submit} className="flex flex-col gap-5">
        <FormSection
          step={1}
          tone="info"
          icon={Cable}
          title={t("printer.connection")}
          description={t("printer.connectionHint")}
        >
          <ChoiceCards
            legend={t("fields.connectType")}
            name="printer-connect-type"
            tone="info"
            value={form.connectType}
            disabled={form.saving}
            onValueChange={(value) => form.setConnectType(value as ConnectType)}
            options={[
              { value: "tcp", label: t("printer.tcpPrinter"), description: t("printer.connectTcpHint"), icon: Wifi },
              { value: "usb", label: t("printer.usbPrinter"), description: t("printer.connectUsbHint"), icon: Usb },
            ]}
          />

          <FieldGroup className="grid gap-4 md:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="printer-display-name">
                {t("fields.displayName")}
                <span className="text-destructive"> *</span>
              </FieldLabel>
              <Input
                id="printer-display-name"
                name="printer_display_name"
                autoComplete="off"
                value={form.displayName}
                disabled={form.saving}
                required
                onChange={(event) => form.setDisplayName(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="printer-paper-width">
                {t("fields.paperWidth")}
              </FieldLabel>
              <Input
                id="printer-paper-width"
                name="printer_paper_width"
                autoComplete="off"
                value={form.paperWidth}
                disabled={form.saving}
                type="number"
                inputMode="numeric"
                required
                onChange={(event) => form.setPaperWidth(event.target.value)}
              />
            </Field>

            {form.connectType === "usb" ? (
              <Field className="md:col-span-2">
                <div className="flex items-center justify-between gap-2">
                  <FieldLabel htmlFor="printer-usb-device">
                    {t("printer.selectedPrinter")}
                  </FieldLabel>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    disabled={form.searching || form.saving}
                    onClick={() => void form.searchUsbDevices(true)}
                  >
                    {form.searching ? (
                      <Spinner data-icon="inline-start" />
                    ) : (
                      <RefreshCw data-icon="inline-start" />
                    )}
                    {t("actions.refresh")}
                  </Button>
                </div>
                <Select
                  value={form.selectedDevice}
                  disabled={!form.usbOptions.length || form.searching || form.saving}
                  onValueChange={form.selectDevice}
                >
                  <SelectTrigger id="printer-usb-device" className="w-full">
                    <SelectValue
                      placeholder={
                        form.searching
                          ? t("printer.searchingUsb")
                          : t("printer.selectUsbPrinter")
                      }
                    />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectGroup>
                      {form.usbOptions.map((printer: SearchPrinterResult) => (
                        <SelectItem
                          key={printer.interface_value}
                          value={printer.interface_value}
                        >
                          {printer.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldDescription aria-live="polite">
                  {form.usbSelectDescription}
                </FieldDescription>
              </Field>
            ) : (
              <>
                <Field>
                  <FieldLabel htmlFor="printer-ip">
                    {t("fields.ip")}
                    <span className="text-destructive"> *</span>
                  </FieldLabel>
                  <Input
                    id="printer-ip"
                    name="printer_ip"
                    autoComplete="off"
                    value={form.ip}
                    disabled={form.saving}
                    placeholder="192.168.100.75"
                    inputMode="decimal"
                    required
                    className="tabular-nums"
                    onChange={(event) =>
                      form.setIp(formatIpInput(event.target.value, form.ip))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="printer-port">
                    {t("fields.port")}
                  </FieldLabel>
                  <Input
                    id="printer-port"
                    name="printer_port"
                    autoComplete="off"
                    value={form.port}
                    disabled={form.saving}
                    type="number"
                    inputMode="numeric"
                    required
                    className="tabular-nums"
                    onChange={(event) => form.setPort(event.target.value)}
                  />
                </Field>
              </>
            )}
          </FieldGroup>

          {/* Self-test: a printed proof that the connection above works, before saving. */}
          <div className="flex flex-col gap-3 rounded-xl border border-info/40 bg-info/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-info text-info-foreground">
                <ScrollText className="size-4" />
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <p className="text-sm font-bold text-info-text">{t("printer.selfTestTitle")}</p>
                <p className="text-sm text-muted-foreground" id="printer-self-test-hint">
                  {t("printer.selfTestHint")}
                </p>
                <p className="text-sm text-muted-foreground" id="printer-self-test-connection-hint">
                  {t(form.connectType === "usb" ? "printer.selfTestUsbHint" : "printer.selfTestTcpHint")}
                </p>
              </div>
            </div>
            <Button
              type="button"
              className="min-h-11 w-full shrink-0 bg-info text-info-foreground hover:bg-info/90 sm:w-auto"
              disabled={!form.canSelfTest}
              aria-describedby="printer-self-test-hint printer-self-test-connection-hint"
              onClick={() => void form.printSelfTest()}
            >
              {form.printing ? <Spinner data-icon="inline-start" /> : <Printer data-icon="inline-start" />}
              {t(form.printing ? "printer.selfTestSending" : "printer.selfTestAction")}
            </Button>
          </div>
        </FormSection>

        <FormSection
          step={2}
          tone="primary"
          icon={ReceiptText}
          title={t("printer.roles")}
          description={t("printer.rolesHint")}
        >
          <CheckboxOptionList
            bare
            legend={t("printer.roles")}
            description={t("printer.rolesHint")}
            emptyLabel={t("printer.noRoles")}
            name="printer-role"
            options={form.roleOptions}
            required
            selectAllLabel={t("common.selectAll")}
            selected={form.selectedRoles}
            onToggle={(value) =>
              form.setSelectedRoles((current) => toggleValue(current, value))
            }
            onToggleAll={(checked) =>
              form.setSelectedRoles((current) =>
                toggleAllValues(current, form.roleOptions, checked),
              )
            }
          />
        </FormSection>

        <FormSection
          step={3}
          tone="warning"
          icon={Route}
          title={t("printer.mappingType")}
          description={
            form.zoneMappingRequired
              ? t("printer.mappingTypeZoneRequiredHint")
              : t("printer.mappingTypeHint")
          }
        >
          <ChoiceCards
            className="sm:grid-cols-3"
            legend={t("printer.mappingType")}
            name="printer-mapping-type"
            tone="warning"
            value={form.mappingType}
            disabled={form.saving}
            onValueChange={(value) => form.setMappingType(value as MappingTypeSelection)}
            options={[
              { value: "OFF", label: t("printer.mappingTypeOff"), description: t("printer.mappingOffHint"), icon: Ban },
              { value: "ZONE", label: t("printer.mappingTypeZone"), description: t("printer.mappingZoneHint"), icon: MapPinned },
              { value: "CATEGORY", label: t("printer.mappingTypeCategory"), description: t("printer.mappingCategoryHint"), icon: Tags },
            ]}
          />

          {form.mappingType === "ZONE" ? (
            <CheckboxOptionList
              legend={t("printer.zones")}
              description={t("printer.zonesHint")}
              emptyLabel={t("printer.noZones")}
              name="printer-zone"
              options={form.zoneOptions}
              required
              selectAllLabel={t("common.selectAll")}
              selected={form.selectedZones}
              onToggle={(value) =>
                form.setSelectedZones((current) => toggleValue(current, value))
              }
              onToggleAll={(checked) =>
                form.setSelectedZones((current) =>
                  toggleAllValues(current, form.zoneOptions, checked),
                )
              }
            />
          ) : null}

          {/* backend บังคับ: ZONE ต้องเลือกหมวดหมู่คู่กับโซนด้วยเสมอ ไม่ใช่เลือกอย่างใดอย่างหนึ่ง —
              hint จึงต้องเปลี่ยนไปตามโหมด ไม่งั้นผู้ใช้จะไม่เข้าใจว่าทำไมบังคับเลือก
              "OFF" (ค่าเริ่มต้น) ไม่ผูกกับเมนูเลย จึงซ่อนไปทั้งช่อง ไม่ใช่แค่ปล่อยว่างได้ —
              เครื่องพิมพ์ใบเรียกเก็บเงิน/ใบเสร็จ/รายงานไม่ต้องเห็น checkbox list ว่างๆ นี้เลย */}
          {form.mappingType !== "OFF" ? (
            <CheckboxOptionList
              legend={t("printer.categories")}
              description={
                form.mappingType === "ZONE"
                  ? t("printer.categoriesHintZone")
                  : t("printer.categoriesHint")
              }
              emptyLabel={t("printer.noCategories")}
              name="printer-category"
              options={form.categoryOptions}
              required={form.mappingType === "ZONE"}
              selectAllLabel={t("common.selectAll")}
              selected={form.selectedCategories}
              onToggle={(value) =>
                form.setSelectedCategories((current) => toggleValue(current, value))
              }
              onToggleAll={(checked) =>
                form.setSelectedCategories((current) =>
                  toggleAllValues(current, form.categoryOptions, checked),
                )
              }
            />
          ) : null}
        </FormSection>

        <FormSection
          step={4}
          tone="success"
          icon={SlidersHorizontal}
          title={t("printer.printSettingsTitle")}
          description={t("printer.printSettingsHint")}
        >
          <PrinterOutputSettings
            accessMode={form.accessMode}
            onAccessModeChange={form.setAccessMode}
            connectType={form.connectType}
            saving={form.saving}
            internetSettings={form.internetSettings}
            loadingInternetSettings={form.loadingInternetSettings}
            kitchenCutMode={form.kitchenCutMode}
            onKitchenCutModeChange={form.setKitchenCutMode}
            showQueueTicketOption={form.showQueueTicketOption}
            queueTicketEnabled={form.queueTicketEnabled}
            onQueueTicketEnabledChange={form.setQueueTicketEnabled}
            cashDrawerEnabled={form.cashDrawerEnabled}
            onCashDrawerEnabledChange={form.setCashDrawerEnabled}
            buzzerOnCut={form.buzzerOnCut}
            onBuzzerOnCutChange={form.setBuzzerOnCut}
            cutFeedLines={form.cutFeedLines}
            onCutFeedLinesChange={form.setCutFeedLines}
          />
        </FormSection>

        {/* Save bar: what is still missing (or that the form is complete), then the actions. */}
        <div
          className={cn(
            "flex flex-col gap-3 rounded-2xl border-2 p-4 sm:flex-row sm:items-center sm:justify-between",
            form.validationMessage ? "border-destructive/40 bg-destructive/5" : "border-success/40 bg-success/10",
          )}
        >
          {/* สรุปเหตุผลที่ยังบันทึกไม่ได้ — ผู้ใช้ที่เลื่อนผ่าน badge สีแดงด้านบนไปแล้วจะได้รู้ว่าขาดอะไร
              โดยไม่ต้องเลื่อนกลับไปหาทีละช่อง */}
          <p
            className={cn(
              "flex items-start gap-2 text-sm font-medium",
              form.validationMessage ? "text-destructive" : "text-success-text",
            )}
            aria-live="polite"
          >
            {form.validationMessage ? (
              <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            ) : (
              <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            )}
            {!form.saving && form.validationMessage ? form.validationMessage : t("printer.formReady")}
          </p>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-10"
              disabled={form.saving}
              onClick={handleCancel}
            >
              {t("actions.cancel")}
            </Button>
            {/* กดได้เสมอแม้ยังกรอกไม่ครบ — validationMessage ด้านบนบอกเหตุผลอยู่แล้วตลอดเวลา
                ปุ่ม submit ที่ถูก disable ล่วงหน้าทำให้ผู้ใช้งงว่าทำไมกดไม่ได้ (ดู submit() ที่ no-op
                เองถ้ายัง !canSubmit) */}
            <Button className="min-h-10 px-5" disabled={form.saving || form.loading || form.printing} type="submit">
              {form.saving ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Save data-icon="inline-start" />
              )}
              {form.saving ? t("common.processing") : t("actions.save")}
            </Button>
          </div>
        </div>
      </form>

      <PrinterSelfTestDialog pendingSelfTest={form.pendingSelfTest} printing={form.printing} onReady={form.completeSelfTest} />

      <AlertDialog open={confirmDiscardOpen} onOpenChange={setConfirmDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("printer.discardChangesTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("printer.discardChangesDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("printer.discardChangesStay")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => form.router.push("/printers")}
            >
              {t("printer.discardChangesLeave")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
