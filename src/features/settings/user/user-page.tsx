"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil, Power, PowerOff, UsersRound } from "lucide-react";
import { useResetOnDeps } from "@/hooks/use-reset-on-change";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import { AVATAR_CROP_ASPECT, AVATAR_CROP_OUTPUT_HEIGHT, AVATAR_CROP_OUTPUT_WIDTH } from "@/config/image-crop";
import {
  DEFAULT_CROP,
  cropImageFile,
  type CropState
} from "@/features/settings/shared/settings-image-crop";
import { SettingsListPageLayout } from "@/features/settings/shared/settings-list-page-layout";
import { SettingsEmptyRecords } from "@/features/settings/shared/settings-shell";
import { useSettingsCrudController } from "@/features/settings/shared/use-settings-crud-controller";
import type { ChangePasswordValues } from "@/lib/password";
import { canCreateStoreBranch } from "@/lib/permissions";
import type { UrlPaginationState } from "@/lib/url-pagination";
import type { Store } from "@/services/store";
import type { FetchUsersParams, Position, Role, SaveUserInput, User } from "@/services/user";
import type { Zone } from "@/services/zone";
import type { SortOrder } from "@/services/shared/types";
import { useReferenceStore } from "@/stores/reference-store";
import { useUserStore } from "@/stores/user-store";
import { UserBulkDialog } from "./user-bulk-create-dialog";
import { UserFormDialog } from "./user-form-dialog";
import { UserMobileList, UserTable } from "./user-list";
import { UserPasswordDialog } from "./user-password-dialog";
import { UserStoreFilter } from "./user-store-filter";
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
const EMPTY_POSITIONS: Position[] = [];
// Ceiling for "every user" while a store filter is on (the whole system has ~140 today).
const STORE_FILTER_FETCH_LIMIT = 5000;
const EMPTY_ZONES: Zone[] = [];

