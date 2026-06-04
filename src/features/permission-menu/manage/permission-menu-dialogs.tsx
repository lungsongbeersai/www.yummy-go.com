"use client";

import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
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
import type { MainFormState, SubFormState } from "./permission-menu-options";
import { IconPickerButton, PathPicker } from "./permission-menu-pickers";
import type { PermissionMainMenu } from "@/services/permission-menu";
import { useTranslation } from "react-i18next";

export function MainMenuDialog({
  form,
  open,
  saving,
  setForm,
  onOpenChange,
  onSave
}: {
  form: MainFormState;
  open: boolean;
  saving: boolean;
  setForm: (form: MainFormState) => void;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}) {
  const { t } = useTranslation();
  const editing = Boolean(form.menu_id);
  const canSave = Boolean(
    form.menu_title_la.trim() && form.menu_title_eng.trim() && form.menu_path.trim()
  ) && !saving;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SettingsDialogContent>
        <SettingsDialogForm
          onSubmit={(event) => {
            event.preventDefault();
            if (canSave) void onSave();
          }}
        >
          <SettingsDialogHeader>
            <DialogTitle>{t(editing ? "permissionMenu.editMain" : "permissionMenu.createMain")}</DialogTitle>
            <DialogDescription>
              {t(editing ? "permissionMenu.mainEditDescription" : "permissionMenu.mainFormDescription")}
            </DialogDescription>
          </SettingsDialogHeader>
          <SettingsDialogBody>
            <FieldGroup className="gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="permission-main-title-la">{t("permissionMenu.fields.menuTitleLa")}</FieldLabel>
                  <Input
                    autoComplete="off"
                    disabled={saving}
                    id="permission-main-title-la"
                    name="menu_title_la"
                    required
                    value={form.menu_title_la}
                    onChange={(event) => setForm({ ...form, menu_title_la: event.target.value })}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="permission-main-title-eng">{t("permissionMenu.fields.menuTitleEng")}</FieldLabel>
                  <Input
                    autoComplete="off"
                    disabled={saving}
                    id="permission-main-title-eng"
                    name="menu_title_eng"
                    required
                    value={form.menu_title_eng}
                    onChange={(event) => setForm({ ...form, menu_title_eng: event.target.value })}
                  />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="permission-main-path">{t("permissionMenu.fields.menuPath")}</FieldLabel>
                <PathPicker
                  id="permission-main-path"
                  disabled={saving}
                  value={form.menu_path}
                  onValueChange={(value) => setForm({ ...form, menu_path: value })}
                />
                <FieldDescription>{t("permissionMenu.pathHint")}</FieldDescription>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="permission-main-icon">{t("permissionMenu.fields.menuIcon")}</FieldLabel>
                  <IconPickerButton
                    id="permission-main-icon"
                    disabled={saving}
                    value={form.menu_icon}
                    onValueChange={(value) => setForm({ ...form, menu_icon: value })}
                  />
                  <FieldDescription>{t("permissionMenu.iconHint")}</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="permission-main-badge">{t("permissionMenu.fields.menuBadge")}</FieldLabel>
                  <Select
                    value={form.menu_badge}
                    onValueChange={(value) => setForm({ ...form, menu_badge: value })}
                  >
                    <SelectTrigger id="permission-main-badge" className="w-full" disabled={saving}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="1">{t("permissionMenu.badgeShow")}</SelectItem>
                        <SelectItem value="2">{t("permissionMenu.badgeHide")}</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldDescription>{t("permissionMenu.badgeHint")}</FieldDescription>
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="permission-main-status">{t("permissionMenu.fields.menuStatus")}</FieldLabel>
                <Select
                  value={form.menu_status}
                  onValueChange={(value) => setForm({ ...form, menu_status: value })}
                >
                  <SelectTrigger id="permission-main-status" className="w-full" disabled={saving}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="1">{t("permissionMenu.menuStatusShow")}</SelectItem>
                      <SelectItem value="2">{t("permissionMenu.menuStatusHide")}</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldDescription>{t("permissionMenu.menuStatusHint")}</FieldDescription>
              </Field>
            </FieldGroup>
          </SettingsDialogBody>
          <SettingsDialogFooter>
            <Button disabled={saving} type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("actions.cancel")}
            </Button>
            <Button disabled={!canSave} type="submit">
              {saving ? <Spinner data-icon="inline-start" /> : null}
              {t("actions.save")}
            </Button>
          </SettingsDialogFooter>
        </SettingsDialogForm>
      </SettingsDialogContent>
    </Dialog>
  );
}

export function SubMenuDialog({
  form,
  menu,
  saving,
  setForm,
  onOpenChange,
  onSave
}: {
  form: SubFormState;
  menu: PermissionMainMenu | null;
  saving: boolean;
  setForm: (form: SubFormState) => void;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}) {
  const { t } = useTranslation();
  const open = Boolean(menu);
  const editing = Boolean(form.sub_id);
  const canSave = Boolean(
    form.sub_title_la.trim() && form.sub_title_eng.trim() && form.sub_path.trim() && menu?.menu_id
  ) && !saving;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SettingsDialogContent>
        <SettingsDialogForm
          onSubmit={(event) => {
            event.preventDefault();
            if (canSave) void onSave();
          }}
        >
          <SettingsDialogHeader>
            <DialogTitle>{t(editing ? "permissionMenu.editSub" : "permissionMenu.createSub")}</DialogTitle>
            <DialogDescription>
              {t(editing ? "permissionMenu.subEditDescription" : "permissionMenu.subFormDescription", {
                title: menu?.menu_title ?? ""
              })}
            </DialogDescription>
          </SettingsDialogHeader>
          <SettingsDialogBody>
            <FieldGroup className="gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="permission-sub-title-la">{t("permissionMenu.fields.subTitleLa")}</FieldLabel>
                  <Input
                    autoComplete="off"
                    disabled={saving}
                    id="permission-sub-title-la"
                    name="sub_title_la"
                    required
                    value={form.sub_title_la}
                    onChange={(event) => setForm({ ...form, sub_title_la: event.target.value })}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="permission-sub-title-eng">{t("permissionMenu.fields.subTitleEng")}</FieldLabel>
                  <Input
                    autoComplete="off"
                    disabled={saving}
                    id="permission-sub-title-eng"
                    name="sub_title_eng"
                    required
                    value={form.sub_title_eng}
                    onChange={(event) => setForm({ ...form, sub_title_eng: event.target.value })}
                  />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="permission-sub-path">{t("permissionMenu.fields.subPath")}</FieldLabel>
                <PathPicker
                  id="permission-sub-path"
                  disabled={saving}
                  value={form.sub_path}
                  onValueChange={(value) => setForm({ ...form, sub_path: value })}
                />
                <FieldDescription>{t("permissionMenu.pathHint")}</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="permission-sub-status">{t("permissionMenu.fields.status")}</FieldLabel>
                <Select
                  value={form.sub_status}
                  onValueChange={(value) => setForm({ ...form, sub_status: value })}
                >
                  <SelectTrigger id="permission-sub-status" className="w-full" disabled={saving}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="1">{t("common.active")}</SelectItem>
                      <SelectItem value="0">{t("common.inactive")}</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>
          </SettingsDialogBody>
          <SettingsDialogFooter>
            <Button disabled={saving} type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("actions.cancel")}
            </Button>
            <Button disabled={!canSave} type="submit">
              {saving ? <Spinner data-icon="inline-start" /> : null}
              {t("actions.save")}
            </Button>
          </SettingsDialogFooter>
        </SettingsDialogForm>
      </SettingsDialogContent>
    </Dialog>
  );
}
