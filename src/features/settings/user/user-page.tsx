"use client";

import { useEffect, useState } from "react";
import { useResetOnDeps } from "@/hooks/use-reset-on-change";
import { useTranslation } from "react-i18next";
import {
  DEFAULT_CROP,
  cropImageFile,
  type CropState
} from "@/features/settings/shared/settings-image-crop";
import { SettingsCrudShell, SettingsCrudToolbar } from "@/features/settings/shared/settings-crud-shell";
import { useSettingsCrudController } from "@/features/settings/shared/use-settings-crud-controller";
import { PAGE_LIMIT_OPTIONS } from "@/lib/pagination";
import type { UrlPaginationState } from "@/lib/url-pagination";
import type { FetchUsersParams, Role, SaveUserInput, User } from "@/services/user";
import type { SortOrder } from "@/services/shared/types";
import { useReferenceStore } from "@/stores/reference-store";
import { useUserStore } from "@/stores/user-store";
import { UserFormDialog } from "./user-form-dialog";
import { UserListSurface } from "./user-list";
import {
  buildUserSaveInput,
  isProtectedUser,
  userId,
  userValue
} from "./user-utils";

const ORDER_OPTIONS: Array<{ labelKey: "asc" | "desc"; value: SortOrder }> = [
  { labelKey: "asc", value: "asc" },
  { labelKey: "desc", value: "desc" }
];

const EMPTY_ROLES: Role[] = [];

