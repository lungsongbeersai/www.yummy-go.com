"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import {
  DEFAULT_CROP,
  cropImageFile,
  type CropState
} from "@/features/settings/shared/settings-image-crop";
import {
  SettingsModuleShell,
  SettingsPaginationFooter,
  SettingsToolbar
} from "@/features/settings/shared/settings-shell";
import { useOptionRowSelection } from "@/features/settings/shared/use-option-row-selection";
import { useAppliedSearch } from "@/hooks/use-applied-search";
import { useLatestValue } from "@/hooks/use-latest-value";
import { useUrlPagination } from "@/hooks/use-url-pagination";
import { DEFAULT_PAGE_LIMIT, PAGE_LIMIT_OPTIONS } from "@/lib/pagination";
import type { UrlPaginationState } from "@/lib/url-pagination";
import type { PageLimit, SortOrder } from "@/services/shared/types";
import type { FetchUsersParams, Role, User } from "@/services/user";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { useReferenceStore } from "@/stores/reference-store";
import { useToastStore } from "@/stores/toast-store";
import { useUserStore } from "@/stores/user-store";
import { UserFormDialog } from "./user-form-dialog";
import { UserListSurface } from "./user-list";
import {
  buildUserSaveInput,
  isProtectedUser,
  userId,
  userValue
} from "./user-utils";

const DEFAULT_LIMIT: PageLimit = DEFAULT_PAGE_LIMIT;
const ORDER_OPTIONS: Array<{ labelKey: "asc" | "desc"; value: SortOrder }> = [
  { labelKey: "asc", value: "asc" },
  { labelKey: "desc", value: "desc" }
];

