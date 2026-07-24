"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { StoreApi, UseBoundStore } from "zustand";
import {
  optionPageRange,
  optionPageSize,
  optionTotalPages,
  optionValue
} from "@/features/settings/shared/option-settings-utils";
import { useOptionRowSelection } from "@/features/settings/shared/use-option-row-selection";
import { useAppliedSearch } from "@/hooks/use-applied-search";
import { useLatestValue } from "@/hooks/use-latest-value";
import { useUrlPagination } from "@/hooks/use-url-pagination";
import type { UrlPaginationState } from "@/lib/url-pagination";
import type { ApiEntity, FetchParams, SortOrder } from "@/services/shared/types";
import { useAppStore } from "@/stores/app-store";
import { authStoreUuid, useAuthStore, type AuthUser } from "@/stores/auth-store";
import type { CrudListState } from "@/stores/crud-list-store";
import { useToastStore } from "@/stores/toast-store";

export type SettingsCrudStore<Row extends ApiEntity, SaveInput extends ApiEntity, Params extends FetchParams> =
  UseBoundStore<StoreApi<CrudListState<Row, SaveInput, Params>>>;

export interface SettingsCrudSaveArgs<Row extends ApiEntity> {
  editing: Row | null;
  formData: FormData;
  scope: Record<string, unknown>;
  storeUuid: string;
  user: AuthUser | null;
}

export interface UseSettingsCrudControllerArgs<
  Row extends ApiEntity,
  SaveInput extends ApiEntity,
  Params extends FetchParams
> {
  buildInput: (args: SettingsCrudSaveArgs<Row>) => SaveInput;
  idKey: keyof Row & string;
  initialOrderBy?: SortOrder;
  initialPagination: UrlPaginationState;
  requiredScopeKey?: string;
  requiredScopeMessage?: string;
  scope?: (storeUuid: string, user: AuthUser | null) => Record<string, unknown>;
  store: SettingsCrudStore<Row, SaveInput, Params>;
  title: string;
  validateInput?: (args: SettingsCrudSaveArgs<Row>) => string | null;
}

// สกัดออกมาจาก OptionSettingsPage เดิม (state/pagination/dialog/CRUD wiring) เพื่อให้หน้าที่
// ไม่เข้ากับ fields[] แบบ generic (มี custom table/dialog ของตัวเอง) ยังใช้ตัวเดียวกันได้
// โดยไม่ต้องก๊อปโค้ด pagination/search/CRUD ซ้ำ — ดู option-settings-page.tsx สำหรับหน้าที่ fit fields[]
export function useSettingsCrudController<
  Row extends ApiEntity,
  SaveInput extends ApiEntity,
  Params extends FetchParams
