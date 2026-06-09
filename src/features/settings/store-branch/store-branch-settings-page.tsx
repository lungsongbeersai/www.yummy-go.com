"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { KeyRound } from "lucide-react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { SETTINGS } from "@/features/settings/shared/settings-config";
import {
  SettingsModuleShell,
  SettingsPaginationFooter,
  SettingsRowActions,
  SettingsToolbar
} from "@/features/settings/shared/settings-shell";
import { useUrlPagination } from "@/hooks/use-url-pagination";
import { DEFAULT_PAGE_LIMIT, PAGE_LIMIT_OPTIONS } from "@/lib/pagination";
import { canCreateStoreBranch, canDeleteStoreBranch, canEditStoreBranch } from "@/lib/permissions";
import type { UrlPaginationState } from "@/lib/url-pagination";
import type { PageLimit, SortOrder } from "@/services/shared/types";
import { useAppStore } from "@/stores/app-store";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useReferenceStore } from "@/stores/reference-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useToastStore } from "@/stores/toast-store";
import { StoreBranchFormDialog } from "./store-branch-form";
import { StoreBranchListSurface } from "./store-branch-list";
import type { StoreBranchSettingsRow as Row } from "./store-branch-types";
import {
  buildBranchPayload,
  buildStorePayload,
  missingBranchField,
  missingStoreField,
  storeBranchId,
  storeBranchMediaKey,
  storeBranchName,
  storeBranchValue,
  type StoreBranchKind
} from "./store-branch-utils";
import { useStoreBranchLabels } from "./use-store-branch-labels";

const LIST_LIMIT: PageLimit = DEFAULT_PAGE_LIMIT;
const EMPTY_ROWS: Row[] = [];

