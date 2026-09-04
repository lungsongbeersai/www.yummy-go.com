"use client";

import { useTranslation } from "react-i18next";
import { KeyRound } from "lucide-react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import {
  SettingsModuleShell,
  SettingsPaginationFooter,
  SettingsRowActions,
  SettingsToolbar
} from "@/features/settings/shared/settings-shell";
import { optionPageRange, optionPageSize } from "@/features/settings/shared/option-settings-utils";
import { useOptionRowSelection } from "@/features/settings/shared/use-option-row-selection";
import { useOfflineReadOnly } from "@/hooks/use-offline-read-only";
import { useSettingsCrudController } from "@/features/settings/shared/use-settings-crud-controller";
import { PAGE_LIMIT_OPTIONS } from "@/lib/pagination";
import { canCreateStoreBranch, canDeleteStoreBranch, canEditStoreBranch } from "@/lib/permissions";
import type { UrlPaginationState } from "@/lib/url-pagination";
import type { Branch, FetchBranchesParams, SaveBranchInput } from "@/services/branch";
import type { SortOrder } from "@/services/shared/types";
import type { FetchStoresParams, SaveStoreInput, Store } from "@/services/store";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useBranchSettingsStore } from "@/stores/branch-settings-store";
import { useReferenceStore } from "@/stores/reference-store";
import { useStoreSettingsStore } from "@/stores/store-settings-store";
import { StoreBranchFormDialog } from "./store-branch-form";
import { StoreBranchListSurface } from "./store-branch-list";
import type { StoreBranchSettingsRow } from "./store-branch-types";
import {
  buildBranchPayload,
  buildStorePayload,
  missingBranchField,
  missingStoreField,
  storeAuthUserUpdate,
  storeBranchId,
  storeBranchName,
  storeBranchValue,
  type StoreBranchKind
} from "./store-branch-utils";
import { useStoreBranchLabels } from "./use-store-branch-labels";

// ร้าน/สาขาเป็นสโตร์คนละตัว (useStoreSettingsStore / useBranchSettingsStore) — kind ผูกกับเราท์
// (settings/store, settings/branch) จึงคงที่ตลอดอายุของอินสแตนซ์ที่ mount แต่ละครั้ง แยกเป็น 2
// คอมโพเนนต์ย่อยที่ผูก useSettingsCrudController กับสโตร์เดียวคนละตัวได้อย่างปลอดภัย เหตุผลเดียวกับ
// location-settings-page.tsx (คอมเมนต์เต็มอยู่ที่นั่น — cast ชนิดข้ามสโตร์ไม่ปลอดภัย และ auto-load
// ในตัว controller จะยิงทั้งสอง entity พร้อมกันถ้ารวมเป็น instance เดียว)
export function StoreBranchSettingsPage({ initialPagination, kind }: { initialPagination: UrlPaginationState; kind: StoreBranchKind }) {
  if (kind === "branch") return <BranchSettingsPage initialPagination={initialPagination} />;
  return <StoreSettingsPage initialPagination={initialPagination} />;
}

