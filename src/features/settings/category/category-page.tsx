"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { CategoryFormDialog } from "@/features/settings/category/category-form-dialog";
import { CategoryListSurface } from "@/features/settings/category/category-list";
import {
  buildCategoryPayload,
  categoryId,
  categoryValue,
  groupLabel,
  missingCategoryField,
  rowStoreUuid,
  type GroupOption
} from "@/features/settings/category/category-utils";
import {
  SettingsModuleShell,
  SettingsPaginationFooter,
  SettingsToolbar,
} from "@/features/settings/shared/settings-shell";
import { useOptionRowSelection } from "@/features/settings/shared/use-option-row-selection";
import { useSettingsCrudController } from "@/features/settings/shared/use-settings-crud-controller";
import { useResetOnChange } from "@/hooks/use-reset-on-change";
import { DEFAULT_PAGE_LIMIT, PAGE_LIMIT_OPTIONS } from "@/lib/pagination";
import type { UrlPaginationState } from "@/lib/url-pagination";
import type { Category, FetchCategoriesParams, SaveCategoryInput } from "@/services/category";
import { useAppStore } from "@/stores/app-store";
import { useCategoryStore } from "@/stores/category-store";
import { useReferenceStore } from "@/stores/reference-store";

const EMPTY_GROUP_OPTIONS: GroupOption[] = [];