export function UserSettingsPage({ initialPagination }: { initialPagination: UrlPaginationState }) {
  const { t } = useTranslation();
  const loadRoles = useReferenceStore((state) => state.loadRoles);
  const loadPositions = useReferenceStore((state) => state.loadPositions);
  const loadZones = useReferenceStore((state) => state.loadZones);
  const userProfileUrl = useReferenceStore((state) => state.userProfileUrl);
  const changePassword = useReferenceStore((state) => state.changePassword);
  const changingPassword = useReferenceStore((state) => Boolean(state.loadingKeys.password));
  const [fetchedRoles, setFetchedRoles] = useState<Role[]>([]);
  const [fetchedPositions, setFetchedPositions] = useState<Position[]>([]);
  const [fetchedZones, setFetchedZones] = useState<Zone[]>([]);
  const [selectedProfileImage, setSelectedProfileImage] = useState<File | null>(null);
  const [crop, setCrop] = useState<CropState>(DEFAULT_CROP);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkEditingUsers, setBulkEditingUsers] = useState<User[] | null>(null);
  const [activeTarget, setActiveTarget] = useState<{ users: User[]; active: number } | null>(null);
  const [statusRunning, setStatusRunning] = useState(false);
  const statusSubmitting = useRef(false);
  const saveUserRow = useUserStore((state) => state.save);
  const loadStoreOptions = useReferenceStore((state) => state.loadStores);
  const loadStoreBranches = useReferenceStore((state) => state.loadBranches);
  const [storeFilter, setStoreFilter] = useState("");
  const [storeOptions, setStoreOptions] = useState<Store[]>([]);
  const [storeBranches, setStoreBranches] = useState<{ ids: Set<string>; storeUuid: string } | null>(null);

  const title = t("settings.modules.user.title");
  const description = t("settings.modules.user.description");
  const {
    applyFilters,
    backgroundLoading,
    changeLimit,
    deleteTarget,
    dialogOpen,
    editing,
    fullLoading,
    language,
    limit,
    load,
    missingRequiredScope,
    onDialogOpenChange,
    openEdit: controllerOpenEdit,
    orderBy,
    page,
    pageEnd: controllerPageEnd,
    pageStart: controllerPageStart,
    remove: crudRemove,
    requiredScopeDescription,
    rows: loadedRows,
    save,
    saving,
    search,
    selectedRows,
    setDeleteTarget,
    setDialogOpen,
    setEditing,
    setOrderBy,
    setPage,
    setSearch,
    showToast,
    toggleSelected,
    total: controllerTotal,
    totalPages: controllerTotalPages,
    user
  } = useSettingsCrudController<User, SaveUserInput, FetchUsersParams>({
    buildInput: ({ editing: editingRow, formData, user: currentUser }) =>
      buildUserSaveInput({
        active: String(formData.get("login_active") ?? 1),
        branchUuid: editingRow?.branch_uuid_fk || currentUser?.branch_uuid || "",
        editing: editingRow,
        email: String(formData.get("login_email") ?? ""),
        name: String(formData.get("login_name") ?? ""),
        password: String(formData.get("login_password") ?? "").trim(),
        positionUuid: String(formData.get("position_uuid_fk") ?? "").trim(),
        profile: formData.get("login_profile"),
        selectedRoleId: String(formData.get("roles_id_fk") ?? "").trim(),
        zoneUuids: formData
          .getAll("zone_uuid_fks")
          .map((value) => String(value).trim())
          .filter(Boolean)
      }),
    idKey: "login_uuid",
    initialOrderBy: "asc",
    initialPagination,
    requiredScopeKey: "branch_uuid_fk",
    requiredScopeMessage: t("settings.branchRequired"),
    scope: (_storeUuid, currentUser) => ({
      branch_uuid_fk: currentUser?.branch_uuid ?? "",
      roles_id_fk: Number(currentUser?.status ?? 0) || "",
      // A store filter loads every user in one request and filters/pages them here (below): the
      // user API ignores store params (checked: store_uuid_fk / store_uuid return all 138 rows)
      // and its rows carry only a branch, so the match goes through that store's branches.
      // Scope keys override limit/page in the controller's request. A number, not "All": this
      // endpoint reads limit=all as 10 rows (checked), while a numeric limit returns everything.
      ...(storeFilter ? { limit: STORE_FILTER_FETCH_LIMIT, page: 1 } : {})
    }),
    store: useUserStore,
    title,
    validateInput: ({ editing: editingRow, formData }) => {
      const selectedRoleId = String(formData.get("roles_id_fk") ?? "").trim();
      const positionUuid = String(formData.get("position_uuid_fk") ?? "").trim();
      const name = String(formData.get("login_name") ?? "").trim();
      const password = String(formData.get("login_password") ?? "").trim();
      if (!selectedRoleId) return t("settings.createRoleFirst");
      if (!positionUuid) return t("settings.positionRequired");
      if (!name) return t("settings.displayNameRequired");
      if (!userId(editingRow) && !password) return t("settings.passwordRequired");
      return null;
    }
  });

  // Only a Super Admin sees users of every store, so only they get the store filter.
  const canFilterStore = canCreateStoreBranch(user?.status);
  const activeStoreFilter = canFilterStore ? storeFilter : "";
  const storeBranchIds = activeStoreFilter && storeBranches?.storeUuid === activeStoreFilter ? storeBranches.ids : null;
  const filteredRows = activeStoreFilter
    ? storeBranchIds
      ? loadedRows.filter((row) => storeBranchIds.has(userValue(row, "branch_uuid_fk")))
      : []
    : loadedRows;
  const localPageSize = typeof limit === "number" ? limit : Math.max(1, filteredRows.length);
  const rows = activeStoreFilter ? filteredRows.slice((page - 1) * localPageSize, page * localPageSize) : loadedRows;
  const pageStart = activeStoreFilter ? (rows.length ? (page - 1) * localPageSize + 1 : 0) : controllerPageStart;
  const pageEnd = activeStoreFilter ? (rows.length ? pageStart + rows.length - 1 : 0) : controllerPageEnd;
  const total = activeStoreFilter ? filteredRows.length : controllerTotal;
  const totalPages = activeStoreFilter ? Math.max(1, Math.ceil(filteredRows.length / localPageSize)) : controllerTotalPages;
  const storeFilterLoading = Boolean(activeStoreFilter) && !storeBranchIds;

  const branchUuid = user?.branch_uuid ?? "";
  const loginBranchName = user?.branch_name || t("settings.currentBranch");
  const currentLoginUuid = user?.uuid ?? "";
  const selectableUsers = rows.filter((row) => !isProtectedUser(row) && userId(row) !== currentLoginUuid);
  const selectedUsers = selectableUsers.filter((row) => selectedRows.has(userId(row)));
  const allSelected = selectableUsers.length > 0 && selectableUsers.every((row) => selectedRows.has(userId(row)));
  const loggedRoleId = Number(user?.status ?? 0);
  // ยังไม่มีสิทธิ์ที่อ้างอิง = ไม่มีตัวเลือก แต่คงค่าที่โหลดไว้ไม่ให้รายการกะพริบตอนสลับ
  const roles = loggedRoleId ? fetchedRoles : EMPTY_ROLES;
  const positions = fetchedPositions.length ? fetchedPositions : EMPTY_POSITIONS;
  const zones = branchUuid ? fetchedZones : EMPTY_ZONES;

  useEffect(() => {
    if (!canFilterStore) return;

    let active = true;
    loadStoreOptions(language)
      .then((stores) => {
        if (active) setStoreOptions(stores);
      })
      .catch((error) => {
        showToast({
          title: t("settings.loadFailed", { title: t("nav.store") }),
          description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
          tone: "error"
        });
      });

    return () => {
      active = false;
    };
  }, [canFilterStore, language, loadStoreOptions, showToast, t]);

  // The branches of the chosen store decide which users belong to it.
  useEffect(() => {
    if (!activeStoreFilter) return;

    let active = true;
    loadStoreBranches(activeStoreFilter)
      .then((branches) => {
        if (!active) return;
        setStoreBranches({
          ids: new Set(branches.map((branch) => String(branch.branch_uuid ?? "")).filter(Boolean)),
          storeUuid: activeStoreFilter
        });
      })
      .catch((error) => {
        showToast({
          title: t("settings.loadFailed", { title: t("nav.branch") }),
          description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
          tone: "error"
        });
      });

    return () => {
      active = false;
    };
  }, [activeStoreFilter, loadStoreBranches, showToast, t]);

  function changeStoreFilter(storeUuid: string) {
    setStoreFilter(storeUuid);
    setPage(1);
  }

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

  useEffect(() => {
    let active = true;
    loadPositions(language)
      .then((nextPositions) => {
        if (active) setFetchedPositions(nextPositions);
      })
      .catch((error) => {
        showToast({
          title: t("settings.loadFailed", { title: t("fields.position") }),
          description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
          tone: "error"
        });
      });

    return () => {
      active = false;
    };
  }, [language, loadPositions, showToast, t]);

  useEffect(() => {
    if (!branchUuid) return;

    let active = true;
    loadZones(language, branchUuid)
      .then((nextZones) => {
        if (active) setFetchedZones(nextZones);
      })
      .catch((error) => {
        showToast({
          title: t("settings.loadFailed", { title: t("nav.zone") }),
          description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
          tone: "error"
        });
      });

    return () => {
      active = false;
    };
  }, [branchUuid, language, loadZones, showToast, t]);

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
    if (!positions.length) {
      showToast({ title: t("settings.saveFailed"), description: t("settings.createPositionFirst"), tone: "error" });
      return;
    }
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(row: User) {
    if (isProtectedUser(row)) return;
    controllerOpenEdit(row);
  }

  function openBulkCreate() {
    if (missingRequiredScope) {
      showToast({ title: t("settings.saveFailed"), description: requiredScopeDescription, tone: "error" });
      return;
    }
    if (!roles.length) {
      showToast({ title: t("settings.saveFailed"), description: t("settings.createRoleFirst"), tone: "error" });
      return;
    }
    setBulkEditingUsers(null);
    setBulkDialogOpen(true);
  }

  function openBulkEdit() {
    if (!selectedUsers.length || saving || statusRunning) return;
    setBulkEditingUsers(selectedUsers);
    setBulkDialogOpen(true);
  }

  function requestActiveChange(targets: User[], active: number) {
    if (saving || statusRunning) return;
    const users = targets.filter((row) => !isProtectedUser(row) && userId(row) !== currentLoginUuid && Number(row.login_active ?? 1) !== active);
    if (users.length) setActiveTarget({ users, active });
  }

  async function submitActiveChange() {
    if (!activeTarget || statusSubmitting.current) return;
    statusSubmitting.current = true;
    setStatusRunning(true);
    const results = await Promise.all(activeTarget.users.map(async (row) => {
      try {
        await saveUserRow({ login_uuid: userId(row), login_active: activeTarget.active });
        return { ok: true, error: "" };
      } catch (error) {
        return { ok: false, error: `${userValue(row, "login_email")}: ${error instanceof Error ? error.message : t("toasts.pleaseTryAgain")}` };
      }
    }));
    const success = results.filter((result) => result.ok).length;
    const failed = results.find((result) => !result.ok);
    showToast({
      title: t("settings.userBatchSaved", { success, total: results.length }),
      description: failed?.error,
      tone: failed ? "error" : "success"
    });
    setActiveTarget(null);
    await load();
    setStatusRunning(false);
    statusSubmitting.current = false;
  }

  async function submitUserForm(formData: FormData) {
    if (selectedProfileImage) {
      const croppedFile = await cropImageFile(selectedProfileImage, crop, t("settings.storeBranch.imageLoadFailed"), {
        aspect: AVATAR_CROP_ASPECT,
        outputHeight: AVATAR_CROP_OUTPUT_HEIGHT,
        outputWidth: AVATAR_CROP_OUTPUT_WIDTH
      });
      formData.set("login_profile", croppedFile);
    }
    await save(formData);
  }

  async function remove(row: User) {
    if (isProtectedUser(row)) return;
    await crudRemove(row);
  }

  async function submitPasswordChange(values: ChangePasswordValues) {
    try {
      await changePassword({
        login_uuid: currentLoginUuid,
        old_password: values.oldPassword,
        new_password: values.newPassword
      });
      showToast({ title: t("profile.passwordChanged"), tone: "success" });
      setPasswordDialogOpen(false);
    } catch (error) {
      showToast({
        title: t("profile.changePasswordFailed"),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    }
  }

  const listProps = {
    currentLoginUuid,
    profileUrl: userProfileUrl,
    rows,
    selectedRows,
    onChangePassword: () => setPasswordDialogOpen(true),
    onDelete: setDeleteTarget,
    onEdit: openEdit,
    onToggleActive: (row: User) => requestActiveChange([row], Number(row.login_active ?? 1) === 1 ? 2 : 1),
    // Your own account and protected accounts are never selectable.
    onToggleSelected: (id: string, checked: boolean) => {
      if (selectableUsers.some((row) => userId(row) === id)) toggleSelected(id, checked);
    }
  };
  const toggleAllSelectable = (checked: boolean) => selectableUsers.forEach((row) => toggleSelected(userId(row), checked));

  return (
    <SettingsListPageLayout
      id="user"
      title={title}
      description={description}
      icon={UsersRound}
      addLabel={`${t("actions.add")} ${t("nav.user")}`}
      onAdd={openCreate}
      headerActions={
        <Button variant="outline" onClick={openBulkCreate}>
          <UsersRound data-icon="inline-start" />
          {t("settings.userBulkAddLabel")}
        </Button>
      }
      loading={fullLoading}
      loadingLabel={t("settings.loading", { title })}
      search={search}
      searching={backgroundLoading || storeFilterLoading}
      searchingLabel={t("settings.refreshingList")}
      onSearchChange={setSearch}
      onSearchApply={applyFilters}
      orderBy={orderBy}
      onOrderChange={(nextOrder) => {
        setOrderBy(nextOrder);
        setPage(1);
      }}
      orderOptions={ORDER_OPTIONS.map((option) => ({ label: t(`common.${option.labelKey}`), value: option.value }))}
      toolbarExtra={
        <>
          {canFilterStore ? (
            <UserStoreFilter stores={storeOptions} value={storeFilter} onValueChange={changeStoreFilter} />
          ) : null}
          {/* Bulk actions on the selected accounts; only shown while something is selected. */}
          {selectedUsers.length ? (
          <>
            <Button disabled={saving || statusRunning} variant="outline" onClick={openBulkEdit}>
              <Pencil data-icon="inline-start" />
              {t("settings.userBulkEditLabel", { count: selectedUsers.length })}
            </Button>
            <Button
              disabled={saving || statusRunning || selectedUsers.every((row) => Number(row.login_active ?? 1) === 1)}
              variant="outline"
              onClick={() => requestActiveChange(selectedUsers, 1)}
            >
              <Power data-icon="inline-start" />
              {t("settings.userEnable")}
            </Button>
            <Button
              disabled={saving || statusRunning || selectedUsers.every((row) => Number(row.login_active ?? 1) === 2)}
              variant="outline"
              onClick={() => requestActiveChange(selectedUsers, 2)}
            >
              <PowerOff data-icon="inline-start" />
              {t("settings.userDisable")}
            </Button>
          </>
          ) : null}
        </>
      }
      allSelected={allSelected}
      selectAllLabel={t("common.selectAll")}
      selectedCount={selectedUsers.length}
      onToggleAll={toggleAllSelectable}
      hasRows={rows.length > 0}
      table={<UserTable {...listProps} allSelected={allSelected} pageStart={pageStart} onToggleAll={toggleAllSelectable} />}
      mobileList={<UserMobileList {...listProps} />}
      empty={<SettingsEmptyRecords icon={<UsersRound aria-hidden />} title={title.toLowerCase()} />}
      page={page}
      pageStart={pageStart}
      pageEnd={pageEnd}
      total={total}
      totalPages={totalPages}
      limit={limit}
      onLimitChange={changeLimit}
      onPageChange={setPage}
    >
      <UserFormDialog
        crop={crop}
        currentBranchName={loginBranchName}
        currentBranchUuid={branchUuid}
        editing={editing}
        loggedRoleId={loggedRoleId}
        open={dialogOpen}
        profileSrc={editing ? userProfileUrl(userValue(editing, "login_profile")) : ""}
        positionOptions={positions}
        roleOptions={roles}
        saving={saving}
        selectedProfileImage={selectedProfileImage}
        title={title}
        zoneOptions={zones}
        onCropChange={setCrop}
        onFileChange={setSelectedProfileImage}
        onOpenChange={onDialogOpenChange}
        onSubmit={submitUserForm}
      />
      <UserBulkDialog
        branchUuid={branchUuid}
        editingUsers={bulkEditingUsers}
        loggedRoleId={loggedRoleId}
        open={bulkDialogOpen}
        roleOptions={roles}
        zoneOptions={zones}
        onCreated={() => void load()}
        onOpenChange={setBulkDialogOpen}
      />
      <ConfirmDialog
        cancelLabel={t("actions.cancel")}
        confirmLabel={t(activeTarget?.active === 1 ? "settings.userEnable" : "settings.userDisable")}
        confirmPending={statusRunning}
        confirmVariant={activeTarget?.active === 1 ? "default" : "destructive"}
        description={t(activeTarget?.active === 1 ? "settings.userEnableConfirm" : "settings.userDisableConfirm", { count: activeTarget?.users.length ?? 0 })}
        open={Boolean(activeTarget)}
        title={t(activeTarget?.active === 1 ? "settings.userEnable" : "settings.userDisable")}
        onConfirm={() => void submitActiveChange()}
        onOpenChange={(nextOpen) => { if (!nextOpen && !statusSubmitting.current) setActiveTarget(null); }}
      />
      <UserPasswordDialog
        email={user?.email ?? ""}
        open={passwordDialogOpen}
        saving={changingPassword}
        onOpenChange={(nextOpen) => {
          if (changingPassword) return;
          setPasswordDialogOpen(nextOpen);
        }}
        onSubmit={submitPasswordChange}
      />
      <ConfirmDialog
        cancelLabel={t("actions.cancel")}
        confirmLabel={t("actions.delete")}
        confirmPending={saving}
        description={t("settings.deleteConfirm")}
        open={Boolean(deleteTarget)}
        title={t("actions.delete")}
        onConfirm={() => {
          if (deleteTarget) void remove(deleteTarget);
        }}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setDeleteTarget(null);
        }}
      />
    </SettingsListPageLayout>
  );
}
