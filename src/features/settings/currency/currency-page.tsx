"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import {
  SettingsModuleShell,
  SettingsPaginationFooter,
  SettingsToolbar
} from "@/features/settings/shared/settings-shell";
import { useUrlPagination } from "@/hooks/use-url-pagination";
import { DEFAULT_PAGE_LIMIT, PAGE_LIMIT_OPTIONS } from "@/lib/pagination";
import type { UrlPaginationState } from "@/lib/url-pagination";
import type { Currency, FetchCurrenciesParams } from "@/services/currency";
import type { PageLimit, SortOrder } from "@/services/shared/types";
import { useAppStore } from "@/stores/app-store";
import { useCurrencyStore } from "@/stores/currency-store";
import { useToastStore } from "@/stores/toast-store";
import { CurrencyFormDialog } from "./currency-form-dialog";
import { CurrencyListSurface } from "./currency-list";
import {
  buildCurrencyPayload,
  currencyId,
  missingCurrencyField
} from "./currency-utils";

const DEFAULT_LIMIT: PageLimit = DEFAULT_PAGE_LIMIT;
const ORDER_OPTIONS: Array<{ labelKey: "asc" | "desc"; value: SortOrder }> = [
  { labelKey: "asc", value: "ASC" },
  { labelKey: "desc", value: "DESC" }
];

export function CurrencySettingsPage({ initialPagination }: { initialPagination: UrlPaginationState }) {
  const { t } = useTranslation();
  const language = useAppStore((state) => state.language);
  const showToast = useToastStore((state) => state.show);
  const rows = useCurrencyStore((state) => state.rows);
  const total = useCurrencyStore((state) => state.total);
  const storeTotalPages = useCurrencyStore((state) => state.totalPages);
  const search = useCurrencyStore((state) => state.search);
  const hasLoaded = useCurrencyStore((state) => state.hasLoaded);
  const loading = useCurrencyStore((state) => state.loading);
  const refreshing = useCurrencyStore((state) => state.refreshing);
  const saving = useCurrencyStore((state) => state.saving);
  const setSearch = useCurrencyStore((state) => state.setSearch);
  const loadRows = useCurrencyStore((state) => state.load);
  const saveRow = useCurrencyStore((state) => state.save);
  const removeRow = useCurrencyStore((state) => state.remove);
  const { changeLimit, limit, page, resetPage, setPage } = useUrlPagination({ initialPagination });
  const [orderBy, setOrderBy] = useState<SortOrder>("ASC");
  const [editing, setEditing] = useState<Currency | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Currency | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(() => new Set());

  const title = t("settings.modules.currency.title");
  const description = t("settings.modules.currency.description");
  const requestParams = useMemo<FetchCurrenciesParams>(
    () => ({
      search,
      page,
      limit,
      orderBy,
      lang: language
    }),
    [language, limit, orderBy, page, search]
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
  const ids = useMemo(() => rows.map(currencyId).filter(Boolean), [rows]);
  const allSelected = ids.length > 0 && ids.every((id) => selectedRows.has(id));

  async function load() {
    try {
      await loadRows(requestParams, { background: hasLoaded });
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
  }, [language, page, limit, orderBy]);

  useEffect(() => {
    setSelectedRows((current) => {
      if (!current.size) return current;
      const allowed = new Set(ids);
      let changed = false;
      const next = new Set<string>();
      current.forEach((id) => {
        if (allowed.has(id)) next.add(id);
        else changed = true;
      });
      return changed ? next : current;
    });
  }, [ids]);

  function applyFilters() {
    if (page === 1) void load();
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

  function toggleAll(checked: boolean) {
    setSelectedRows(checked ? new Set(ids) : new Set());
  }

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(row: Currency) {
    setEditing(row);
    setDialogOpen(true);
  }

  function missingFieldDescription(field: ReturnType<typeof missingCurrencyField>) {
    if (field === "name") return t("settings.currencyNameRequired");
    if (field === "flag") return t("settings.currencyFlagRequired");
    if (field === "status") return t("settings.currencyStatusRequired");
    return t("toasts.pleaseTryAgain");
  }

  async function save(formData: FormData) {
    const name = String(formData.get("currency_name") ?? "").trim();
    const icon = String(formData.get("currency_icon") ?? "").trim();
    const status = String(formData.get("currency_status") ?? "").trim();
    const missing = missingCurrencyField({ icon, name, status });

    if (missing) {
      showToast({ title: t("settings.saveFailed"), description: missingFieldDescription(missing), tone: "error" });
      return;
    }

    try {
      await saveRow(buildCurrencyPayload({ editing, icon, name, status }));
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

  async function remove(row: Currency) {
    const id = currencyId(row);
    if (!id) return;

    try {
      await removeRow(id);
      showToast({ title: t("settings.deleted"), tone: "success" });
      setDeleteTarget(null);
      setSelectedRows((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
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

  return (
    <>
      <SettingsModuleShell
        addLabel={`${t("actions.add")} ${t("nav.currency")}`}
        cardTitle={t("settings.currencyList")}
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
            />
          ) : undefined
        }
        hideCardHeader
        loading={fullLoading}
        loadingLabel={t("settings.loading", { title })}
        table={
          <CurrencyListSurface
            allSelected={allSelected}
            backgroundLoading={backgroundLoading}
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
            onToggleAll={toggleAll}
            onToggleSelected={toggleSelected}
          />
        }
        title={title}
        onAdd={openCreate}
      />
      <CurrencyFormDialog
        editing={editing}
        open={dialogOpen}
        saving={saving}
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