export function UserSettingsPage({ initialPagination }: { initialPagination: UrlPaginationState }) {
  const { t } = useTranslation();
  const loadRoles = useReferenceStore((state) => state.loadRoles);
  const userProfileUrl = useReferenceStore((state) => state.userProfileUrl);
  const [fetchedRoles, setFetchedRoles] = useState<Role[]>([]);
  const [selectedProfileImage, setSelectedProfileImage] = useState<File | null>(null);
  const [crop, setCrop] = useState<CropState>(DEFAULT_CROP);

  const title = t("settings.modules.user.title");
  const description = t("settings.modules.user.description");
  const controller = useSettingsCrudController<User, SaveUserInput, FetchUsersParams>({
    buildInput: ({ editing: editingRow, formData, user: currentUser }) =>
      buildUserSaveInput({
        active: String(formData.get("login_active") ?? 1),
        branchUuid: currentUser?.branch_uuid ?? "",
        editing: editingRow,
        email: String(formData.get("login_email") ?? ""),
        password: String(formData.get("login_password") ?? "").trim(),
        profile: formData.get("login_profile"),
        selectedRoleId: String(formData.get("roles_id_fk") ?? "").trim()
      }),
    idKey: "login_uuid",
    initialOrderBy: "asc",
    initialPagination,
    requiredScopeKey: "branch_uuid_fk",
    requiredScopeMessage: t("settings.branchRequired"),
    scope: (_storeUuid, currentUser) => ({
      branch_uuid_fk: currentUser?.branch_uuid ?? "",
      roles_id_fk: Number(currentUser?.status ?? 0) || ""
    }),
    store: useUserStore,
    title,
    validateInput: ({ editing: editingRow, formData }) => {
      const selectedRoleId = String(formData.get("roles_id_fk") ?? "").trim();
      const password = String(formData.get("login_password") ?? "").trim();
      if (!selectedRoleId) return t("settings.createRoleFirst");
      if (!userId(editingRow) && !password) return t("settings.passwordRequired");
      return null;
    }
  });
  const {
    allSelected,
    backgroundLoading,
    dialogOpen,
    editing,
    language,
    missingRequiredScope,
    openEdit: controllerOpenEdit,
    pageStart,
    remove: crudRemove,
    requiredScopeDescription,
    rows,
    save,
    saving,
    selectedRows,
    setDeleteTarget,
    setDialogOpen,
    setEditing,
    showToast,
    toggleAll,
    toggleSelected,
    user
  } = controller;

  const branchUuid = user?.branch_uuid ?? "";
  const loginBranchName = user?.branch_name || t("settings.currentBranch");
  const currentLoginUuid = user?.uuid ?? "";
  const loggedRoleId = Number(user?.status ?? 0);
  // ยังไม่มีสิทธิ์ที่อ้างอิง = ไม่มีตัวเลือก แต่คงค่าที่โหลดไว้ไม่ให้รายการกะพริบตอนสลับ
  const roles = loggedRoleId ? fetchedRoles : EMPTY_ROLES;

  useEffect(() => {
    if (!loggedRoleId) return;

    let active = true;
    loadRoles(language, loggedRoleId)
      .then((nextRoles) => {
        if (active) setFetchedRoles(nextRoles);
      })
      .catch((error) => {
        showToast({
          title: t("settings.loadFailed", { title: t("fields.roles_name") }),
          description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
          tone: "error"
        });
      });

    return () => {
      active = false;
    };
  }, [language, loadRoles, loggedRoleId, showToast, t]);

  // เปิด/ปิด dialog หรือสลับผู้ใช้ที่แก้ไข = ล้างรูปที่เลือกและกรอบครอปค้างไว้
  useResetOnDeps([dialogOpen, editing], () => {
    setSelectedProfileImage(null);
    setCrop(DEFAULT_CROP);
  });

  function openCreate() {
    if (missingRequiredScope) {
      showToast({ title: t("settings.saveFailed"), description: requiredScopeDescription, tone: "error" });
      return;
    }
    if (!roles.length) {
      showToast({ title: t("settings.saveFailed"), description: t("settings.createRoleFirst"), tone: "error" });
      return;
    }
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(row: User) {
    if (isProtectedUser(row)) return;
    controllerOpenEdit(row);
  }

  async function submitUserForm(formData: FormData) {
    if (selectedProfileImage) {
      const croppedFile = await cropImageFile(selectedProfileImage, crop, t("settings.storeBranch.imageLoadFailed"));
      formData.set("login_profile", croppedFile);
    }
    await save(formData);
  }

  async function remove(row: User) {
    if (isProtectedUser(row)) return;
    await crudRemove(row);
  }

  return (
    <SettingsCrudShell
      addLabel={`${t("actions.add")} ${t("nav.user")}`}
      cardTitle={t("settings.userList")}
      controller={controller}
      description={description}
      formDialog={
        <UserFormDialog
          crop={crop}
          currentBranchName={loginBranchName}
          currentBranchUuid={branchUuid}
          editing={editing}
          loggedRoleId={loggedRoleId}
          open={dialogOpen}
          profileSrc={editing ? userProfileUrl(userValue(editing, "login_profile")) : ""}
          roleOptions={roles}
          saving={saving}
          selectedProfileImage={selectedProfileImage}
          title={title}
          onCropChange={setCrop}
          onFileChange={setSelectedProfileImage}
          onOpenChange={controller.onDialogOpenChange}
          onSubmit={submitUserForm}
        />
      }
      listSurface={
        <UserListSurface
          allSelected={allSelected}
          backgroundLoading={backgroundLoading}
          currentLoginUuid={currentLoginUuid}
          pageStart={pageStart}
          profileUrl={userProfileUrl}
          rows={rows}
          selectedRows={selectedRows}
          title={title}
          toolbar={
            <SettingsCrudToolbar
              controller={controller}
              limitOptions={PAGE_LIMIT_OPTIONS}
              orderOptions={ORDER_OPTIONS.map((option) => ({ label: t(`common.${option.labelKey}`), value: option.value }))}
            />
          }
          onDelete={setDeleteTarget}
          onEdit={openEdit}
          onToggleAll={toggleAll}
          onToggleSelected={toggleSelected}
        />
      }
      title={title}
      onAdd={openCreate}
      onRemove={remove}
    />
  );
}
