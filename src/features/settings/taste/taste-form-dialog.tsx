"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  SettingsDialogBody,
  SettingsDialogContent,
  SettingsDialogFooter,
  SettingsDialogForm,
  SettingsDialogHeader
} from "@/features/settings/shared/settings-shell";
import { useResetOnChange } from "@/hooks/use-reset-on-change";
import type { Taste } from "@/services/taste";
import { tasteId, tasteStatus, tasteValue } from "./taste-utils";

export function TasteFormDialog({
  editing,
  onOpenChange,
  onSubmit,
  open,
  saving,
  title
}: {
  editing: Taste | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (formData: FormData) => Promise<void>;
  open: boolean;
  saving: boolean;
  title: string;
}) {
  const { t } = useTranslation();
  const [nameLa, setNameLa] = useState(() => tasteValue(editing, "taste_name_la", tasteValue(editing, "taste_name")));
  const [nameEng, setNameEng] = useState(() => tasteValue(editing, "taste_name_eng"));
  const [status, setStatus] = useState(() => tasteStatus(editing));
  const formKey = tasteId(editing) || "new-taste";
  const canSubmit = Boolean(nameLa.trim() && status) && !saving;

  useResetOnChange(`${formKey}:${open}`, () => {
    setNameLa(tasteValue(editing, "taste_name_la", tasteValue(editing, "taste_name")));
    setNameEng(tasteValue(editing, "taste_name_eng"));
    setStatus(tasteStatus(editing));
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SettingsDialogContent className="sm:max-w-2xl">
        <SettingsDialogForm key={formKey} action={onSubmit}>
          <SettingsDialogHeader>
            <DialogTitle>{editing ? t("settings.editRecord") : t("settings.newRecord")}: {title}</DialogTitle>
            <DialogDescription>{t("settings.tasteFormHint")}</DialogDescription>
          </SettingsDialogHeader>
          <SettingsDialogBody>
            <FieldGroup>
              <input name="taste_uuid" type="hidden" value={tasteId(editing)} />
              <FieldSet className="gap-4 rounded-lg border border-border bg-card p-4">
                <Field>
                  <FieldLegend>{t("settings.tasteDetails")}</FieldLegend>
                  <FieldDescription>{t("settings.tasteFormHint")}</FieldDescription>
                </Field>
                <FieldGroup className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="taste_name_la">{t("fields.taste_name_la")}</FieldLabel>
                    <Input
                      id="taste_name_la"
                      name="taste_name_la"
                      autoComplete="off"
                      disabled={saving}
                      required
                      value={nameLa}
                      onChange={(event) => setNameLa(event.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="taste_name_eng">{t("fields.taste_name_eng")}</FieldLabel>
                    <Input
                      id="taste_name_eng"
                      name="taste_name_eng"
                      autoComplete="off"
                      disabled={saving}
                      value={nameEng}
                      onChange={(event) => setNameEng(event.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="taste_status">{t("fields.taste_status")}</FieldLabel>
                    <input name="taste_status" type="hidden" value={status} />
                    <Select required disabled={saving} value={status} onValueChange={setStatus}>
                      <SelectTrigger id="taste_status" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent position="popper">
                        <SelectGroup>
                          <SelectItem value="1">{t("common.active")}</SelectItem>
                          <SelectItem value="2">{t("common.inactive")}</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                </FieldGroup>
              </FieldSet>
            </FieldGroup>
          </SettingsDialogBody>
          <SettingsDialogFooter>
            <Button disabled={saving} type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("actions.cancel")}
            </Button>
            <Button disabled={!canSubmit} type="submit">
              {saving ? <Spinner data-icon="inline-start" /> : null}
              {saving ? t("common.processing") : t("actions.save")}
            </Button>
          </SettingsDialogFooter>
        </SettingsDialogForm>
      </SettingsDialogContent>
    </Dialog>
  );
}
