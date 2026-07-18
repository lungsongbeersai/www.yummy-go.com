"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { useResetOnChange } from "@/hooks/use-reset-on-change";
import { useAppliedSearch } from "@/hooks/use-applied-search";
import { useLatestValue } from "@/hooks/use-latest-value";
import { useUrlPagination } from "@/hooks/use-url-pagination";
import { DEFAULT_PAGE_LIMIT, PAGE_LIMIT_OPTIONS } from "@/lib/pagination";
import type { UrlPaginationState } from "@/lib/url-pagination";
import type { Category, FetchCategoriesParams } from "@/services/category";
import type { PageLimit, SortOrder } from "@/services/shared/types";
import { useAppStore } from "@/stores/app-store";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useCategoryStore } from "@/stores/category-store";
import { useReferenceStore } from "@/stores/reference-store";
import { useToastStore } from "@/stores/toast-store";

const DEFAULT_LIMIT: PageLimit = DEFAULT_PAGE_LIMIT;

const EMPTY_GROUP_OPTIONS: GroupOption[] = [];

export function CategorySettingsPage({ initialPagination }: { initialPagination: UrlPaginationState }) {
  const { t } = useTranslation();
  const language = useAppStore((state) => state.language);
  const user = useAuthStore((state) => state.user);
  const storeUuid = authStoreUuid(user);
  const showToast = useToastStore((state) => state.show);
  const storeRows = useCategoryStore((state) => state.rows);
  const total = useCategoryStore((state) => state.total);
  const storeTotalPages = useCategoryStore((state) => state.totalPages);
  const search = useCategoryStore((state) => state.search);
  const hasLoaded = useCategoryStore((state) => state.hasLoaded);
  const loading = useCategoryStore((state) => state.loading);
  const refreshing = useCategoryStore((state) => state.refreshing);
  const saving = useCategoryStore((state) => state.saving);
  const setSearch = useCategoryStore((state) => state.setSearch);
  const loadRows = useCategoryStore((state) => state.load);
  const saveRow = useCategoryStore((state) => state.save);
  const removeRow = useCategoryStore((state) => state.remove);
  const loadGroupOptions = useReferenceStore((state) => state.loadGroups);
  const sortCategoryRows = useReferenceStore((state) => state.sortCategoryRows);
  const { changeLimit, limit, page, resetPage, setPage } = useUrlPagination({ initialPagination });
  const [orderBy, setOrderBy] = useState<SortOrder>("1");
  const [editing, setEditing] = useState<Category | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [displayRows, setDisplayRows] = useState<Category[]>(storeRows);
  const [fetchedGroupOptions, setFetchedGroupOptions] = useState<GroupOption[]>([]);

  const title = t("settings.modules.category.title");
  const description = t("settings.modules.category.description");
  const { appliedSearch, applySearch } = useAppliedSearch(search);
  const hasLoadedRef = useLatestValue(hasLoaded);
  const requestParams = useMemo<FetchCategoriesParams>(
    () => ({ search: appliedSearch, page, limit, orderBy, lang: language, store_uuid_fk: storeUuid }),
    [appliedSearch, language, limit, orderBy, page, storeUuid]
  );
  const orderedRows = displayRows.length === storeRows.length ? displayRows : storeRows;
  const pageSize = limit === "All" ? orderedRows.length || Number(DEFAULT_LIMIT) : Number(limit ?? DEFAULT_LIMIT);
  const totalPages = limit === "All" ? 1 : Math.max(1, Number(storeTotalPages || Math.ceil(total / pageSize) || 1));
  const allRowsLoaded = limit === "All" || totalPages === 1;
  const rows = allRowsLoaded ? orderedRows : storeRows;
  const groupOptionsStoreUuid = storeUuid || rowStoreUuid(storeRows);
  // ไม่มีร้านที่เลือก = ไม่มีกลุ่มให้เลือก แต่คงค่าที่โหลดไว้ไม่ให้ dropdown กะพริบตอนสลับร้าน
  const groupOptions = groupOptionsStoreUuid ? fetchedGroupOptions : EMPTY_GROUP_OPTIONS;
  const dragEnabled = allRowsLoaded && rows.length > 1;
  const pageStart = rows.length ? (page - 1) * pageSize + 1 : 0;
  const pageEnd = rows.length ? pageStart + rows.length - 1 : 0;
  const fullLoading = loading && !hasLoaded;
  const backgroundLoading = refreshing || (loading && hasLoaded);
  const pagingBusy = loading || refreshing;
  const canGoBack = page > 1 && !pagingBusy;
  const canGoNext = page < totalPages && !pagingBusy;
  const { allSelected, ids, removeSelected, selectedRows, toggleAll, toggleSelected } = useOptionRowSelection(
    rows,
    categoryId
  );

  const load = useCallback(async () => {
    try {
      await loadRows(requestParams, { background: hasLoadedRef.current });
    } catch (error) {
      showToast({
        title: t("settings.loadFailed", { title }),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    }
  }, [hasLoadedRef, loadRows, requestParams, showToast, t, title]);

  // displayRows คือสำเนาไว้จัดลำดับแบบ optimistic ต้องรีเซ็ตเมื่อ store โหลดชุดใหม่
  useResetOnChange(storeRows, () => setDisplayRows(storeRows));

  useEffect(() => {
    void load();
  }, [load]);

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

  function applyFilters() {
    applySearch({ page, resetPage, reload: () => void load() });
  }

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(row: Category) {
    setEditing(row);
    setDialogOpen(true);
  }

  function missingFieldDescription(field: ReturnType<typeof missingCategoryField>) {
    if (field === "store") return t("settings.storeRequired");
    if (field === "group") return t("settings.categoryGroupRequired");
    if (field === "name") return t("settings.categoryNameRequired");
    if (field === "icon") return t("settings.categoryIconRequired");
    return t("toasts.pleaseTryAgain");
  }

  async function save(formData: FormData) {
    const groupUuid = String(formData.get("group_uuid_fk") ?? "").trim();
    const nameLa = String(formData.get("cate_name_la") ?? "").trim();
    const nameEng = String(formData.get("cate_name_eng") ?? "").trim();
    const icon = String(formData.get("cate_icon") ?? "").trim();
    const missing = missingCategoryField({ storeUuid, groupUuid, nameLa, icon });

    if (missing) {
      showToast({ title: t("settings.saveFailed"), description: missingFieldDescription(missing), tone: "error" });
      return;
    }

    try {
      await saveRow(buildCategoryPayload({ editing, storeUuid, groupUuid, nameLa, nameEng, icon }));
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

  async function remove(row: Category) {
    const id = categoryId(row);
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
      await loadRows(requestParams, { background: true });
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
        onOpenChange={(nextOpen) => {
          if (saving) return;
          setDialogOpen(nextOpen);
          if (!nextOpen) setEditing(null);
        }}
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
