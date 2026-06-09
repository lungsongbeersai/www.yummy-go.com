"use client";

import { useEffect, useState } from "react";
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
import type { Category } from "@/services/category";
import { CategoryIconPicker } from "./category-icon-picker";
import {
  categoryId,
  categoryValue,
  type GroupOption
} from "./category-utils";

export function CategoryFormDialog({
  editing,
  groupOptions,
  onOpenChange,
  onSubmit,
  open,
  saving,
  title
}: {
  editing: Category | null;
  groupOptions: GroupOption[];
  onOpenChange: (open: boolean) => void;
  onSubmit: (formData: FormData) => Promise<void>;
  open: boolean;
  saving: boolean;
  title: string;
}) {
  const { t } = useTranslation();
  const [groupUuid, setGroupUuid] = useState("");
  const [nameLa, setNameLa] = useState("");
  const [nameEng, setNameEng] = useState("");
  const formKey = categoryId(editing) || "new-category";
  const canSubmit = Boolean(groupUuid && nameLa.trim()) && !saving;

  useEffect(() => {
    setGroupUuid(categoryValue(editing, "group_uuid_fk"));
    setNameLa(categoryValue(editing, "cate_name_la", categoryValue(editing, "cate_name")));
    setNameEng(categoryValue(editing, "cate_name_eng"));
  }, [editing, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SettingsDialogContent className="sm:max-w-5xl">
        <SettingsDialogForm key={formKey} action={onSubmit}>
          <SettingsDialogHeader>
            <DialogTitle>{editing ? t("settings.editRecord") : t("settings.newRecord")}: {title}</DialogTitle>
            <DialogDescription>{t("settings.categoryFormHint")}</DialogDescription>
          </SettingsDialogHeader>
          <SettingsDialogBody>
            <FieldGroup>
              <input name="cate_uuid" type="hidden" value={categoryId(editing)} />
              <FieldSet className="gap-4 rounded-lg border border-border bg-card p-4">
                <Field>
                  <FieldLegend>{t("settings.categoryDetails")}</FieldLegend>
                  <FieldDescription>{t("settings.categoryDetailsHint")}</FieldDescription>
                </Field>
                <FieldGroup className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="cate_name_la">{t("fields.nameLa")}</FieldLabel>
                    <Input
                      id="cate_name_la"
                      name="cate_name_la"
                      autoComplete="off"
                      disabled={saving}
                      required
                      value={nameLa}
                      onChange={(event) => setNameLa(event.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="cate_name_eng">{t("fields.nameEn")}</FieldLabel>
                    <Input
                      id="cate_name_eng"
                      name="cate_name_eng"
                      autoComplete="off"
                      disabled={saving}
                      value={nameEng}
                      onChange={(event) => setNameEng(event.target.value)}
                    />
                  </Field>
                </FieldGroup>
              </FieldSet>

              <FieldSet className="gap-4 rounded-lg border border-border bg-card p-4">
                <Field>
                  <FieldLegend>{t("settings.categoryGroupSection")}</FieldLegend>
                  <FieldDescription>
                    {groupOptions.length ? t("settings.categoryGroupHint") : t("settings.categoryGroupRequired")}
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="group_uuid_fk">{t("nav.food_group")}</FieldLabel>
                  <input name="group_uuid_fk" type="hidden" value={groupUuid} />
                  <Select disabled={saving || !groupOptions.length} required value={groupUuid} onValueChange={setGroupUuid}>
                    <SelectTrigger id="group_uuid_fk" className="w-full">
                      <SelectValue placeholder={t("settings.selectGroup")} />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectGroup>
                        {groupOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </FieldSet>

              <FieldSet className="gap-4 rounded-lg border border-border bg-card p-4">
                <Field>
                  <FieldLegend>{t("settings.categoryIconSection")}</FieldLegend>
                  <FieldDescription>{t("settings.categoryIconHint")}</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="cate_icon">{t("fields.icon")}</FieldLabel>
                  <CategoryIconPicker id="cate_icon" name="cate_icon" defaultValue={categoryValue(editing, "cate_icon")} disabled={saving} />
                </Field>
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
