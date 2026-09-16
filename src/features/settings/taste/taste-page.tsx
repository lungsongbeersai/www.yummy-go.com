"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { TasteFormDialog } from "@/features/settings/taste/taste-form-dialog";
import { TasteListSurface } from "@/features/settings/taste/taste-list";
import {
  buildTastePayload,
  buildTasteSortPayload,
  missingTasteField,
  rowStoreUuid,
  tasteId
} from "@/features/settings/taste/taste-utils";
import {
  SettingsModuleShell,
  SettingsPaginationFooter,
  SettingsToolbar
} from "@/features/settings/shared/settings-shell";
import { useOptionRowSelection } from "@/features/settings/shared/use-option-row-selection";
import { useSettingsCrudController } from "@/features/settings/shared/use-settings-crud-controller";
import { useResetOnChange } from "@/hooks/use-reset-on-change";
import { DEFAULT_PAGE_LIMIT, PAGE_LIMIT_OPTIONS } from "@/lib/pagination";
import type { UrlPaginationState } from "@/lib/url-pagination";
import type { FetchTastesParams, SaveTasteInput, Taste } from "@/services/taste";
import { useTasteStore } from "@/stores/taste-store";

export function TasteSettingsPage({ initialPagination }: { initialPagination: UrlPaginationState }) {
  const { t } = useTranslation();
  const saveRowDirect = useTasteStore((state) => state.save);
  // reload หลังจัดเรียงต้องยิงตรงผ่านสโตร์ (ไม่ผ่าน controller.load) เพื่อให้ error ของมันหลุดไปเข้า
  // catch ของ persistOrder เอง (ให้ rollback ลำดับ + toast "saveFailed" ตามพฤติกรรมเดิมของ category)
  const loadRowsDirect = useTasteStore((state) => state.load);

  const title = t("settings.modules.taste.title");
  const description = t("settings.modules.taste.description");
  const {
    applyFilters,
    changeLimit,
    deleteTarget,
    backgroundLoading,
    dialogOpen,
    editing,
    fullLoading,
    limit,
    onDialogOpenChange,
    openCreate,
    openEdit,
    orderBy,
    page,
    remove,
    requestParams,
    rows: storeRows,
    saving,
    search,
    setDeleteTarget,
    setOrderBy,
    setPage,
    setSearch,
    showToast,
    storeUuid,
    save,
    total,
    totalPages: baseTotalPages
  } = useSettingsCrudController<Taste, SaveTasteInput, FetchTastesParams>({
    buildInput: ({ editing: editingRow, formData, storeUuid: scopedStoreUuid }) => {
      const nameLa = String(formData.get("taste_name_la") ?? "").trim();
      const nameEng = String(formData.get("taste_name_eng") ?? "").trim();
      const status = String(formData.get("taste_status") ?? "").trim();
      return buildTastePayload({ editing: editingRow, nameEng, nameLa, status, storeUuid: scopedStoreUuid });
    },
    idKey: "taste_uuid",
    initialPagination,
    requiredScopeKey: "store_uuid_fk",
    requiredScopeMessage: t("settings.storeRequired"),
    scope: (scopedStoreUuid) => ({ store_uuid_fk: scopedStoreUuid, include_inactive: 1 }),
    store: useTasteStore,
    title,
    validateInput: ({ formData, storeUuid: scopedStoreUuid }) => {
      const nameLa = String(formData.get("taste_name_la") ?? "").trim();
      const status = String(formData.get("taste_status") ?? "").trim();
      const missing = missingTasteField({ nameLa, status, storeUuid: scopedStoreUuid });
      if (missing === "store") return t("settings.storeRequired");
      if (missing === "name") return t("settings.tasteNameRequired");
      if (missing === "status") return t("settings.tasteStatusRequired");
      return null;
    }
  });

  const [displayRows, setDisplayRows] = useState<Taste[]>(storeRows);
  const orderedRows = displayRows.length === storeRows.length ? displayRows : storeRows;
  const pageSize = limit === "All" ? orderedRows.length || Number(DEFAULT_PAGE_LIMIT) : Number(limit ?? DEFAULT_PAGE_LIMIT);
  // ต้องบังคับ totalPages=1 เมื่อ limit="All" เอง เพราะ backend ไม่รายงานค่านี้ให้ถูกต้องสำหรับคำขอแบบโหลดทั้งหมด
  const totalPages = limit === "All" ? 1 : baseTotalPages;
  const allRowsLoaded = limit === "All" || totalPages === 1;
  const rows = allRowsLoaded ? orderedRows : storeRows;
  const dragEnabled = allRowsLoaded && rows.length > 1;
  const pageStart = rows.length ? (page - 1) * pageSize + 1 : 0;
  const pageEnd = rows.length ? pageStart + rows.length - 1 : 0;
  const { allSelected, ids, selectedRows, toggleAll, toggleSelected } = useOptionRowSelection(rows, tasteId);

  // displayRows คือสำเนาไว้จัดลำดับแบบ optimistic ต้องรีเซ็ตเมื่อ store โหลดชุดใหม่
  useResetOnChange(storeRows, () => setDisplayRows(storeRows));

  async function persistOrder(nextRows: Taste[]) {
    const previousRows = rows;
    const sortStoreUuid = storeUuid || rowStoreUuid(nextRows);
    if (!sortStoreUuid) {
      showToast({ title: t("settings.saveFailed"), description: t("settings.storeRequired"), tone: "error" });
      return;
    }

    setDisplayRows(nextRows);
    try {
      // ไม่มี endpoint sort รวมแบบ category (/api/v1/category/sort) — ยิง create (upsert) ทีละแถว
      // ผ่านชื่อ/สถานะเดิมของมันบวก taste_sort ใหม่ ให้ API ที่มีอยู่เป็นตัวจัดเก็บลำดับแทน
      await Promise.all(nextRows.map((row, index) => saveRowDirect(buildTasteSortPayload(row, index + 1))));
      showToast({ title: t("settings.saved"), tone: "success" });
      await loadRowsDirect(requestParams, { background: true });
    } catch (error) {
      setDisplayRows(previousRows);
      showToast({
        title: t("settings.saveFailed"),
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

  return (
    <>
      <SettingsModuleShell
        addLabel={`${t("actions.add")} ${t("nav.taste")}`}
        cardTitle={t("settings.tasteList")}
        description={description}
        emptyDescription={t("empty.adjustSearch")}
        emptyTitle={t("settings.noRecords", { title: title.toLowerCase() })}
        footer={
          rows.length ? (
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
        table={
          <TasteListSurface
            allSelected={allSelected}
            backgroundLoading={backgroundLoading}
            dragEnabled={dragEnabled}
            ids={ids}
            pageStart={pageStart}
            rows={rows}
            selectedRows={selectedRows}
            title={title}
            toolbar={toolbar}
            onDelete={setDeleteTarget}
            onEdit={openEdit}
            onReorder={(nextRows) => {
              void persistOrder(nextRows);
            }}
            onToggleAll={toggleAll}
            onToggleSelected={toggleSelected}
          />
        }
        title={title}
        onAdd={openCreate}
      />
      <TasteFormDialog
        editing={editing}
        open={dialogOpen}
        saving={saving}
        title={title}
        onOpenChange={onDialogOpenChange}
        onSubmit={save}
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
