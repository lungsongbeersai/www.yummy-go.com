"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  SettingsDialogBody,
  SettingsDialogContent,
  SettingsDialogFooter,
  SettingsDialogForm,
  SettingsDialogHeader
} from "@/features/settings/shared/settings-shell";
import {
  locationId,
  locationValue,
  type LocationKind
} from "./location-utils";
import type { LocationLabels, LocationSettingsRow } from "./location-types";
import { ProvinceCombobox } from "./province-combobox";

export function LocationFormDialog({
  description,
  editing,
  kind,
  labels,
  onOpenChange,
  onSubmit,
  open,
  provinceLoading,
  provinces,
  saving,
  title
}: {
  description: string;
  editing: LocationSettingsRow | null;
  kind: LocationKind;
  labels: LocationLabels;
  onOpenChange: (open: boolean) => void;
  onSubmit: (formData: FormData) => Promise<void>;
  open: boolean;
  provinceLoading: boolean;
  provinces: LocationSettingsRow[];
  saving: boolean;
  title: string;
}) {
  const { t } = useTranslation();
  const [provinceUuid, setProvinceUuid] = useState("");
  const [nameLa, setNameLa] = useState("");
  const [nameEng, setNameEng] = useState("");
  const formKey = locationId(editing, kind) || `new-${kind}`;
  const detailsTitle = kind === "province" ? t("settings.provinceDetails") : t("settings.districtDetails");
  const detailsHint = kind === "province" ? t("settings.provinceDetailsHint") : t("settings.districtDetailsHint");
  const formHint = kind === "province" ? t("settings.provinceFormHint") : t("settings.districtFormHint");
  const saveDisabled = saving || !nameLa.trim() || (kind === "district" && !provinceUuid.trim());

  useEffect(() => {
    setProvinceUuid(locationValue(editing, "province_uuid_fk"));
    setNameLa(locationValue(editing, `${kind}_name_la`, locationValue(editing, `${kind}_name`)));
    setNameEng(locationValue(editing, `${kind}_name_eng`));
  }, [editing, kind, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SettingsDialogContent className="sm:max-w-2xl">
        <SettingsDialogForm key={formKey} action={onSubmit}>
          <SettingsDialogHeader>
            <DialogTitle>{editing ? t("settings.editRecord") : t("settings.newRecord")}: {title}</DialogTitle>
            <DialogDescription>{formHint || description}</DialogDescription>
          </SettingsDialogHeader>
          <SettingsDialogBody>
            <FieldGroup>
              <FieldSet className="gap-4 rounded-lg border border-border bg-card p-4">
                <Field>
                  <FieldLegend>{detailsTitle}</FieldLegend>
                  <FieldDescription>{detailsHint}</FieldDescription>
                </Field>
                <FieldGroup className="grid gap-3 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor={`${kind}_name_la`}>{t("fields.nameLa")}</FieldLabel>
                    <Input
                      autoComplete="off"
                      id={`${kind}_name_la`}
                      name={`${kind}_name_la`}
                      required
                      value={nameLa}
                      onChange={(event) => setNameLa(event.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`${kind}_name_eng`}>{t("fields.nameEn")}</FieldLabel>
                    <Input
                      autoComplete="off"
                      id={`${kind}_name_eng`}
                      name={`${kind}_name_eng`}
                      value={nameEng}
                      onChange={(event) => setNameEng(event.target.value)}
                    />
                  </Field>
                </FieldGroup>
              </FieldSet>
              {kind === "district" ? (
                <FieldSet className="gap-4 rounded-lg border border-border bg-card p-4">
                  <Field>
                    <FieldLegend>{t("settings.districtProvinceSection")}</FieldLegend>
                    <FieldDescription>{t("settings.districtProvinceHint")}</FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="province_uuid_fk">{labels.province}</FieldLabel>
                    <ProvinceCombobox
                      disabled={saving}
                      id="province_uuid_fk"
                      loading={provinceLoading}
                      provinces={provinces}
                      value={provinceUuid}
                      onValueChange={setProvinceUuid}
                    />
                  </Field>
                </FieldSet>
              ) : null}
            </FieldGroup>
          </SettingsDialogBody>
          <SettingsDialogFooter>
            <Button disabled={saving} type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("actions.cancel")}
            </Button>
            <Button disabled={saveDisabled} type="submit">
              {saving ? <Spinner data-icon="inline-start" /> : null}
              {saving ? t("common.processing") : t("actions.save")}
            </Button>
          </SettingsDialogFooter>
        </SettingsDialogForm>
      </SettingsDialogContent>
    </Dialog>
  );
}
