"use client";

import { RefreshCw, Save } from "lucide-react";
import { BackButton } from "@/components/common/back-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  PrinterMappingType,
  PrinterSharingMode,
  SearchPrinterResult,
} from "@/services/printer";
import { CheckboxOptionList } from "./printer-form-fields";
import {
  formatIpInput,
  toggleAllValues,
  toggleValue,
  type ConnectType,
} from "./printer-form-utils";
import { usePrinterForm } from "./use-printer-form";

export function PrinterFormPage() {
  const form = usePrinterForm();
  const { t } = form;

  return (
    <div className="flex flex-col gap-5">
      <BackButton
        fallbackHref="/printers"
        label={t("printer.title")}
        className="self-start"
      />
      <Card>
        <CardHeader>
          <div>
            <CardTitle>
              {form.isEditing ? t("printer.edit") : t("printer.add")}
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("printer.formHint")}
            </p>
          </div>
          {form.isEditing ? <Badge>{t("actions.edit")}</Badge> : null}
        </CardHeader>
        <CardContent>
          <form onSubmit={form.submit} className="flex flex-col gap-4">
            <FieldSet className="gap-4 rounded-lg border border-border bg-card p-4">
              <div>
                <FieldLegend className="mb-1 text-sm font-black">
                  {t("printer.connection")}
                </FieldLegend>
                <FieldDescription>
                  {t("printer.connectionHint")}
                </FieldDescription>
              </div>

              <FieldGroup className="grid gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="printer-display-name">
                    {t("fields.displayName")}
                  </FieldLabel>
                  <Input
                    id="printer-display-name"
                    value={form.displayName}
                    disabled={form.saving}
                    required
                    onChange={(event) => form.setDisplayName(event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="printer-connect-type">
                    {t("fields.connectType")}
                  </FieldLabel>
                  <Select
                    value={form.connectType}
                    onValueChange={(value) =>
                      form.setConnectType(value as ConnectType)
                    }
                  >
                    <SelectTrigger id="printer-connect-type" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectGroup>
                        <SelectItem value="usb">
                          {t("printer.usbPrinter")}
                        </SelectItem>
                        <SelectItem value="tcp">
                          {t("printer.tcpPrinter")}
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>

                {form.connectType === "usb" ? (
                  <>
                    <Field>
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
                        disabled={!form.found.length || form.searching || form.saving}
                        onValueChange={form.selectDevice}
                      >
                        <SelectTrigger
                          id="printer-usb-device"
                          className="w-full"
                        >
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
                            {form.found.map((printer: SearchPrinterResult) => (
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
                      <FieldDescription>
                        {form.usbSelectDescription}
                      </FieldDescription>
                    </Field>
                    {/* <Field>
                      <FieldLabel htmlFor="printer-interface-value">{t("fields.interfaceValue")}</FieldLabel>
                      <Input
                        id="printer-interface-value"
                        value={interfaceValue}
                        disabled={saving}
                        placeholder={t("printer.interfacePlaceholder")}
                        required
                        onChange={(event) => setInterfaceValue(event.target.value)}
                      />
                    </Field> */}
                  </>
                ) : (
                  <>
                    <Field>
                      <FieldLabel htmlFor="printer-ip">
                        {t("fields.ip")}
                      </FieldLabel>
                      <Input
                        id="printer-ip"
                        value={form.ip}
                        disabled={form.saving}
                        placeholder="192.168.100.75"
                        inputMode="decimal"
                        required
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
                        value={form.port}
                        disabled={form.saving}
                        type="number"
                        required
                        onChange={(event) => form.setPort(event.target.value)}
                      />
                    </Field>
                  </>
                )}

                <Field>
                  <FieldLabel htmlFor="printer-paper-width">
                    {t("fields.paperWidth")}
                  </FieldLabel>
                  <Input
                    id="printer-paper-width"
                    value={form.paperWidth}
                    disabled={form.saving}
                    type="number"
                    required
                    onChange={(event) => form.setPaperWidth(event.target.value)}
                  />
                </Field>
                <Field className="md:col-span-2">
                  <FieldLabel htmlFor="printer-sharing-mode-shared">
                    {t("printer.sharingMode")}
                  </FieldLabel>
                  <FieldDescription>
                    {t("printer.sharingModeHint")}
                  </FieldDescription>
                  <RadioGroup
                    value={form.sharingMode}
                    onValueChange={(value) =>
                      form.setSharingMode(value as PrinterSharingMode)
                    }
                    className="flex flex-row flex-wrap gap-6"
                  >
                    <div className="flex items-center gap-3">
                      <RadioGroupItem
                        id="printer-sharing-mode-shared"
                        value="SHARED"
                        disabled={form.saving}
                      />
                      <Label htmlFor="printer-sharing-mode-shared">
                        {t("printer.sharingModeShared")}
                      </Label>
                    </div>
                    <div className="flex items-center gap-3">
                      <RadioGroupItem
                        id="printer-sharing-mode-dedicated"
                        value="DEDICATED"
                        disabled={form.saving}
                      />
                      <Label htmlFor="printer-sharing-mode-dedicated">
                        {t("printer.sharingModeDedicated")}
                      </Label>
                    </div>
                  </RadioGroup>
                </Field>
              </FieldGroup>
            </FieldSet>

            <CheckboxOptionList
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

            <FieldSet className="gap-4 rounded-lg border border-border bg-card p-4">
              <div>
                <FieldLegend className="mb-1 text-sm font-black">
                  {t("printer.mappingType")}
                </FieldLegend>
                <FieldDescription>{t("printer.mappingTypeHint")}</FieldDescription>
              </div>
              <Field>
                <Select
                  value={form.mappingType}
                  onValueChange={(value) =>
                    form.setMappingType(value as PrinterMappingType)
                  }
                >
                  <SelectTrigger id="printer-mapping-type" className="w-full sm:w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectGroup>
                      <SelectItem value="ZONE">
                        {t("printer.mappingTypeZone")}
                      </SelectItem>
                      <SelectItem value="CATEGORY">
                        {t("printer.mappingTypeCategory")}
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </FieldSet>

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
                hint จึงต้องเปลี่ยนไปตามโหมด ไม่งั้นผู้ใช้จะไม่เข้าใจว่าทำไมบังคับเลือก */}
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
              required
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

            <div className="flex flex-col items-end gap-2">
              {/* สรุปเหตุผลที่ยังบันทึกไม่ได้ — ผู้ใช้ที่เลื่อนผ่าน badge สีแดงด้านบนไปแล้วจะได้รู้ว่าขาดอะไร
                  โดยไม่ต้องเลื่อนกลับไปหาทีละช่อง */}
              {!form.saving && form.validationMessage ? (
                <p className="text-right text-sm text-destructive">
                  {form.validationMessage}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={form.saving}
                  onClick={() => form.router.push("/printers")}
                >
                  {t("actions.cancel")}
                </Button>
                <Button disabled={form.saving || form.loading || !form.canSubmit} type="submit">
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
        </CardContent>
      </Card>
    </div>
  );
}
