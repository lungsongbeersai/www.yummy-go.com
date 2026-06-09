"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { SettingsImageCropPanel, type CropState } from "@/features/settings/shared/settings-image-crop";
import type { Role, User } from "@/services/user";
import {
  roleId,
  roleName,
  userId,
  userRoleOptions,
  userValue
} from "./user-utils";

export function UserFormDialog({
  crop,
  currentBranchName,
  currentBranchUuid,
  editing,
  loggedRoleId,
  onCropChange,
  onFileChange,
  onOpenChange,
  onSubmit,
  open,
  profileSrc,
  roleOptions,
  saving,
  selectedProfileImage,
  title
}: {
  crop: CropState;
  currentBranchName: string;
  currentBranchUuid: string;
  editing: User | null;
  loggedRoleId: number;
  onCropChange: (crop: CropState) => void;
  onFileChange: (file: File | null) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: (formData: FormData) => Promise<void>;
  open: boolean;
  profileSrc: string;
  roleOptions: Role[];
  saving: boolean;
  selectedProfileImage: File | null;
  title: string;
}) {
  const { t } = useTranslation();
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [loginActive, setLoginActive] = useState("1");
  const roles = useMemo(() => userRoleOptions(editing, roleOptions), [editing, roleOptions]);

  useEffect(() => {
    setSelectedRoleId(roleId(editing) || String(loggedRoleId || ""));
    setLoginActive(userValue(editing, "login_active", "1"));
  }, [editing, loggedRoleId, open]);

  const formKey = userId(editing) || "new";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!flex h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100vw-2rem)] sm:max-w-5xl"
        showCloseButton={!saving}
      >
        <DialogHeader className="border-b border-border px-4 py-3 pr-12 sm:px-5">
          <DialogTitle>{editing ? t("settings.editRecord") : t("settings.newRecord")}: {title}</DialogTitle>
          <DialogDescription>{t("settings.userDialogDescription")}</DialogDescription>
        </DialogHeader>
        <form key={formKey} action={onSubmit} className="flex min-h-0 flex-auto flex-col overflow-hidden sm:max-h-[calc(100dvh-8rem)]">
          <div className="min-h-0 flex-1 overflow-y-auto lg:grid lg:grid-cols-[19rem_minmax(0,1fr)] lg:overflow-hidden">
            <div className="border-b border-border bg-muted/20 lg:min-h-0 lg:border-b-0 lg:border-r">
              <SettingsImageCropPanel
                crop={crop}
                className="shrink-0 lg:overflow-y-auto"
                description={t("settings.profileImageHint")}
                emptyLabel={t("fields.login_profile")}
                existingSrc={profileSrc}
                fileSupportText={t("settings.storeBranch.imageSupport")}
                fieldId="login_profile"
                horizontalLabel={t("settings.storeBranch.horizontal")}
                previewMaxClassName="max-w-[10rem] sm:max-w-56 lg:max-w-none"
                removeLabel={t("settings.storeBranch.cancelImage")}
                saving={saving}
                selectedFile={selectedProfileImage}
                title={t("settings.userProfileSection")}
                uploadLabel={t("settings.storeBranch.uploadImage")}
                verticalLabel={t("settings.storeBranch.vertical")}
                zoomLabel={t("settings.storeBranch.zoom")}
                onCropChange={onCropChange}
                onFileChange={onFileChange}
              />
            </div>
            <div className="min-h-0 p-4 lg:overflow-y-auto lg:p-5">
              <FieldGroup className="gap-4 pb-1">
                <FieldSet className="gap-4 rounded-lg border border-border bg-card p-4">
                  <div className="min-w-0">
                    <FieldLegend className="mb-1 text-sm font-black">{t("settings.userAccountSection")}</FieldLegend>
                    <FieldDescription>{t("settings.userFormHint")}</FieldDescription>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="login_email">{t("fields.login_email")}</FieldLabel>
                      <Input
                        autoComplete="email"
                        defaultValue={userValue(editing, "login_email")}
                        disabled={saving}
                        id="login_email"
                        name="login_email"
                        placeholder={t("settings.emailPlaceholder")}
                        required
                        spellCheck={false}
                        translate="no"
                        type="email"
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="login_password">{t("fields.login_password")}</FieldLabel>
                      <Input
                        autoComplete="new-password"
                        disabled={saving}
                        id="login_password"
                        name="login_password"
                        required={!editing}
                        type="password"
                      />
                      <FieldDescription>
                        {editing ? t("settings.passwordEditHint") : t("settings.passwordCreateHint")}
                      </FieldDescription>
                    </Field>
                  </div>
                </FieldSet>

                <FieldSet className="gap-4 rounded-lg border border-border bg-card p-4">
                  <div className="min-w-0">
                    <FieldLegend className="mb-1 text-sm font-black">{t("settings.userAccessSection")}</FieldLegend>
                    <FieldDescription>{t("settings.branchFromLogin")}</FieldDescription>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="branch_uuid_fk">{t("nav.branch")}</FieldLabel>
                      <input name="branch_uuid_fk" type="hidden" value={currentBranchUuid} />
                      <Input
                        aria-readonly
                        id="branch_uuid_fk"
                        name="branch_name_readonly"
                        readOnly
                        value={currentBranchName || "-"}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="roles_id_fk">{t("fields.roles_id_fk")}</FieldLabel>
                      <input name="roles_id_fk" type="hidden" value={selectedRoleId} />
                      <Select disabled={saving} required value={selectedRoleId} onValueChange={setSelectedRoleId}>
                        <SelectTrigger id="roles_id_fk" className="w-full">
                          <SelectValue placeholder={t("settings.selectRole")} />
                        </SelectTrigger>
                        <SelectContent position="popper">
                          <SelectGroup>
                            {roles.map((role) => {
                              const id = roleId(role);
                              if (!id) return null;
                              return (
                                <SelectItem key={id} value={id}>
                                  {roleName(role)}
                                </SelectItem>
                              );
                            })}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="login_active">{t("fields.login_active")}</FieldLabel>
                      <input name="login_active" type="hidden" value={loginActive} />
                      <Select disabled={saving} required value={loginActive} onValueChange={setLoginActive}>
                        <SelectTrigger id="login_active" className="w-full">
                          <SelectValue placeholder={t("fields.login_active")} />
                        </SelectTrigger>
                        <SelectContent position="popper">
                          <SelectGroup>
                            <SelectItem value="1">{t("common.active")}</SelectItem>
                            <SelectItem value="2">{t("common.inactive")}</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                </FieldSet>
              </FieldGroup>
            </div>
          </div>
          <DialogFooter className="shrink-0 border-t border-border bg-card/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur [&>button]:w-full sm:[&>button]:w-auto">
            <Button disabled={saving} type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("actions.cancel")}
            </Button>
            <Button disabled={saving || !currentBranchUuid || !selectedRoleId} type="submit">
              {saving ? <Spinner data-icon="inline-start" /> : null}
              {saving ? t("common.processing") : t("actions.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
