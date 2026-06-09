"use client";

import { useEffect, useState } from "react";
import { CircleHelp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  SettingsDialogBody,
  SettingsDialogContent,
  SettingsDialogFooter,
  SettingsDialogForm,
  SettingsDialogHeader
} from "@/features/settings/shared/settings-shell";
import type { Table as DiningTable } from "@/services/table";
import type { Zone } from "@/services/zone";
import { TableChargeBadge } from "./table-display";
import type { TableServiceCharge } from "./table-types";
import {
  serviceChargeSummary,
  tableId,
  tableValue,
  zoneLabel
} from "./table-utils";

export function TableFormDialog({
  branchUuid,
  editing,
  onOpenChange,
  onSubmit,
  open,
  saving,
  serviceCharge,
  serviceChargeLoading,
  title,
  zones
}: {
  branchUuid: string;
  editing: DiningTable | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (formData: FormData) => Promise<void>;
  open: boolean;
  saving: boolean;
  serviceCharge: TableServiceCharge;
  serviceChargeLoading: boolean;
  title: string;
  zones: Zone[];
}) {
  const { t } = useTranslation();
  const [zoneUuid, setZoneUuid] = useState("");
  const [tableNameLa, setTableNameLa] = useState("");
  const [chargeStatus, setChargeStatus] = useState("2");
  const formKey = tableId(editing) || "new-table";
  const serviceChargeText = serviceChargeSummary({
    activeLabel: t("common.active"),
    inactiveLabel: t("common.inactive"),
    loading: serviceChargeLoading,
    loadingLabel: t("common.loading"),
    serviceCharge
  });

  useEffect(() => {
    setZoneUuid(tableValue(editing, "zone_uuid_fk"));
    setTableNameLa(tableValue(editing, "table_name_la", tableValue(editing, "table_name")));
    setChargeStatus(tableValue(editing, "charge_status", "2"));
  }, [editing, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SettingsDialogContent className="sm:max-w-3xl">
        <SettingsDialogForm key={formKey} action={onSubmit}>
          <SettingsDialogHeader>
            <DialogTitle>{editing ? t("settings.editRecord") : t("settings.newRecord")}: {title}</DialogTitle>
            <DialogDescription>{t("settings.tableFormHint")}</DialogDescription>
          </SettingsDialogHeader>
          <SettingsDialogBody>
            <FieldGroup>
              <FieldSet className="gap-4 rounded-lg border border-border bg-card p-4">
                <Field>
                  <FieldLegend>{t("settings.tableDetails")}</FieldLegend>
                  <FieldDescription>{t("settings.tableDetailsHint")}</FieldDescription>
                </Field>
                <FieldGroup className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="table_name_la">{t("fields.table_name_la")}</FieldLabel>
                    <Input
                      id="table_name_la"
                      name="table_name_la"
                      autoComplete="off"
                      disabled={saving}
                      required
                      value={tableNameLa}
                      onChange={(event) => setTableNameLa(event.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="table_name_eng">{t("fields.table_name_eng")}</FieldLabel>
                    <Input
                      id="table_name_eng"
                      name="table_name_eng"
                      autoComplete="off"
                      defaultValue={tableValue(editing, "table_name_eng")}
                      disabled={saving}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="table_qty">{t("fields.table_qty")}</FieldLabel>
                    <Input
                      id="table_qty"
                      name="table_qty"
                      autoComplete="off"
                      defaultValue={tableValue(editing, "table_qty", tableValue(editing, "number_of_seats"))}
                      disabled={saving}
                      inputMode="numeric"
                      min={0}
                      step={1}
                      type="number"
                    />
                  </Field>
                </FieldGroup>
              </FieldSet>

              <FieldSet className="gap-4 rounded-lg border border-border bg-card p-4">
                <Field>
                  <FieldLegend>{t("settings.tableZoneSection")}</FieldLegend>
                  <FieldDescription>{t("settings.tableZoneHint")}</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="zone_uuid_fk">{t("nav.zone")}</FieldLabel>
                  <input name="zone_uuid_fk" type="hidden" value={zoneUuid} />
                  <Select disabled={saving} required value={zoneUuid} onValueChange={setZoneUuid}>
                    <SelectTrigger id="zone_uuid_fk" className="w-full">
                      <SelectValue placeholder={t("settings.selectZone")} />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectGroup>
                        {zones.map((zone) => {
                          const uuid = tableValue(zone, "zone_uuid");
                          if (!uuid) return null;
                          return (
                            <SelectItem key={uuid} value={uuid}>
                              {zoneLabel(zone)}
                            </SelectItem>
                          );
                        })}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </FieldSet>

              <FieldSet className="gap-4 rounded-lg border border-border bg-card p-4">
                <Field>
                  <div className="flex min-w-0 items-center gap-2">
                    <FieldLegend>{t("settings.tableServiceChargeSection")}</FieldLegend>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          aria-label={t("settings.tableChargeTooltip")}
                          className="size-6 rounded-full text-muted-foreground hover:bg-muted"
                          disabled={saving}
                          size="iconSm"
                          type="button"
                          variant="ghost"
                        >
                          <CircleHelp aria-hidden data-icon />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-64" side="top">
                        {t("settings.tableChargeTooltip")}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <FieldDescription>{t("settings.tableChargeHint")}</FieldDescription>
                </Field>
                <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-md border border-border bg-muted/25 px-3 py-2 text-sm">
                  <span className="font-bold text-muted-foreground">{t("settings.tableBranchCharge")}</span>
                  <TableChargeBadge active={serviceCharge.active} label={serviceChargeText} />
                </div>
                <Field>
                  <FieldLabel>{t("fields.charge_status")}</FieldLabel>
                  <input name="charge_status" type="hidden" value={chargeStatus} />
                  <RadioGroup className="grid gap-2 sm:grid-cols-2" value={chargeStatus} onValueChange={setChargeStatus}>
                    <label
                      className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-border bg-card p-3 text-sm font-medium has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5"
                      htmlFor="charge_status_2"
                    >
                      <RadioGroupItem id="charge_status_2" disabled={saving} value="2" />
                      {t("common.inactive")}
                    </label>
                    <label
                      className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-border bg-card p-3 text-sm font-medium has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5"
                      htmlFor="charge_status_1"
                    >
                      <RadioGroupItem id="charge_status_1" disabled={saving} value="1" />
                      {t("common.active")}
                    </label>
                  </RadioGroup>
                </Field>
              </FieldSet>
            </FieldGroup>
          </SettingsDialogBody>
          <input name="branch_uuid_fk" type="hidden" value={branchUuid} readOnly />
          <SettingsDialogFooter>
            <Button disabled={saving} type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("actions.cancel")}
            </Button>
            <Button disabled={saving || !branchUuid || !zoneUuid || !tableNameLa.trim()} type="submit">
              {saving ? <Spinner data-icon="inline-start" /> : null}
              {saving ? t("common.processing") : t("actions.save")}
            </Button>
          </SettingsDialogFooter>
        </SettingsDialogForm>
      </SettingsDialogContent>
    </Dialog>
  );
}