export function StoreBranchSettingsPage({ initialPagination, kind }: { initialPagination: UrlPaginationState; kind: StoreBranchKind }) {
  const { t } = useTranslation();
  const config = SETTINGS[kind];
  const language = useAppStore((state) => state.language);
  const labels = useStoreBranchLabels();
  const user = useAuthStore((state) => state.user);
  const storeUuid = authStoreUuid(user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const showToast = useToastStore((state) => state.show);
  const resetPassword = useReferenceStore((state) => state.resetPassword);
  const storeLogoUrl = useReferenceStore((state) => state.storeLogoUrl);
  const branchQrUrl = useReferenceStore((state) => state.branchQrUrl);
  const entity = useSettingsStore((state) => state.entities[config.slug]);
  const rows = (entity?.rows ?? EMPTY_ROWS) as Row[];
  const search = entity?.search ?? "";
  const hasLoaded = entity?.hasLoaded ?? false;
  const loading = entity?.loading ?? false;
  const refreshing = entity?.refreshing ?? false;
  const saving = entity?.saving ?? false;
  const setSearch = useSettingsStore((state) => state.setSearch);
  const loadEntity = useSettingsStore((state) => state.load);
  const saveEntity = useSettingsStore((state) => state.save);
  const removeEntity = useSettingsStore((state) => state.remove);
  const [editing, setEditing] = useState<Row | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(() => new Set());
  const { changeLimit, limit, page, resetPage, setPage } = useUrlPagination({ initialPagination });
  const [orderBy, setOrderBy] = useState<SortOrder>("ASC");

  const canCreate = canCreateStoreBranch(user?.status);
  const canDelete = canDeleteStoreBranch(user?.status);
  const canEdit = canEditStoreBranch(user?.status);
  const scope = useMemo(() => config.scope?.(user) ?? {}, [config, user]);
  const scopeKey = useMemo(() => JSON.stringify(scope), [scope]);
  const visibleRows = useMemo(() => {
    if (kind === "store" && !canCreate) return rows.filter((row) => storeBranchValue(row, "store_uuid") === storeUuid);
    if (kind === "branch" && !canCreate) return rows.filter((row) => storeBranchValue(row, "branch_uuid") === user?.branch_uuid);
    return rows;
  }, [canCreate, kind, rows, storeUuid, user?.branch_uuid]);
  const activeId = kind === "store" ? storeUuid : user?.branch_uuid;
  const title = kind === "store" ? labels.store : labels.branch;
  const description = kind === "store" ? labels.storeHint : labels.branchHint;
  const listTitle = kind === "store" ? labels.storeList : labels.branchList;
  const requestParams = useMemo(
    () => ({ page, limit, orderBy, lang: language, search, ...scope }),
    [language, limit, orderBy, page, scope, search]
  );
  const pageSize = limit === "All" ? visibleRows.length || Number(LIST_LIMIT) : Number(limit ?? LIST_LIMIT);
  const total = canCreate ? Number(entity?.total ?? visibleRows.length) : visibleRows.length;
  const totalPages = canCreate ? Math.max(1, Number(entity?.totalPages || Math.ceil(total / pageSize) || 1)) : 1;
  const pageStart = visibleRows.length ? (page - 1) * pageSize + 1 : 0;
  const pageEnd = visibleRows.length ? pageStart + visibleRows.length - 1 : 0;
  const fullLoading = loading && !hasLoaded;
  const backgroundLoading = refreshing || (loading && hasLoaded);
  const pagingBusy = loading || refreshing;
  const canGoBack = page > 1 && !pagingBusy;
  const canGoNext = page < totalPages && !pagingBusy;
  const visibleIds = useMemo(() => visibleRows.map((row) => storeBranchId(row, kind)).filter(Boolean), [kind, visibleRows]);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedRows.has(id));
  const imageUrl = useMemo(
    () => (row: Row, rowKind: StoreBranchKind) => {
      const key = storeBranchMediaKey(row, rowKind);
      if (!key) return "";
      return rowKind === "store" ? storeLogoUrl(key) : branchQrUrl(key);
    },
    [branchQrUrl, storeLogoUrl]
  );

  useEffect(() => {
    setSelectedRows((current) => {
      if (!current.size) return current;
      const allowed = new Set(visibleIds);
      let changed = false;
      const next = new Set<string>();
      current.forEach((id) => {
        if (allowed.has(id)) next.add(id);
        else changed = true;
      });
      return changed ? next : current;
    });
  }, [visibleIds]);

  async function load(background = hasLoaded) {
    try {
      await loadEntity(config, requestParams, { background });
    } catch (error) {
      showToast({
        title: t("settings.loadFailed", { title }),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.slug, language, scopeKey, page, limit, orderBy]);

  function resetForm() {
    setEditing(null);
    setDialogOpen(false);
  }

  function openCreateForm() {
    if (!canCreate) return;
    setEditing(null);
    setDialogOpen(true);
  }

  function openEditForm(row: Row) {
    if (!canEdit) return;
    setEditing(row);
    setDialogOpen(true);
  }

  function applyFilters() {
    if (page === 1) void load(true);
    else resetPage();
  }

  function toggleSelected(id: string, checked: boolean) {
    if (!id) return;
    setSelectedRows((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAllSelected(checked: boolean) {
    setSelectedRows(checked ? new Set(visibleIds) : new Set());
  }

  function missingFieldDescription(field: ReturnType<typeof missingStoreField> | ReturnType<typeof missingBranchField>) {
    if (field === "store") return labels.storeRequired;
    if (field === "email") return labels.storeEmailRequired;
    if (field === "name") return kind === "store" ? labels.storeNameRequired : labels.branchNameRequired;
    return t("toasts.pleaseTryAgain");
  }

  async function handleSave(formData: FormData) {
    const id = editing ? storeBranchId(editing, kind) : "";
    if (!id && !canCreate) return;
    if (id && !canEdit) return;

    const logo = formData.get("store_logo");
    const qr = formData.get("branch_qr");
    const input =
      kind === "store"
        ? buildStorePayload({
            active: String(formData.get("store_active") ?? "1"),
            editing,
            email: String(formData.get("store_email") ?? ""),
            logo: logo instanceof File && logo.size ? logo : null,
            nameEng: String(formData.get("store_name_eng") ?? ""),
            nameLa: String(formData.get("store_name_la") ?? ""),
            status: String(formData.get("store_status") ?? "2")
          })
        : buildBranchPayload({
            address: String(formData.get("branch_address") ?? ""),
            chargePercent: String(formData.get("charge_name") ?? ""),
            chargeStatus: String(formData.get("charge_status") ?? "2"),
            editing,
            email: String(formData.get("branch_email") ?? ""),
            name: String(formData.get("branch_name") ?? ""),
            qr: qr instanceof File && qr.size ? qr : null,
            storeUuid: storeUuid,
            tel: String(formData.get("branch_tel") ?? ""),
            vatPercent: String(formData.get("vat_name") ?? ""),
            vatStatus: String(formData.get("vat_status") ?? "2")
          });
    const missing =
      kind === "store"
        ? missingStoreField({ email: String(input.store_email ?? ""), nameLa: String(input.store_name_la ?? "") })
        : missingBranchField({ name: String(input.branch_name ?? ""), storeUuid: String(input.store_uuid_fk ?? "") });

    if (missing) {
      showToast({ title: labels.saveFailed, description: missingFieldDescription(missing), tone: "error" });
      return;
    }

    try {
      await saveEntity(config, input);
      const nextRows = await loadEntity(config, requestParams, { background: true });
      const updated = id ? nextRows.find((row) => storeBranchId(row, kind) === id) : null;
      if (updated && kind === "store" && id === storeUuid) {
        updateUser({
          store_logo: storeBranchValue(updated, "store_logo"),
          store_name: storeBranchName(updated, "store")
        });
      }
      if (updated && kind === "branch" && id === user?.branch_uuid) {
        updateUser({
          branch_address: storeBranchValue(updated, "branch_address"),
          branch_name: storeBranchName(updated, "branch"),
          branch_tel: storeBranchValue(updated, "branch_tel")
        });
      }
      showToast({ title: labels.saved, tone: "success" });
      resetForm();
    } catch (error) {
      showToast({
        title: labels.saveFailed,
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    }
  }

  async function handleDelete(row: Row) {
    const id = storeBranchId(row, kind);
    if (!canDelete || !id || id === activeId) return;
    try {
      await removeEntity(config, id);
      await loadEntity(config, requestParams, { background: true });
      if (editing && storeBranchId(editing, kind) === id) resetForm();
      setDeleteTarget(null);
      setSelectedRows((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      showToast({ title: t("settings.deleted"), tone: "success" });
    } catch (error) {
      showToast({
        title: labels.deleteFailed,
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    }
  }

  async function handleResetPassword(row: Row) {
    const email = storeBranchValue(row, "store_email");
    if (!email) return;
    try {
      await resetPassword(email);
      showToast({ title: labels.resetPassword, tone: "success" });
    } catch (error) {
      showToast({
        title: labels.resetFailed,
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    }
  }

  const rowActions = (row: Row) => {
    const id = storeBranchId(row, kind);
    const isCurrent = id === activeId;
    return (
      <SettingsRowActions
        row={row}
        editDisabled={!canEdit || saving}
        deleteDisabled={!canDelete || isCurrent || saving}
        actions={
          kind === "store"
            ? [
                {
                  label: labels.resetPassword,
                  icon: <KeyRound aria-hidden />,
                  disabled: !canEdit || saving,
                  onSelect: (nextRow) => void handleResetPassword(nextRow)
                }
              ]
            : undefined
        }
        onEdit={openEditForm}
        onDelete={setDeleteTarget}
      />
    );
  };

  const toolbar = (
    <SettingsToolbar
      state={{
        search,
        limit,
        orderBy,
        limitOptions: PAGE_LIMIT_OPTIONS,
        selectedCount: selectedRows.size,
        onApply: applyFilters,
        onLimit: changeLimit,
        onOrder: (nextOrder) => {
          setOrderBy(nextOrder);
          setPage(1);
        },
        onSearch: (nextSearch) => setSearch(config.slug, nextSearch)
      }}
    />
  );

  const listSurface = (
    <StoreBranchListSurface
      activeId={activeId}
      allSelected={allSelected}
      backgroundLoading={backgroundLoading}
      imageUrl={imageUrl}
      kind={kind}
      labels={labels}
      listTitle={listTitle}
      page={page}
      pageEnd={pageEnd}
      pageStart={pageStart}
      rowActions={rowActions}
      rows={visibleRows}
      selectedRows={selectedRows}
      toolbar={toolbar}
      total={total}
      totalPages={totalPages}
      onToggleAllSelected={toggleAllSelected}
      onToggleSelected={toggleSelected}
    />
  );

  return (
    <>
      <SettingsModuleShell
        addLabel={kind === "store" ? labels.addStore : labels.addBranch}
        cardTitle={listTitle}
        description={description}
        footer={
          visibleRows.length ? (
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
            />
          ) : undefined
        }
        hideCardHeader
        loading={fullLoading}
        loadingLabel={t("settings.loading", { title })}
        table={listSurface}
        title={title}
        onAdd={canCreate ? openCreateForm : undefined}
      />
      <StoreBranchFormDialog
        activeStoreUuid={storeUuid}
        canEdit={canEdit}
        editing={editing}
        imageUrl={(row, rowKind) => imageUrl(row, rowKind)}
        kind={kind}
        labels={labels}
        open={dialogOpen}
        saving={saving}
        onCancel={resetForm}
        onSubmit={handleSave}
      />
      <ConfirmDialog
        cancelLabel={labels.cancel}
        confirmLabel={labels.delete}
        confirmPending={saving}
        description={labels.deleteConfirm}
        open={Boolean(deleteTarget)}
        title={labels.delete}
        onConfirm={() => {
          if (deleteTarget) void handleDelete(deleteTarget);
        }}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setDeleteTarget(null);
        }}
      />
    </>
  );
}
