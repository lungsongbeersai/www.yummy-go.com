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
import type { PageLimit, SortOrder } from "@/services/shared/types";
import type { FetchTablesParams, Table as DiningTable } from "@/services/table";
import type { Zone } from "@/services/zone";
import { useAppStore } from "@/stores/app-store";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";
import { useReferenceStore } from "@/stores/reference-store";
import { useTableStore } from "@/stores/table-store";
import { useToastStore } from "@/stores/toast-store";
import { TableFormDialog } from "./table-form-dialog";
import { TableListSurface } from "./table-list";
import {
  branchServiceCharge,
  buildGroupedTableRows,
  buildTablePayload,
  flattenTableRows,
  groupTableRows,
  isZoneGroup,
  missingTableField,
  tableId,
  tableValue
} from "./table-utils";

const DEFAULT_LIMIT: PageLimit = DEFAULT_PAGE_LIMIT;

export function TableSettingsPage({ initialPagination }: { initialPagination: UrlPaginationState }) {
  const { t } = useTranslation();
  const language = useAppStore((state) => state.language);
  const user = useAuthStore((state) => state.user);
  const storeUuid = authStoreUuid(user);
  const branchUuid = user?.branch_uuid ?? "";
  const showToast = useToastStore((state) => state.show);
  const branches = useBranchStore((state) => state.branches);
  const branchStoreUuid = useBranchStore((state) => state.storeUuid);
  const branchLoading = useBranchStore((state) => state.loading);
  const loadBranches = useBranchStore((state) => state.loadBranches);
  const storeRows = useTableStore((state) => state.rows);
  const total = useTableStore((state) => state.total);
  const storeTotalPages = useTableStore((state) => state.totalPages);
  const search = useTableStore((state) => state.search);
  const hasLoaded = useTableStore((state) => state.hasLoaded);
  const loading = useTableStore((state) => state.loading);
  const refreshing = useTableStore((state) => state.refreshing);
  const saving = useTableStore((state) => state.saving);
  const setSearch = useTableStore((state) => state.setSearch);
  const loadRows = useTableStore((state) => state.load);
  const saveRow = useTableStore((state) => state.save);
  const removeRow = useTableStore((state) => state.remove);
  const loadZoneOptions = useReferenceStore((state) => state.loadZones);
  const { changeLimit, limit, page, resetPage, setPage } = useUrlPagination({ initialPagination });
  const [orderBy, setOrderBy] = useState<SortOrder>("ASC");
  const [editing, setEditing] = useState<DiningTable | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DiningTable | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(() => new Set());
  const [zoneOptions, setZoneOptions] = useState<Zone[]>([]);
  const [collapsedZones, setCollapsedZones] = useState<Set<string>>(() => new Set());

  const title = t("settings.modules.table.title");
  const description = t("settings.modules.table.description");
  const requestParams = useMemo<FetchTablesParams>(
    () => ({ search, page, limit, orderBy, lang: language, branch_uuid_fk: branchUuid }),
    [branchUuid, language, limit, orderBy, page, search]
  );
  const zoneById = useMemo(() => {
    const map = new Map<string, Zone>();
    zoneOptions.forEach((zone) => {
      const id = tableValue(zone, "zone_uuid");
      if (id) map.set(id, zone);
    });
    return map;
  }, [zoneOptions]);
  const rows = useMemo(() => flattenTableRows(storeRows), [storeRows]);
  const tableGroups = useMemo(() => groupTableRows(storeRows, zoneById), [storeRows, zoneById]);
  const currentBranch = useMemo(() => {
    if (branchStoreUuid !== storeUuid) return null;
    return branches.find((branch) => tableValue(branch, "branch_uuid") === branchUuid) ?? null;
  }, [branches, branchStoreUuid, branchUuid, storeUuid]);
  const serviceCharge = useMemo(() => branchServiceCharge(currentBranch), [currentBranch]);
  const serviceChargeRateLabel = branchLoading && !currentBranch ? t("common.loading") : serviceCharge.percentLabel;
  const groupedResponse = useMemo(() => storeRows.some(isZoneGroup), [storeRows]);
  const displayTotal = groupedResponse ? rows.length : Number(total || rows.length);
  const pageSize = limit === "All" ? rows.length || Number(DEFAULT_LIMIT) : Number(limit ?? DEFAULT_LIMIT);
  const totalPages = Math.max(1, Number(storeTotalPages || Math.ceil(displayTotal / pageSize) || 1));
  const pageStart = rows.length ? (page - 1) * pageSize + 1 : 0;
  const pageEnd = rows.length ? pageStart + rows.length - 1 : 0;
  const fullLoading = loading && !hasLoaded;
  const backgroundLoading = refreshing || (loading && hasLoaded);
  const pagingBusy = loading || refreshing;
  const canGoBack = page > 1 && !pagingBusy;
  const canGoNext = page < totalPages && !pagingBusy;
  const ids = useMemo(() => rows.map(tableId).filter(Boolean), [rows]);
  const allSelected = ids.length > 0 && ids.every((id) => selectedRows.has(id));
  const allCollapsed = tableGroups.length > 0 && tableGroups.every((group) => collapsedZones.has(group.zoneId));
  const groupedTableRows = useMemo(() => buildGroupedTableRows(tableGroups, pageStart), [pageStart, tableGroups]);

  async function load() {
    if (!branchUuid) {
      showToast({ title: t("settings.loadFailed", { title }), description: t("settings.branchRequired"), tone: "error" });
      return;
    }
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
  }, [branchUuid, language, page, limit, orderBy]);

  useEffect(() => {
    if (!storeUuid) return;

    void loadBranches(storeUuid, branchUuid).catch((error) => {
      showToast({
        title: t("settings.loadFailed", { title: t("nav.branch") }),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    });
  }, [branchUuid, loadBranches, showToast, storeUuid, t]);

  useEffect(() => {
    if (!branchUuid) {
      setZoneOptions([]);
      return;
    }

    let active = true;
    loadZoneOptions(language, branchUuid)
      .then((zones) => {
        if (active) setZoneOptions(zones);
      })
      .catch((error) => {
        showToast({
          title: t("settings.loadFailed", { title: t("settings.modules.zone.title") }),
          description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
          tone: "error"
        });
      });

    return () => {
      active = false;
    };
  }, [branchUuid, language, loadZoneOptions, showToast, t]);

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

  useEffect(() => {
    setCollapsedZones((current) => {
      if (!current.size) return current;
      const allowed = new Set(tableGroups.map((group) => group.zoneId));
      let changed = false;
      const next = new Set<string>();
      current.forEach((id) => {
        if (allowed.has(id)) next.add(id);
        else changed = true;
      });
      return changed ? next : current;
    });
  }, [tableGroups]);

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

  function toggleZoneCollapse(zoneId: string) {
    setCollapsedZones((current) => {
      const next = new Set(current);
      if (next.has(zoneId)) next.delete(zoneId);
      else next.add(zoneId);
      return next;
    });
  }

  function setAllZonesCollapsed(collapsed: boolean) {
    setCollapsedZones(collapsed ? new Set(tableGroups.map((group) => group.zoneId)) : new Set());
  }

  function openCreate() {
    if (!branchUuid) {
      showToast({ title: t("settings.saveFailed"), description: t("settings.branchRequired"), tone: "error" });
      return;
    }
    if (!zoneOptions.length) {
      showToast({ title: t("settings.saveFailed"), description: t("settings.createZoneFirst"), tone: "error" });
      return;
    }
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(row: DiningTable) {
    setEditing(row);
    setDialogOpen(true);
  }

  function missingFieldDescription(field: ReturnType<typeof missingTableField>) {
    if (field === "branch") return t("settings.branchRequired");
    if (field === "zone") return t("settings.tableZoneRequired");
    if (field === "name") return t("settings.tableNameRequired");
    return t("toasts.pleaseTryAgain");
  }

  async function save(formData: FormData) {
    const zoneUuid = String(formData.get("zone_uuid_fk") ?? "").trim();
    const nameLa = String(formData.get("table_name_la") ?? "").trim();
    const nameEng = String(formData.get("table_name_eng") ?? "").trim();
    const seats = String(formData.get("table_qty") ?? "").trim();
    const chargeStatus = String(formData.get("charge_status") ?? "2").trim();
    const missing = missingTableField({ branchUuid, nameLa, zoneUuid });

    if (missing) {
      showToast({ title: t("settings.saveFailed"), description: missingFieldDescription(missing), tone: "error" });
      return;
    }

    try {
      await saveRow(buildTablePayload({ branchUuid, chargeStatus, editing, nameEng, nameLa, seats, zoneUuid }));
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

  async function remove(row: DiningTable) {
    const id = tableId(row);
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
    <TableListSurface
      allCollapsed={allCollapsed}
      allSelected={allSelected}
      backgroundLoading={backgroundLoading}
      collapsedZones={collapsedZones}
      displayTotal={displayTotal}
      groupedRows={groupedTableRows}
      page={page}
      pageEnd={pageEnd}
      pageStart={pageStart}
      selectedRows={selectedRows}
      serviceChargeRateLabel={serviceChargeRateLabel}
      title={title}
      toolbar={toolbar}
      totalPages={totalPages}
      zoneById={zoneById}
      onDelete={setDeleteTarget}
      onEdit={openEdit}
      onToggleAll={toggleAll}
      onToggleAllZones={setAllZonesCollapsed}
      onToggleSelected={toggleSelected}
      onToggleZoneCollapse={toggleZoneCollapse}
    />
  );

  return (
    <>
      <SettingsModuleShell
        addLabel={`${t("actions.add")} ${t("nav.table")}`}
        cardTitle={t("settings.tableList")}
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
              total={displayTotal}
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
        onAdd={openCreate}
      />
      <TableFormDialog
        branchUuid={branchUuid}
        editing={editing}
        open={dialogOpen}
        saving={saving}
        serviceCharge={serviceCharge}
        serviceChargeLoading={branchLoading && !currentBranch}
        title={title}
        zones={zoneOptions}
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