export function CategorySettingsPage({ initialPagination }: { initialPagination: UrlPaginationState }) {
  const { t } = useTranslation();
  const language = useAppStore((state) => state.language);
  const loadGroupOptions = useReferenceStore((state) => state.loadGroups);
  const sortCategoryRows = useReferenceStore((state) => state.sortCategoryRows);
  // reload หลังจัดเรียงต้องยิงตรงผ่านสโตร์ (ไม่ผ่าน controller.load) เพื่อให้ error ของมันหลุดไปเข้า
  // catch ของ persistOrder เอง (ให้ rollback ลำดับ + toast "sortFailed" ตามพฤติกรรมเดิม)
  const loadRowsDirect = useCategoryStore((state) => state.load);
  const [fetchedGroupOptions, setFetchedGroupOptions] = useState<GroupOption[]>([]);

  const title = t("settings.modules.category.title");
  const description = t("settings.modules.category.description");
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
    pagingBusy,
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
  } = useSettingsCrudController<Category, SaveCategoryInput, FetchCategoriesParams>({
    buildInput: ({ editing: editingRow, formData, storeUuid: scopedStoreUuid }) => {
      const groupUuid = String(formData.get("group_uuid_fk") ?? "").trim();
      const nameLa = String(formData.get("cate_name_la") ?? "").trim();
      const nameEng = String(formData.get("cate_name_eng") ?? "").trim();
      const icon = String(formData.get("cate_icon") ?? "").trim();
      return buildCategoryPayload({ editing: editingRow, storeUuid: scopedStoreUuid, groupUuid, nameLa, nameEng, icon });
    },
    idKey: "cate_uuid",
    initialOrderBy: "1",
    initialPagination,
    scope: (scopedStoreUuid) => ({ store_uuid_fk: scopedStoreUuid }),
    store: useCategoryStore,
    title,
    validateInput: ({ formData, storeUuid: scopedStoreUuid }) => {
      const groupUuid = String(formData.get("group_uuid_fk") ?? "").trim();
      const nameLa = String(formData.get("cate_name_la") ?? "").trim();
      const icon = String(formData.get("cate_icon") ?? "").trim();
      const missing = missingCategoryField({ storeUuid: scopedStoreUuid, groupUuid, nameLa, icon });
      if (missing === "store") return t("settings.storeRequired");
      if (missing === "group") return t("settings.categoryGroupRequired");
      if (missing === "name") return t("settings.categoryNameRequired");
      if (missing === "icon") return t("settings.categoryIconRequired");
      return null;
    }
  });

  const [displayRows, setDisplayRows] = useState<Category[]>(storeRows);
  const orderedRows = displayRows.length === storeRows.length ? displayRows : storeRows;
  const pageSize = limit === "All" ? orderedRows.length || Number(DEFAULT_PAGE_LIMIT) : Number(limit ?? DEFAULT_PAGE_LIMIT);
  // ต้องบังคับ totalPages=1 เมื่อ limit="All" เอง เพราะ backend ไม่รายงานค่านี้ให้ถูกต้องสำหรับคำขอแบบโหลดทั้งหมด
  const totalPages = limit === "All" ? 1 : baseTotalPages;
  const allRowsLoaded = limit === "All" || totalPages === 1;
  const rows = allRowsLoaded ? orderedRows : storeRows;
  const groupOptionsStoreUuid = storeUuid || rowStoreUuid(storeRows);
  // ไม่มีร้านที่เลือก = ไม่มีกลุ่มให้เลือก แต่คงค่าที่โหลดไว้ไม่ให้ dropdown กะพริบตอนสลับร้าน
  const groupOptions = groupOptionsStoreUuid ? fetchedGroupOptions : EMPTY_GROUP_OPTIONS;
  const dragEnabled = allRowsLoaded && rows.length > 1;
  const pageStart = rows.length ? (page - 1) * pageSize + 1 : 0;
  const pageEnd = rows.length ? pageStart + rows.length - 1 : 0;
  const canGoBack = page > 1 && !pagingBusy;
  const canGoNext = page < totalPages && !pagingBusy;
  const { allSelected, ids, selectedRows, toggleAll, toggleSelected } = useOptionRowSelection(rows, categoryId);

  // displayRows คือสำเนาไว้จัดลำดับแบบ optimistic ต้องรีเซ็ตเมื่อ store โหลดชุดใหม่
  useResetOnChange(storeRows, () => setDisplayRows(storeRows));

  useEffect(() => {
    if (!groupOptionsStoreUuid) return;

    let active = true;
    loadGroupOptions(language, groupOptionsStoreUuid)
      .then((groups) => {
        if (!active) return;
        setFetchedGroupOptions(
          groups
            .map((group) => ({ label: groupLabel(group), value: categoryValue(group, "group_uuid") }))
            .filter((option) => option.value)
        );
      })
      .catch((error) => {
        showToast({
          title: t("settings.loadFailed", { title: t("settings.modules.group.title") }),
          description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
          tone: "error"
        });
      });

    return () => {
      active = false;
    };
  }, [groupOptionsStoreUuid, language, loadGroupOptions, showToast, t]);

  async function persistOrder(nextRows: Category[]) {
    const previousRows = rows;
    const sortStoreUuid = storeUuid || rowStoreUuid(nextRows);
    if (!sortStoreUuid) {
      showToast({
        title: t("category.sortFailed"),
        description: t("settings.storeRequired"),
        tone: "error"
      });
      return;
    }

    setDisplayRows(nextRows);
    try {
      await sortCategoryRows({
        store_uuid_fk: sortStoreUuid,
        items: nextRows
          .map((row, index) => ({ cate_uuid: categoryId(row), cate_sort: index + 1 }))
          .filter((item) => item.cate_uuid)
      });
      showToast({ title: t("category.sorted"), tone: "success" });
      await loadRowsDirect(requestParams, { background: true });
    } catch (error) {
      setDisplayRows(previousRows);
      showToast({
        title: t("category.sortFailed"),
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
        orderOptions: [
          { label: t("common.oldestFirst"), value: "1" },
          { label: t("common.newestFirst"), value: "-1" }
        ],
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
        addLabel={`${t("actions.add")} ${t("nav.category")}`}
        cardTitle={t("settings.categoryList")}
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
        table={
          <CategoryListSurface
            allSelected={allSelected}
            backgroundLoading={backgroundLoading}
            dragEnabled={dragEnabled}
            ids={ids}
            page={page}
            pageEnd={pageEnd}
            pageStart={pageStart}
            rows={rows}
            selectedRows={selectedRows}
            title={title}
            toolbar={toolbar}
            total={total}
            totalPages={totalPages}
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
      <CategoryFormDialog
        editing={editing}
        groupOptions={groupOptions}
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