>({
  buildInput,
  idKey,
  initialOrderBy = "ASC",
  initialPagination,
  requiredScopeKey,
  requiredScopeMessage,
  scope: getScope,
  store,
  title,
  validateInput
}: UseSettingsCrudControllerArgs<Row, SaveInput, Params>) {
  const { t } = useTranslation();
  const language = useAppStore((state) => state.language);
  const user = useAuthStore((state) => state.user);
  const storeUuid = authStoreUuid(user);
  const showToast = useToastStore((state) => state.show);
  const rows = store((state) => state.rows);
  const total = store((state) => state.total);
  const storeTotalPages = store((state) => state.totalPages);
  const search = store((state) => state.search);
  const hasLoaded = store((state) => state.hasLoaded);
  const loading = store((state) => state.loading);
  const refreshing = store((state) => state.refreshing);
  const saving = store((state) => state.saving);
  const setSearch = store((state) => state.setSearch);
  const loadRows = store((state) => state.load);
  const saveRow = store((state) => state.save);
  const removeRow = store((state) => state.remove);
  const { changeLimit, limit, page, resetPage, setPage } = useUrlPagination({ initialPagination });
  const [orderBy, setOrderBy] = useState<SortOrder>(initialOrderBy);
  const [editing, setEditing] = useState<Row | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);

  const scope = useMemo(() => getScope?.(storeUuid, user) ?? {}, [getScope, storeUuid, user]);
  const missingRequiredScope = Boolean(requiredScopeKey && !String(scope[requiredScopeKey] ?? "").trim());
  const requiredScopeDescription = requiredScopeMessage ?? t("settings.branchRequired");
  const { appliedSearch, applySearch } = useAppliedSearch(search);
  const hasLoadedRef = useLatestValue(hasLoaded);
  const requestParams = useMemo<Params>(
    () => ({ search: appliedSearch, page, limit, orderBy, lang: language, ...scope }) as Params,
    [appliedSearch, language, limit, orderBy, page, scope]
  );
  const pageSize = optionPageSize(limit, rows.length);
  const totalPages = optionTotalPages(storeTotalPages, total, pageSize);
  const { start: pageStart, end: pageEnd } = optionPageRange(rows.length, page, pageSize);
  const fullLoading = loading && !hasLoaded;
  const backgroundLoading = refreshing || (loading && hasLoaded);
  const pagingBusy = loading || refreshing;
  const rowId = useCallback((row: Row) => optionValue(row, idKey), [idKey]);
  const { allSelected, ids, removeSelected, selectedRows, toggleAll, toggleSelected } = useOptionRowSelection(rows, rowId);

  const load = useCallback(async () => {
    if (missingRequiredScope) {
      showToast({ title: t("settings.loadFailed", { title }), description: requiredScopeDescription, tone: "error" });
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
  }, [hasLoadedRef, loadRows, missingRequiredScope, requestParams, requiredScopeDescription, showToast, t, title]);

  useEffect(() => {
    void load();
  }, [load]);

  function applyFilters() {
    applySearch({ page, resetPage, reload: () => void load() });
  }

  function openCreate() {
    if (missingRequiredScope) {
      showToast({ title: t("settings.saveFailed"), description: requiredScopeDescription, tone: "error" });
      return;
    }
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(row: Row) {
    setEditing(row);
    setDialogOpen(true);
  }

  // handler มาตรฐานสำหรับ Dialog.onOpenChange — กันปิดระหว่าง saving และล้าง editing เมื่อปิด
  function onDialogOpenChange(nextOpen: boolean) {
    if (saving) return;
    setDialogOpen(nextOpen);
    if (!nextOpen) setEditing(null);
  }

  async function save(formData: FormData) {
    if (missingRequiredScope) {
      showToast({ title: t("settings.saveFailed"), description: requiredScopeDescription, tone: "error" });
      return;
    }

    const args = { editing, formData, scope, storeUuid, user };
    const validationMessage = validateInput?.(args) ?? null;
    if (validationMessage) {
      showToast({ title: t("settings.saveFailed"), description: validationMessage, tone: "error" });
      return;
    }

    try {
      const input = buildInput(args);
      await saveRow(input);
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

  async function remove(row: Row) {
    const id = rowId(row);
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

  return {
    allSelected,
    applyFilters,
    backgroundLoading,
    changeLimit,
    deleteTarget,
    dialogOpen,
    editing,
    fullLoading,
    hasLoaded,
    ids,
    language,
    limit,
    load,
    loading,
    missingRequiredScope,
    onDialogOpenChange,
    openCreate,
    openEdit,
    orderBy,
    page,
    pageEnd,
    pageSize,
    pageStart,
    pagingBusy,
    refreshing,
    remove,
    removeSelected,
    requestParams,
    requiredScopeDescription,
    resetPage,
    rowId,
    rows,
    save,
    saving,
    scope,
    search,
    selectedRows,
    setDeleteTarget,
    setDialogOpen,
    setEditing,
    setOrderBy,
    setPage,
    setSearch,
    showToast,
    storeUuid,
    t,
    title,
    toggleAll,
    toggleSelected,
    total,
    totalPages,
    user
  };
}
