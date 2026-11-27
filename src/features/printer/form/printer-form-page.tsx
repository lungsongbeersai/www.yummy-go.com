"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Ban,
  MapPinned,
  Printer,
  RefreshCw,
  Save,
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
import type {
  SearchPrinterResult,
} from "@/services/printer";
import { CheckboxOptionList } from "./printer-form-fields";
import { ChoiceCards, FormSection } from "./printer-form-sections";
import {
  formatIpInput,
  sunmiBuiltinDiagnosticMessageKey,
  toggleAllValues,
  toggleValue,
  type ConnectType,
  type MappingTypeSelection,
} from "./printer-form-utils";
import { usePrinterForm } from "./use-printer-form";
import { PrinterOutputSettings } from "./printer-output-settings";
import { PrinterCategoryPrintRoles, PrinterPrintPermissions } from "./printer-print-permissions";
import { PrinterSelfTestDialog } from "@/features/printer/printer-self-test-dialog";
import { PrinterSupportPanel } from "@/features/printer/printer-support-panel";

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

  const builtinStatus = form.builtinDiagnostic.status;
  const builtinMessage = sunmiBuiltinDiagnosticMessageKey(form.builtinDiagnostic);
  const builtinFailure = !["idle", "checking", "available"].includes(builtinStatus);

  return (
    <div data-sunmi-printer-form={form.connectType === "sunmi" ? "true" : undefined} className="flex w-full flex-col gap-4">
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

      <h1 className="text-xl font-semibold">
        {form.isEditing ? t("printer.edit") : t("printer.add")}
      </h1>

      <form onSubmit={form.submit} className="flex flex-col gap-4">
        <FormSection title={t("printer.connection")}>
          <ChoiceCards
            legend={t("fields.connectType")}
            name="printer-connect-type"
            value={form.connectType}
            disabled={form.saving}
            onValueChange={(value) => form.setConnectType(value as ConnectType)}
            options={[
              { value: "tcp", label: t("printer.tcpPrinter"), description: t("printer.connectTcpHint"), icon: Wifi },
              { value: "usb", label: t("printer.usbPrinter"), description: t("printer.connectUsbHint"), icon: Usb },
              ...(form.showBuiltinChoice ? [{ value: "sunmi", label: t("printer.sunmiPrinter"), description: t("printer.connectSunmiHint"), icon: Printer, disabled: !form.builtinAgent || form.loadingBuiltinAgent }] : []),
            ]}
          />

          {form.builtinDiagnostic.nativeAndroid ? (
            <Alert data-sunmi-printer-diagnostic={builtinStatus} variant={builtinFailure ? "destructive" : "default"}>
              <Printer aria-hidden="true" />
              <AlertTitle>{t("printer.sunmiPrinter")}</AlertTitle>
              <AlertDescription className="flex min-w-0 flex-col items-start gap-2 text-left">
                <p>{t(builtinMessage)}</p>
                {form.builtinDiagnostic.installedVersion || form.builtinDiagnostic.model ? (
                  <p className="break-words">
                    {[
                      form.builtinDiagnostic.installedVersion
                        ? `Yummy Go ${form.builtinDiagnostic.installedVersion}${form.builtinDiagnostic.installedBuild ? ` (${form.builtinDiagnostic.installedBuild})` : ""}`
                        : null,
                      form.builtinDiagnostic.model,
                    ].filter(Boolean).join(" · ")}
                  </p>
                ) : null}
                {builtinFailure && (form.builtinDiagnostic.reason || form.builtinDiagnostic.error) ? (
                  <p className="w-full break-words" data-sunmi-printer-diagnostic-detail>
                    {[form.builtinDiagnostic.reason, form.builtinDiagnostic.error].filter(Boolean).join(" · ")}
                  </p>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  disabled={form.loadingBuiltinAgent || form.saving}
                  onClick={form.retryBuiltinDetection}
                >
                  {form.loadingBuiltinAgent ? <Spinner data-icon="inline-start" /> : <RefreshCw data-icon="inline-start" />}
                  {t("printer.sunmiCheckAgain")}
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

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
              <Select
                name="printer_paper_width"
                value={form.paperWidth}
                disabled={form.saving}
                required
                onValueChange={form.setPaperWidth}
              >
                <SelectTrigger id="printer-paper-width" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectGroup>
                    <SelectItem value="80">80 mm</SelectItem>
                    <SelectItem value="58">58 mm</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
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
            ) : form.connectType === "sunmi" ? (
              <Field className="md:col-span-2">
                <FieldDescription aria-live="polite">
                  {t(builtinMessage)}
                </FieldDescription>
                <FieldDescription>{t("printer.sunmiSharedHint")}</FieldDescription>
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

          <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="text-sm font-medium">{t(form.connectType === "sunmi" ? "printer.sunmiTestTitle" : "printer.selfTestTitle")}</p>
              <p className="text-xs text-muted-foreground" id="printer-self-test-hint">
                {t(form.connectType === "sunmi" ? "printer.sunmiTestHint" : "printer.selfTestHint")}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full shrink-0 sm:w-auto"
              disabled={!form.canSelfTest}
              aria-describedby="printer-self-test-hint"
              onClick={() => void form.printSelfTest()}
            >
              {form.printing ? <Spinner data-icon="inline-start" /> : <Printer data-icon="inline-start" />}
              {t(form.printing ? "printer.selfTestSending" : form.connectType === "sunmi" ? "printer.sunmiTestAction" : "printer.selfTestAction")}
            </Button>
          </div>
        </FormSection>

        {form.savedPrinter?.connect_type.toLowerCase() === "tcp" ? (
          <PrinterSupportPanel printer={form.savedPrinter} dirty={form.isDirty} disabled={form.saving || form.loading} />
        ) : null}

        <FormSection title={t("printer.roles")}>
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
          {form.zoneMappingRequired ? null : (
            <p className="text-sm text-muted-foreground">{t("printer.mappingUnlockHint")}</p>
          )}
        </FormSection>

        {/* หมวดหมู่/โซนใช้กับสถานีครัว/บาร์เท่านั้น — ไม่มี role พวกนี้ก็ไม่ต้องแสดงขั้นนี้ */}
        {form.zoneMappingRequired ? (
          <FormSection title={t("printer.mappingType")}>
            <ChoiceCards
              className="sm:grid-cols-3"
              legend={t("printer.mappingType")}
              name="printer-mapping-type"
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

            <PrinterPrintPermissions form={form} />

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
                disabled={form.saving}
                renderOptionDetails={form.printRoleMode === 2 ? (category) => (
                  <PrinterCategoryPrintRoles form={form} categoryUuid={category.value} categoryLabel={category.label} />
                ) : undefined}
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
        ) : null}

        <FormSection title={t("printer.printSettingsTitle")}>
          <PrinterOutputSettings
            accessMode={form.accessMode}
            onAccessModeChange={form.setAccessMode}
            connectType={form.connectType}
            canShareUsb={form.canShareUsb}
            saving={form.saving}
            internetSettings={form.internetSettings}
            loadingInternetSettings={form.loadingInternetSettings}
            kitchenCutMode={form.kitchenCutMode}
            onKitchenCutModeChange={form.setKitchenCutMode}
            showQueueTicketOption={form.showQueueTicketOption}
            queueTicketEnabled={form.queueTicketEnabled}
            onQueueTicketEnabledChange={form.setQueueTicketEnabled}
            printShowLogo={form.printShowLogo}
            onPrintShowLogoChange={form.setPrintShowLogo}
            cashDrawerEnabled={form.cashDrawerEnabled}
            onCashDrawerEnabledChange={form.setCashDrawerEnabled}
            buzzerOnCut={form.buzzerOnCut}
            onBuzzerOnCutChange={form.setBuzzerOnCut}
            cutFeedLines={form.cutFeedLines}
            onCutFeedLinesChange={form.setCutFeedLines}
          />
        </FormSection>

        <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex min-h-5 items-start gap-2 text-sm text-destructive" aria-live="polite">
            {!form.saving && form.validationMessage ? (
              <>
                <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                {form.validationMessage}
              </>
            ) : null}
          </p>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={form.saving}
              onClick={handleCancel}
            >
              {t("actions.cancel")}
            </Button>
            {/* Always clickable: the message beside it says what is missing. */}
            <Button className="min-h-11 px-5" disabled={form.saving || form.loading || form.printing} type="submit">
              {form.saving ? <Spinner data-icon="inline-start" /> : <Save data-icon="inline-start" />}
              {form.saving ? t("common.processing") : t("actions.save")}
            </Button>
          </div>
        </div>
      </form>

      <PrinterSelfTestDialog
        pendingSelfTest={form.pendingSelfTest} printing={form.printing} onReady={form.completeSelfTest}
        selection={form.selfTestSelection} profile={form.selfTestProfile} onProfileChange={form.setSelfTestProfile}
        onConfirm={form.confirmSelfTest} onCancel={form.cancelSelfTest}
        phase={form.selfTestPhase} error={form.selfTestError} onCheck={form.checkSelfTest}
      />

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