function StoreSettingsPage({ initialPagination }: { initialPagination: UrlPaginationState }) {
  // Master data is read-only offline; its write routes are not on the offline
  // transport, so the controls go away instead of failing when pressed.
  const readOnly = useOfflineReadOnly();
  const { t } = useTranslation();
  const labels = useStoreBranchLabels();
  const updateUser = useAuthStore((state) => state.updateUser);
  const resetPassword = useReferenceStore((state) => state.resetPassword);
  const storeLogoUrl = useReferenceStore((state) => state.storeLogoUrl);
  // handleSave ต้องอ่านแถวที่เพิ่งโหลดกลับมาเพื่อซิงก์ auth state ของร้านตัวเอง (updateUser) — ค่าที่
  // โหลดกลับมาไม่ถูกคืนออกมาจาก save()/load() ของ controller จึงเรียกสโตร์ตรงเหมือน table-page
  const saveStoreRow = useStoreSettingsStore((state) => state.save);
  const loadStoreRows = useStoreSettingsStore((state) => state.load);
  const removeStoreRow = useStoreSettingsStore((state) => state.remove);

  const title = labels.store;
  const description = labels.storeHint;
  const listTitle = labels.storeList;
  const {
    applyFilters,
    backgroundLoading,
    changeLimit,
    deleteTarget,
    dialogOpen,
    editing,
    fullLoading,
    limit,
    openCreate: controllerOpenCreate,
    openEdit: controllerOpenEdit,
    orderBy,
    page,
    requestParams,
    rows,
    saving,
    search,
    setDeleteTarget,
    setDialogOpen,
    setEditing,
    setOrderBy,
    setPage,
    setSearch,
    showToast,
    storeUuid,
    total: controllerTotal,
    totalPages: controllerTotalPages
  } = useSettingsCrudController<Store, SaveStoreInput, FetchStoresParams>({
    // buildInput ให้ครบตามชนิดที่ controller ต้องการ แต่การบันทึกจริงยังเดินตรงผ่านสโตร์ใน
    // handleSave ด้านล่าง (ดูคอมเมนต์ที่ saveStoreRow) เพื่อคงพฤติกรรม "ซิงก์ auth state หลังบันทึก" เดิม
    buildInput: ({ editing: editingRow, formData }) =>
      buildStorePayload({
        active: String(formData.get("store_active") ?? "1"),
        editing: editingRow,
        email: String(formData.get("store_email") ?? ""),
        logo: null,
        nameEng: String(formData.get("store_name_eng") ?? ""),
        nameLa: String(formData.get("store_name_la") ?? ""),
        status: String(formData.get("store_status") ?? "2"),
        tableStatus: String(formData.get("store_table_status") ?? "1")
      }),
    idKey: "store_uuid",
    initialPagination,
    store: useStoreSettingsStore,
    title,
    validateInput: ({ formData }) => {
      const missing = missingStoreField({
        email: String(formData.get("store_email") ?? ""),
        nameLa: String(formData.get("store_name_la") ?? "")
      });
      if (missing === "email") return labels.storeEmailRequired;
      if (missing === "name") return labels.storeNameRequired;
      return null;
    }
  });

  const user = useAuthStore((state) => state.user);
  const canCreate = canCreateStoreBranch(user?.status);
  const canDelete = canDeleteStoreBranch(user?.status);
  const canEdit = canEditStoreBranch(user?.status);
  const activeId = storeUuid;
  // ผู้ใช้ที่สร้างร้านไม่ได้ (เช่น พนักงานร้าน) เห็นได้แค่ร้านตัวเอง — กรองฝั่ง client จากรายการที่โหลดมา
  const visibleRows = canCreate ? rows : rows.filter((row) => storeBranchValue(row, "store_uuid") === storeUuid);
  const { allSelected, removeSelected, selectedRows, toggleAll, toggleSelected } = useOptionRowSelection(
    visibleRows,
    (row) => storeBranchId(row, "store")
  );
  const pageSize = optionPageSize(limit, visibleRows.length);
  const total = canCreate ? controllerTotal : visibleRows.length;
  const totalPages = canCreate ? controllerTotalPages : 1;
  const { start: pageStart, end: pageEnd } = optionPageRange(visibleRows.length, page, pageSize);

  function imageUrl(row: StoreBranchSettingsRow, rowKind: StoreBranchKind) {
    if (rowKind !== "store") return "";
    const key = storeBranchValue(row, "store_logo");
    return key ? storeLogoUrl(key) : "";
  }

  function missingFieldDescription(field: ReturnType<typeof missingStoreField>) {
    if (field === "email") return labels.storeEmailRequired;
    if (field === "name") return labels.storeNameRequired;
    return t("toasts.pleaseTryAgain");
  }

  function resetForm() {
    setEditing(null);
    setDialogOpen(false);
  }

  function openCreate() {
    if (!canCreate) return;
    controllerOpenCreate();
  }

  function openEdit(row: Store) {
    if (!canEdit) return;
    controllerOpenEdit(row);
  }

  async function handleSave(formData: FormData) {
    const id = editing ? storeBranchId(editing, "store") : "";
    if (!id && !canCreate) return;
    if (id && !canEdit) return;

    const logo = formData.get("store_logo");
    const input = buildStorePayload({
      active: String(formData.get("store_active") ?? "1"),
      editing,
      email: String(formData.get("store_email") ?? ""),
      logo: logo instanceof File && logo.size ? logo : null,
      nameEng: String(formData.get("store_name_eng") ?? ""),
      nameLa: String(formData.get("store_name_la") ?? ""),
      status: String(formData.get("store_status") ?? "2"),
      tableStatus: String(formData.get("store_table_status") ?? "1")
    });
    const missing = missingStoreField({ email: String(input.store_email ?? ""), nameLa: String(input.store_name_la ?? "") });
    if (missing) {
      showToast({ title: labels.saveFailed, description: missingFieldDescription(missing), tone: "error" });
      return;
    }

    try {
      await saveStoreRow(input);
      const nextRows = await loadStoreRows(requestParams, { background: true });
      const updated = id ? nextRows.find((row) => storeBranchId(row, "store") === id) : null;
      if (updated && id === storeUuid) {
        updateUser(storeAuthUserUpdate(updated));
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

  async function handleDelete(row: Store) {
    const id = storeBranchId(row, "store");
    if (!canDelete || !id || id === activeId) return;
    try {
      await removeStoreRow(id);
      await loadStoreRows(requestParams, { background: true });
      if (editing && storeBranchId(editing, "store") === id) resetForm();
      setDeleteTarget(null);
      removeSelected(id);
      showToast({ title: t("settings.deleted"), tone: "success" });
    } catch (error) {
      showToast({
        title: labels.deleteFailed,
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    }
  }

  async function handleResetPassword(row: Store) {
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

  function rowActions(row: StoreBranchSettingsRow) {
    const id = storeBranchId(row, "store");
    const isCurrent = id === activeId;
    return (
      <SettingsRowActions
        row={row}
        editDisabled={!canEdit || saving || readOnly}
        deleteDisabled={!canDelete || isCurrent || saving || readOnly}
        actions={[
          {
            label: labels.resetPassword,
            icon: <KeyRound aria-hidden />,
            disabled: !canEdit || saving,
            onSelect: (nextRow) => void handleResetPassword(nextRow as Store)
          }
        ]}
        onEdit={(nextRow) => openEdit(nextRow as Store)}
        onDelete={(nextRow) => setDeleteTarget(nextRow as Store)}
      />
    );
  }

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
        onOrder: (nextOrder: SortOrder) => {
          setOrderBy(nextOrder);
          setPage(1);
        },
        onSearch: setSearch
      }}
    />
  );

  const listSurface = (
    <StoreBranchListSurface
      activeId={activeId}
      allSelected={allSelected}
      backgroundLoading={backgroundLoading}
      imageUrl={imageUrl}
      kind="store"
      labels={labels}
      listTitle={listTitle}
      pageStart={pageStart}
      rowActions={rowActions}
      rows={visibleRows}
      selectedRows={selectedRows}
      toolbar={toolbar}
      onToggleAllSelected={toggleAll}
      onToggleSelected={toggleSelected}
    />
  );

  return (
    <>
      <SettingsModuleShell
        addLabel={labels.addStore}
        cardTitle={listTitle}
        description={description}
        footer={
          visibleRows.length ? (
            <SettingsPaginationFooter
              page={page}
              pageEnd={pageEnd}
              pageStart={pageStart}
              total={total}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          ) : undefined
        }
        hideCardHeader
        loading={fullLoading}
        loadingLabel={t("settings.loading", { title })}
        table={listSurface}
        title={title}
        onAdd={canCreate && !readOnly ? openCreate : undefined}
      />
      <StoreBranchFormDialog
        activeStoreUuid={storeUuid}
        canEdit={canEdit}
        editing={editing}
        imageUrl={imageUrl}
        kind="store"
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

function BranchSettingsPage({ initialPagination }: { initialPagination: UrlPaginationState }) {
  // Master data is read-only offline; its write routes are not on the offline
  // transport, so the controls go away instead of failing when pressed.
  const readOnly = useOfflineReadOnly();
  const { t } = useTranslation();
  const labels = useStoreBranchLabels();
  const updateUser = useAuthStore((state) => state.updateUser);
  const branchQrUrl = useReferenceStore((state) => state.branchQrUrl);
  const saveBranchRow = useBranchSettingsStore((state) => state.save);
  const loadBranchRows = useBranchSettingsStore((state) => state.load);
  const removeBranchRow = useBranchSettingsStore((state) => state.remove);

  const title = labels.branch;
  const description = labels.branchHint;
  const listTitle = labels.branchList;
  const {
    applyFilters,
    backgroundLoading,
    changeLimit,
    deleteTarget,
    dialogOpen,
    editing,
    fullLoading,
    limit,
    openCreate: controllerOpenCreate,
    openEdit: controllerOpenEdit,
    orderBy,
    page,
    requestParams,
    rows,
    saving,
    search,
    setDeleteTarget,
    setDialogOpen,
    setEditing,
    setOrderBy,
    setPage,
    setSearch,
    showToast,
    storeUuid,
    total: controllerTotal,
    totalPages: controllerTotalPages
  } = useSettingsCrudController<Branch, SaveBranchInput, FetchBranchesParams>({
    // buildInput ให้ครบตามชนิดที่ controller ต้องการ แต่การบันทึกจริงยังเดินตรงผ่านสโตร์ใน
    // handleSave ด้านล่าง (ดูคอมเมนต์ที่ saveBranchRow) เพื่อคงพฤติกรรม "ซิงก์ auth state หลังบันทึก" เดิม
    buildInput: ({ editing: editingRow, formData, user: currentUser }) =>
      buildBranchPayload({
        address: String(formData.get("branch_address") ?? ""),
        chargePercent: String(formData.get("charge_name") ?? ""),
        chargeStatus: String(formData.get("charge_status") ?? "2"),
        editing: editingRow,
        email: String(formData.get("branch_email") ?? ""),
        name: String(formData.get("branch_name") ?? ""),
        qr: null,
        storeUuid: authStoreUuid(currentUser),
        tel: String(formData.get("branch_tel") ?? ""),
        vatPercent: String(formData.get("vat_name") ?? ""),
        vatStatus: String(formData.get("vat_status") ?? "2")
      }),
    idKey: "branch_uuid",
    initialPagination,
    // สโตร์เดียวมีหลายสาขา ต้อง scope รายการสาขาด้วย store_uuid_fk ของผู้ใช้เสมอ
    scope: (scopedStoreUuid) => ({ store_uuid_fk: scopedStoreUuid }),
    store: useBranchSettingsStore,
    title,
    validateInput: ({ formData, user: currentUser }) => {
      const missing = missingBranchField({
        name: String(formData.get("branch_name") ?? ""),
        storeUuid: authStoreUuid(currentUser)
      });
      if (missing === "store") return labels.storeRequired;
      if (missing === "name") return labels.branchNameRequired;
      return null;
    }
  });

  const user = useAuthStore((state) => state.user);
  const canCreate = canCreateStoreBranch(user?.status);
  const canDelete = canDeleteStoreBranch(user?.status);
  const canEdit = canEditStoreBranch(user?.status);
  const activeId = user?.branch_uuid ?? "";
  // ผู้ใช้ที่สร้างสาขาไม่ได้ (เช่น พนักงานสาขา) เห็นได้แค่สาขาตัวเอง — กรองฝั่ง client จากรายการที่โหลดมา
  const visibleRows = canCreate ? rows : rows.filter((row) => storeBranchValue(row, "branch_uuid") === activeId);
  const { allSelected, removeSelected, selectedRows, toggleAll, toggleSelected } = useOptionRowSelection(
    visibleRows,
    (row) => storeBranchId(row, "branch")
  );
  const pageSize = optionPageSize(limit, visibleRows.length);
  const total = canCreate ? controllerTotal : visibleRows.length;
  const totalPages = canCreate ? controllerTotalPages : 1;
  const { start: pageStart, end: pageEnd } = optionPageRange(visibleRows.length, page, pageSize);

  function imageUrl(row: StoreBranchSettingsRow, rowKind: StoreBranchKind) {
    if (rowKind !== "branch") return "";
    const key = storeBranchValue(row, "branch_qr");
    return key ? branchQrUrl(key) : "";
  }

  function missingFieldDescription(field: ReturnType<typeof missingBranchField>) {
    if (field === "store") return labels.storeRequired;
    if (field === "name") return labels.branchNameRequired;
    return t("toasts.pleaseTryAgain");
  }

  function resetForm() {
    setEditing(null);
    setDialogOpen(false);
  }

  function openCreate() {
    if (!canCreate) return;
    controllerOpenCreate();
  }

  function openEdit(row: Branch) {
    if (!canEdit) return;
    controllerOpenEdit(row);
  }

  async function handleSave(formData: FormData) {
    const id = editing ? storeBranchId(editing, "branch") : "";
    if (!id && !canCreate) return;
    if (id && !canEdit) return;

    const qr = formData.get("branch_qr");
    const input = buildBranchPayload({
      address: String(formData.get("branch_address") ?? ""),
      chargePercent: String(formData.get("charge_name") ?? ""),
      chargeStatus: String(formData.get("charge_status") ?? "2"),
      editing,
      email: String(formData.get("branch_email") ?? ""),
      name: String(formData.get("branch_name") ?? ""),
      qr: qr instanceof File && qr.size ? qr : null,
      storeUuid,
      tel: String(formData.get("branch_tel") ?? ""),
      vatPercent: String(formData.get("vat_name") ?? ""),
      vatStatus: String(formData.get("vat_status") ?? "2")
    });
    const missing = missingBranchField({ name: String(input.branch_name ?? ""), storeUuid: String(input.store_uuid_fk ?? "") });
    if (missing) {
      showToast({ title: labels.saveFailed, description: missingFieldDescription(missing), tone: "error" });
      return;
    }

    try {
      await saveBranchRow(input);
      const nextRows = await loadBranchRows(requestParams, { background: true });
      const updated = id ? nextRows.find((row) => storeBranchId(row, "branch") === id) : null;
      if (updated && id === activeId) {
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

  async function handleDelete(row: Branch) {
    const id = storeBranchId(row, "branch");
    if (!canDelete || !id || id === activeId) return;
    try {
      await removeBranchRow(id);
      await loadBranchRows(requestParams, { background: true });
      if (editing && storeBranchId(editing, "branch") === id) resetForm();
      setDeleteTarget(null);
      removeSelected(id);
      showToast({ title: t("settings.deleted"), tone: "success" });
    } catch (error) {
      showToast({
        title: labels.deleteFailed,
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    }
  }

  function rowActions(row: StoreBranchSettingsRow) {
    const id = storeBranchId(row, "branch");
    const isCurrent = id === activeId;
    return (
      <SettingsRowActions
        row={row}
        editDisabled={!canEdit || saving || readOnly}
        deleteDisabled={!canDelete || isCurrent || saving || readOnly}
        onEdit={(nextRow) => openEdit(nextRow as Branch)}
        onDelete={(nextRow) => setDeleteTarget(nextRow as Branch)}
      />
    );
  }

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
        onOrder: (nextOrder: SortOrder) => {
          setOrderBy(nextOrder);
          setPage(1);
        },
        onSearch: setSearch
      }}
    />
  );

  const listSurface = (
    <StoreBranchListSurface
      activeId={activeId}
      allSelected={allSelected}
      backgroundLoading={backgroundLoading}
      imageUrl={imageUrl}
      kind="branch"
      labels={labels}
      listTitle={listTitle}
      pageStart={pageStart}
      rowActions={rowActions}
      rows={visibleRows}
      selectedRows={selectedRows}
      toolbar={toolbar}
      onToggleAllSelected={toggleAll}
      onToggleSelected={toggleSelected}
    />
  );

  return (
    <>
      <SettingsModuleShell
        addLabel={labels.addBranch}
        cardTitle={listTitle}
        description={description}
        footer={
          visibleRows.length ? (
            <SettingsPaginationFooter
              page={page}
              pageEnd={pageEnd}
              pageStart={pageStart}
              total={total}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          ) : undefined
        }
        hideCardHeader
        loading={fullLoading}
        loadingLabel={t("settings.loading", { title })}
        table={listSurface}
        title={title}
        onAdd={canCreate && !readOnly ? openCreate : undefined}
      />
      <StoreBranchFormDialog
        activeStoreUuid={storeUuid}
        canEdit={canEdit}
        editing={editing}
        imageUrl={imageUrl}
        kind="branch"
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
