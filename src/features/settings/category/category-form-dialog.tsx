"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  SettingsDialogBody,
  SettingsDialogContent,
  SettingsDialogFooter,
  SettingsDialogForm,
  SettingsDialogHeader
} from "@/features/settings/shared/settings-shell";
import { useResetOnChange } from "@/hooks/use-reset-on-change";
import type { Category, CategoryVisibilityRole } from "@/services/category";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useReferenceStore } from "@/stores/reference-store";
import { CategoryIconPicker } from "./category-icon-picker";
import {
  categoryGroupId,
  categoryId,
  categoryValue,
  categoryVisibility,
  categoryVisibilityRoleLabel,
  type GroupOption
} from "./category-utils";

export function CategoryFormDialog({
  editing,
  groupOptions,
  onOpenChange,
  onSubmit,
  open,
  saving,
  storeUuid,
  title
}: {
  editing: Category | null;
  groupOptions: GroupOption[];
  onOpenChange: (open: boolean) => void;
  onSubmit: (formData: FormData) => Promise<void>;
  open: boolean;
  saving: boolean;
  storeUuid?: string;
  title: string;
}) {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const loadVisibilityRoles = useReferenceStore((state) => state.loadCategoryVisibilityRoles);
  const [groupUuid, setGroupUuid] = useState(() => categoryGroupId(editing));
  const [nameLa, setNameLa] = useState(() =>
    categoryValue(editing, "cate_name_la", categoryValue(editing, "cate_name"))
  );
  const [nameEng, setNameEng] = useState(() => categoryValue(editing, "cate_name_eng"));
  const [visibility, setVisibility] = useState(() => categoryVisibility(editing));
  const [roleLoadAttempt, setRoleLoadAttempt] = useState(0);
  const [roleLoad, setRoleLoad] = useState<{
    key: string;
    roles: CategoryVisibilityRole[];
    error?: string;
  } | null>(null);
  const visibilityStoreUuid = storeUuid || categoryValue(editing, "store_uuid_fk") || authStoreUuid(user);
  const roleLoadKey = `${visibilityStoreUuid}:${i18n.language}:${roleLoadAttempt}`;
  const rolesLoaded = roleLoad?.key === roleLoadKey;
  const visibilityRoles = rolesLoaded ? roleLoad.roles : [];
  const rolesError = rolesLoaded ? roleLoad.error : undefined;
  const missingRole = !visibility.visibility_all_roles && !visibility.visibility_role_ids.length;
  const formKey = categoryId(editing) || "new-category";
  const canSubmit = Boolean(groupUuid && nameLa.trim()) && !saving &&
    (visibility.visibility_all_roles || (rolesLoaded && !rolesError && !missingRole));

  useResetOnChange(`${formKey}:${open}`, () => {
    setGroupUuid(categoryGroupId(editing));
    setNameLa(categoryValue(editing, "cate_name_la", categoryValue(editing, "cate_name")));
    setNameEng(categoryValue(editing, "cate_name_eng"));
    setVisibility(categoryVisibility(editing));
  });

  useEffect(() => {
    if (!open || visibility.visibility_all_roles || !visibilityStoreUuid) return;
    let active = true;
    loadVisibilityRoles(visibilityStoreUuid, i18n.language).then((roles) => {
      if (active) setRoleLoad({ key: roleLoadKey, roles });
    }).catch((error: unknown) => {
      if (active) setRoleLoad({ key: roleLoadKey, roles: [], error: error instanceof Error ? error.message : t("toasts.pleaseTryAgain") });
    });
    return () => { active = false; };
  }, [open, visibility.visibility_all_roles, visibilityStoreUuid, i18n.language, roleLoadKey, loadVisibilityRoles, t]);

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
              <input name="visibility_all_roles" type="hidden" value={String(visibility.visibility_all_roles)} />
              {visibility.visibility_role_ids.map((roleId) => (
                <input key={roleId} name="visibility_role_ids" type="hidden" value={roleId} />
              ))}
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
                  <FieldLegend>{t("settings.categoryVisibilityTitle")}</FieldLegend>
                  <FieldDescription>{t("settings.categoryVisibilityHint")}</FieldDescription>
                </Field>
                <Field orientation="horizontal" className="rounded-md border border-border p-3">
                  <FieldLabel htmlFor="category-visibility-enabled" className="flex-1">
                    {t("settings.categoryVisibilityRestrictByRole")}
                  </FieldLabel>
                  <Switch
                    id="category-visibility-enabled"
                    checked={!visibility.visibility_all_roles}
                    disabled={saving}
                    onCheckedChange={(checked) => setVisibility((current) => ({
                      ...current, visibility_all_roles: !checked,
                    }))}
                  />
                </Field>
                {!visibility.visibility_all_roles ? (
                  <>
                    {!rolesLoaded ? (
                      <div className="grid gap-2 sm:grid-cols-2" aria-busy="true" aria-label={t("settings.categoryVisibilityRolesLoading")}>
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                      </div>
                    ) : rolesError ? (
                      <Alert variant="destructive">
                        <AlertDescription>
                          <p>{t("settings.categoryVisibilityRolesFailed")}</p>
                          <p>{rolesError}</p>
                          <Button type="button" variant="outline" size="sm" onClick={() => setRoleLoadAttempt((attempt) => attempt + 1)}>
                            {t("actions.tryAgain")}
                          </Button>
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {visibilityRoles.map((role) => {
                          const selected = visibility.visibility_role_ids.includes(role.roles_id);
                          const id = `category-visibility-role-${role.roles_id}`;
                          return (
                            <Field key={role.roles_id} orientation="horizontal" className="rounded-md border border-border p-3 has-[[data-state=checked]]:bg-muted">
                              <Checkbox
                                id={id}
                                checked={selected}
                                disabled={saving}
                                onCheckedChange={(checked) => setVisibility((current) => ({
                                  ...current,
                                  visibility_role_ids: checked === true
                                    ? [...new Set([...current.visibility_role_ids, role.roles_id])]
                                    : current.visibility_role_ids.filter((value) => value !== role.roles_id),
                                }))}
                              />
                              <FieldLabel htmlFor={id} className="flex-1">{categoryVisibilityRoleLabel(role, i18n.language)}</FieldLabel>
                            </Field>
                          );
                        })}
                      </div>
                    )}
                    {missingRole ? <p className="text-sm text-destructive" role="status">{t("settings.categoryVisibilityRoleRequired")}</p> : null}
                    <FieldDescription>{t("settings.categoryVisibilityQrHidden")}</FieldDescription>
                  </>
                ) : <FieldDescription>{t("settings.categoryVisibilityEveryone")}</FieldDescription>}
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