export function UserSettingsPage({ initialPagination }: { initialPagination: UrlPaginationState }) {
  const { t } = useTranslation();
  const language = useAppStore((state) => state.language);
  const user = useAuthStore((state) => state.user);
  const branchUuid = user?.branch_uuid ?? "";
  const loginBranchName = user?.branch_name || t("settings.currentBranch");
  const currentLoginUuid = user?.uuid ?? "";
  const loggedRoleId = Number(user?.status ?? 0);
  const showToast = useToastStore((state) => state.show);
  const rows = useUserStore((state) => state.rows);
  const total = useUserStore((state) => state.total);
  const storeTotalPages = useUserStore((state) => state.totalPages);
  const search = useUserStore((state) => state.search);
  const hasLoaded = useUserStore((state) => state.hasLoaded);
  const loading = useUserStore((state) => state.loading);
  const refreshing = useUserStore((state) => state.refreshing);
  const saving = useUserStore((state) => state.saving);
  const setSearch = useUserStore((state) => state.setSearch);
  const loadRows = useUserStore((state) => state.load);
  const saveRow = useUserStore((state) => state.save);
  const removeRow = useUserStore((state) => state.remove);
  const loadRoles = useReferenceStore((state) => state.loadRoles);
  const userProfileUrl = useReferenceStore((state) => state.userProfileUrl);
  const [roles, setRoles] = useState<Role[]>([]);
  const { changeLimit, limit, page, resetPage, setPage } = useUrlPagination({ initialPagination });
  const [orderBy, setOrderBy] = useState<SortOrder>("asc");
  const [editing, setEditing] = useState<User | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [selectedProfileImage, setSelectedProfileImage] = useState<File | null>(null);
  const [crop, setCrop] = useState<CropState>(DEFAULT_CROP);

  const title = t("settings.modules.user.title");
  const description = t("settings.modules.user.description");
  const { appliedSearch, applySearch } = useAppliedSearch(search);
  const hasLoadedRef = useLatestValue(hasLoaded);
  const requestParams = useMemo<FetchUsersParams>(
    () => ({
      search: appliedSearch,
      page,
      limit,
      orderBy,
      lang: language,
      branch_uuid_fk: branchUuid,
      roles_id_fk: loggedRoleId || ""
    }),
    [appliedSearch, branchUuid, language, limit, loggedRoleId, orderBy, page]
  );
  const pageSize = limit === "All" ? rows.length || Number(DEFAULT_LIMIT) : Number(limit ?? DEFAULT_LIMIT);
  const totalPages = Math.max(1, Number(storeTotalPages || Math.ceil(total / pageSize) || 1));
  const pageStart = rows.length ? (page - 1) * pageSize + 1 : 0;
  const pageEnd = rows.length ? pageStart + rows.length - 1 : 0;
  const fullLoading = loading && !hasLoaded;
  const backgroundLoading = refreshing || (loading && hasLoaded);
  const pagingBusy = loading || refreshing;
  const canGoBack = page > 1 && !pagingBusy;
  const canGoNext = page < totalPages && !pagingBusy;
  const { allSelected, removeSelected, selectedRows, toggleAll, toggleSelected } =
    useOptionRowSelection(rows, userId);

  const load = useCallback(async () => {
    if (!branchUuid) {
      showToast({ title: t("settings.loadFailed", { title }), description: t("settings.branchRequired"), tone: "error" });
      return;
    }

    try {
      await loadRows(requestParams, { background: hasLoadedRef.current });
    } catch (error) {
      showToast({
        title: t("settings.loadFailed", { title }),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    }
  }, [branchUuid, hasLoadedRef, loadRows, requestParams, showToast, t, title]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!loggedRoleId) {
      setRoles([]);
      return;
    }

    let active = true;
    loadRoles(language, loggedRoleId)
      .then((nextRoles) => {
        if (active) setRoles(nextRoles);
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
    setSelectedProfileImage(null);
    setCrop(DEFAULT_CROP);
  }, [dialogOpen, editing]);

  function applyFilters() {
    applySearch({ page, resetPage, reload: () => void load() });
  }


  function openCreate() {
    if (!branchUuid) {
      showToast({ title: t("settings.saveFailed"), description: t("settings.branchRequired"), tone: "error" });
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
    setEditing(row);
    setDialogOpen(true);
  }

  async function save(formData: FormData) {
    const selectedRoleId = String(formData.get("roles_id_fk") ?? "").trim();
    const password = String(formData.get("login_password") ?? "").trim();
    const profile = formData.get("login_profile");
    const id = userId(editing);

    if (!branchUuid) {
      showToast({ title: t("settings.saveFailed"), description: t("settings.branchRequired"), tone: "error" });
      return;
    }
    if (!selectedRoleId) {
      showToast({ title: t("settings.saveFailed"), description: t("settings.createRoleFirst"), tone: "error" });
      return;
    }
    if (!id && !password) {
      showToast({ title: t("settings.saveFailed"), description: t("settings.passwordRequired"), tone: "error" });
      return;
    }

    try {
      await saveRow(
        buildUserSaveInput({
          active: String(formData.get("login_active") ?? 1),
          branchUuid,
          editing,
          email: String(formData.get("login_email") ?? ""),
          password,
          profile,
          selectedRoleId
        })
      );
      showToast({ title: t("settings.saved"), tone: "success" });
      setDialogOpen(false);
      setEditing(null);
      await loadRows(requestParams, { background: true });
    } catch (error) {
      showToast({
        title: t("settings.saveFailed"),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    }
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
    const id = userId(row);
    if (!id) return;

    try {
      await removeRow(id);
      showToast({ title: t("settings.deleted"), tone: "success" });
      setDeleteTarget(null);
      removeSelected(id);
      await loadRows(requestParams, { background: true });
    } catch (error) {
      showToast({
        title: t("settings.deleteFailed"),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    }
  }

  const toolbar = (
    <SettingsToolbar
      state={{
        search,
        limit,
        orderBy,
        limitOptions: PAGE_LIMIT_OPTIONS,
        orderOptions: ORDER_OPTIONS.map((option) => ({ label: t(`common.${option.labelKey}`), value: option.value })),
        selectedCount: selectedRows.size,
        onApply: applyFilters,
        onLimit: changeLimit,
        onOrder: (nextOrder) => {
          setOrderBy(nextOrder);
          setPage(1);
        },
        onSearch: setSearch
      }}
    />
  );

  const listSurface = (
    <UserListSurface
      allSelected={allSelected}
      backgroundLoading={backgroundLoading}
      currentLoginUuid={currentLoginUuid}
      page={page}
      pageEnd={pageEnd}
      pageStart={pageStart}
      profileUrl={userProfileUrl}
      rows={rows}
      selectedRows={selectedRows}
      title={title}
      toolbar={toolbar}
      total={total}
      totalPages={totalPages}
      onDelete={setDeleteTarget}
      onEdit={openEdit}
      onToggleAll={toggleAll}
      onToggleSelected={toggleSelected}
    />
  );

  return (
    <>
      <SettingsModuleShell
        addLabel={`${t("actions.add")} ${t("nav.user")}`}
        cardTitle={t("settings.userList")}
        description={description}
        emptyDescription={t("empty.adjustSearch")}
        emptyTitle={t("settings.noRecords", { title: title.toLowerCase() })}
        footer={
          rows.length ? (
            <SettingsPaginationFooter
              canGoBack={canGoBack}
              canGoNext={canGoNext}
              page={page}
              pageEnd={pageEnd}
              pageStart={pageStart}
              total={total}
              totalPages={totalPages}
              onBack={() => setPage((current) => Math.max(1, current - 1))}
              onNext={() => setPage((current) => Math.min(totalPages, current + 1))}
              onPageChange={setPage}
            />
          ) : undefined
        }
        hideCardHeader
        loading={fullLoading}
        loadingLabel={t("settings.loading", { title })}
        table={listSurface}
        title={title}
        onAdd={openCreate}
      />
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
        onOpenChange={(nextOpen) => {
          if (saving) return;
          setDialogOpen(nextOpen);
          if (!nextOpen) setEditing(null);
        }}
        onSubmit={submitUserForm}
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
    </>
  );
}
