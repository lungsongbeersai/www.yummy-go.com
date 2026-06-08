"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, CircleHelp, Map as MapIcon, Table2 } from "lucide-react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Table as DataTable, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  SettingsDialogBody,
  SettingsDialogContent,
  SettingsDialogFooter,
  SettingsDialogForm,
  SettingsDialogHeader,
  SettingsMobileCard,
  SettingsMobileList,
  SettingsMobileMeta,
  SettingsMobileMetaGrid,
  SettingsModuleShell,
  SettingsPaginationFooter,
  SettingsRowActions,
  SettingsTableScroll,
  SettingsToolbar
} from "@/features/settings/shared/settings-shell";
import { useUrlPagination } from "@/hooks/use-url-pagination";
import {
  branchServiceCharge,
  buildGroupedTableRows,
  buildTablePayload,
  flattenTableRows,
  groupTableRows,
  isZoneGroup,
  missingTableField,
  serviceChargeSummary,
  tableChargeActive,
  tableId,
  tableName,
  tableSeats,
  tableStatus,
  tableValue,
  zoneLabel
} from "@/features/settings/table/table-utils";
import { DEFAULT_PAGE_LIMIT, PAGE_LIMIT_OPTIONS } from "@/lib/pagination";
import type { UrlPaginationState } from "@/lib/url-pagination";
import type { FetchTablesParams, Table as DiningTable } from "@/services/table";
import type { PageLimit, SortOrder } from "@/services/shared/types";
import type { Zone } from "@/services/zone";
import { useAppStore } from "@/stores/app-store";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";
import { useReferenceStore } from "@/stores/reference-store";
import { useTableStore } from "@/stores/table-store";
import { useToastStore } from "@/stores/toast-store";

const DEFAULT_LIMIT: PageLimit = DEFAULT_PAGE_LIMIT;

function StatusBadge({ status }: { status: number }) {
  const { t } = useTranslation();
  if (!status) return <span className="text-muted-foreground">-</span>;
  return <Badge>{status === 2 ? t("common.busy") : t("common.free")}</Badge>;
}

function ChargeBadge({
  active,
  label
}: {
  active: boolean;
  label: string;
}) {
  return (
    <Badge className={active ? "border-primary/25 bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground"}>
      {label}
    </Badge>
  );
}

function TableIcon() {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
      <Table2 aria-hidden />
    </span>
  );
}

function TableIdentity({
  row,
  zoneName
}: {
  row: DiningTable;
  zoneName: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <TableIcon />
      <div className="min-w-0">
        <p className="truncate font-black">{tableName(row)}</p>
        <p className="truncate text-xs text-muted-foreground">{zoneName}</p>
      </div>
    </div>
  );
}

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

  function tableZoneName(row: DiningTable) {
    const relatedZone = zoneById.get(tableValue(row, "zone_uuid_fk"));
    return relatedZone ? zoneLabel(relatedZone) : zoneLabel(row);
  }

  function renderTableRow(row: DiningTable, rowNumber: number) {
    const id = tableId(row);
    const selected = selectedRows.has(id);
    const status = tableStatus(row);
    const chargeActive = tableChargeActive(row);
    const chargeLabel = chargeActive ? `${t("common.active")} / ${serviceChargeRateLabel}` : t("common.inactive");

    return (
      <TableRow key={id || rowNumber} className="h-14" data-state={selected ? "selected" : undefined}>
        <TableCell className="w-10 px-2">
          <Checkbox aria-label={t("common.selectRow", { name: tableName(row) })} checked={selected} onChange={(event) => toggleSelected(id, event.target.checked)} />
        </TableCell>
        <TableCell className="w-px whitespace-nowrap px-2 text-center text-sm font-black tabular-nums text-muted-foreground">{rowNumber}</TableCell>
        <TableCell className="max-w-[28rem]">
          <TableIdentity row={row} zoneName={tableZoneName(row)} />
        </TableCell>
        <TableCell className="text-muted-foreground tabular-nums" translate="no">{tableSeats(row)}</TableCell>
        <TableCell>
          <StatusBadge status={status} />
        </TableCell>
        <TableCell>
          <ChargeBadge active={chargeActive} label={chargeLabel} />
        </TableCell>
        <TableCell className="text-right">
          <SettingsRowActions row={row} onEdit={openEdit} onDelete={setDeleteTarget} />
        </TableCell>
      </TableRow>
    );
  }

  const table = tableGroups.length ? (
    <SettingsTableScroll>
      <DataTable className="min-w-[960px]">
        <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
          <TableRow>
            <TableHead className="w-10 px-2">
              <Checkbox aria-label={t("common.selectAll")} checked={allSelected} onChange={(event) => toggleAll(event.target.checked)} />
            </TableHead>
            <TableHead className="w-px whitespace-nowrap px-2 text-center">{t("fields.no")}</TableHead>
            <TableHead>{t("nav.table")}</TableHead>
            <TableHead>{t("fields.table_qty")}</TableHead>
            <TableHead>{t("fields.table_status")}</TableHead>
            <TableHead>{t("fields.charge_status")}</TableHead>
            <TableHead className="w-16 text-right">{t("common.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groupedTableRows.map((group) => {
            const collapsed = collapsedZones.has(group.zoneId);
            return (
              <Fragment key={group.zoneId}>
                <TableRow className="bg-muted/35 hover:bg-muted/50">
                  <TableCell colSpan={7} className="px-2 py-0">
                    <Button
                      aria-expanded={!collapsed}
                      aria-label={collapsed ? t("settings.expandZone", { zone: group.zoneName }) : t("settings.collapseZone", { zone: group.zoneName })}
                      className="h-auto w-full justify-start px-2 py-2 text-left font-bold"
                      type="button"
                      variant="ghost"
                      onClick={() => toggleZoneCollapse(group.zoneId)}
                    >
                      {collapsed ? <ChevronRight data-icon="inline-start" /> : <ChevronDown data-icon="inline-start" />}
                      <MapIcon data-icon="inline-start" />
                      <span className="min-w-0 flex-1 truncate">{group.zoneName}</span>
                      <Badge className="bg-primary/10 text-primary tabular-nums">{group.totalTables ?? group.tables.length}</Badge>
                    </Button>
                  </TableCell>
                </TableRow>
                {collapsed ? null : group.rows.length ? (
                  group.rows.map(({ row, rowNumber }) => renderTableRow(row, rowNumber))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-16 text-center text-sm text-muted-foreground">
                      {t("settings.emptyZoneTables")}
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </DataTable>
    </SettingsTableScroll>
  ) : null;

  function renderTableMobileCard(row: DiningTable, rowNumber: number) {
    const id = tableId(row);
    const selected = selectedRows.has(id);
    const status = tableStatus(row);
    const chargeActive = tableChargeActive(row);
    const chargeLabel = chargeActive ? `${t("common.active")} / ${serviceChargeRateLabel}` : t("common.inactive");

    return (
      <SettingsMobileCard
        key={id || rowNumber}
        actions={<SettingsRowActions row={row} onEdit={openEdit} onDelete={setDeleteTarget} />}
        badges={<Badge className="shrink-0 tabular-nums">{rowNumber}</Badge>}
        checked={selected}
        leading={<TableIcon />}
        selectLabel={t("common.selectRow", { name: tableName(row) })}
        selected={selected}
        subtitle={<span className="block truncate">{tableZoneName(row)}</span>}
        title={tableName(row)}
        onCheckedChange={(checked) => toggleSelected(id, checked)}
      >
        <SettingsMobileMetaGrid>
          <SettingsMobileMeta label={t("fields.table_qty")} value={<span className="tabular-nums" translate="no">{tableSeats(row)}</span>} />
          <SettingsMobileMeta label={t("fields.table_status")} value={<StatusBadge status={status} />} />
          <SettingsMobileMeta label={t("fields.charge_status")} value={<ChargeBadge active={chargeActive} label={chargeLabel} />} />
        </SettingsMobileMetaGrid>
      </SettingsMobileCard>
    );
  }

  const mobileList = tableGroups.length ? (
    <SettingsMobileList>
      {groupedTableRows.map((group) => {
        const collapsed = collapsedZones.has(group.zoneId);
        return (
          <div key={group.zoneId} className="flex flex-col gap-2">
            <Button
              aria-expanded={!collapsed}
              aria-label={collapsed ? t("settings.expandZone", { zone: group.zoneName }) : t("settings.collapseZone", { zone: group.zoneName })}
              className="min-h-11 justify-start px-3 text-left"
              type="button"
              variant="outline"
              onClick={() => toggleZoneCollapse(group.zoneId)}
            >
              {collapsed ? <ChevronRight data-icon="inline-start" /> : <ChevronDown data-icon="inline-start" />}
              <MapIcon data-icon="inline-start" />
              <span className="min-w-0 flex-1 truncate">{group.zoneName}</span>
              <Badge className="bg-primary/10 text-primary tabular-nums">{group.totalTables ?? group.tables.length}</Badge>
            </Button>
            {collapsed ? null : group.rows.length ? (
              group.rows.map(({ row, rowNumber }) => renderTableMobileCard(row, rowNumber))
            ) : (
              <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                {t("settings.emptyZoneTables")}
              </div>
            )}
          </div>
        );
      })}
    </SettingsMobileList>
  ) : null;

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

  const groupToggleAction = tableGroups.length ? (
    <Button
      size="xs"
      type="button"
      variant="outline"
      onClick={() => setAllZonesCollapsed(!allCollapsed)}
    >
      {allCollapsed ? <ChevronsUpDown data-icon="inline-start" /> : <ChevronsDownUp data-icon="inline-start" />}
      {allCollapsed ? t("actions.expandAll") : t("actions.collapseAll")}
    </Button>
  ) : null;

  const listSurface = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-border bg-card/95 px-3 py-2.5 backdrop-blur sm:px-4 lg:px-5">
        <div className="flex min-w-0 flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <p className="text-sm font-black">{t("settings.tableList")}</p>
              {groupToggleAction}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("common.showingRange", { start: pageStart, end: pageEnd, total: displayTotal })} - {t("common.page", { current: page, total: totalPages })}
            </p>
          </div>
          <div className="min-w-0 xl:max-w-[48rem]">{toolbar}</div>
        </div>
        {backgroundLoading ? (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Spinner aria-hidden />
            {t("settings.refreshingTableList")}
          </div>
        ) : null}
      </div>
      {tableGroups.length ? (
        <>
          <div className="hidden min-h-0 flex-1 md:flex">{table}</div>
          <div className="min-h-0 flex-1 overflow-y-auto md:hidden">{mobileList}</div>
        </>
      ) : (
        <div className="flex min-h-72 flex-1 items-center justify-center p-4">
          <Empty className="max-w-md border border-dashed bg-muted/20">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Table2 aria-hidden />
              </EmptyMedia>
              <EmptyTitle>{t("settings.noRecords", { title: title.toLowerCase() })}</EmptyTitle>
              <EmptyDescription>{t("empty.adjustSearch")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      )}
    </div>
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

function TableFormDialog({
  branchUuid,
  editing,
  onOpenChange,
  onSubmit,
  open,
  saving,
  serviceCharge,
  serviceChargeLoading,
  title,
  zones
}: {
  branchUuid: string;
  editing: DiningTable | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (formData: FormData) => Promise<void>;
  open: boolean;
  saving: boolean;
  serviceCharge: ReturnType<typeof branchServiceCharge>;
  serviceChargeLoading: boolean;
  title: string;
  zones: Zone[];
}) {
  const { t } = useTranslation();
  const [zoneUuid, setZoneUuid] = useState("");
  const [tableNameLa, setTableNameLa] = useState("");
  const [chargeStatus, setChargeStatus] = useState("2");
  const formKey = tableId(editing) || "new-table";
  const serviceChargeText = serviceChargeSummary({
    activeLabel: t("common.active"),
    inactiveLabel: t("common.inactive"),
    loading: serviceChargeLoading,
    loadingLabel: t("common.loading"),
    serviceCharge
  });

  useEffect(() => {
    setZoneUuid(tableValue(editing, "zone_uuid_fk"));
    setTableNameLa(tableValue(editing, "table_name_la", tableValue(editing, "table_name")));
    setChargeStatus(tableValue(editing, "charge_status", "2"));
  }, [editing, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SettingsDialogContent className="sm:max-w-3xl">
        <SettingsDialogForm key={formKey} action={onSubmit}>
          <SettingsDialogHeader>
            <DialogTitle>{editing ? t("settings.editRecord") : t("settings.newRecord")}: {title}</DialogTitle>
            <DialogDescription>{t("settings.tableFormHint")}</DialogDescription>
          </SettingsDialogHeader>
          <SettingsDialogBody>
            <FieldGroup>
              <FieldSet className="gap-4 rounded-lg border border-border bg-card p-4">
                <Field>
                  <FieldLegend>{t("settings.tableDetails")}</FieldLegend>
                  <FieldDescription>{t("settings.tableDetailsHint")}</FieldDescription>
                </Field>
                <FieldGroup className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="table_name_la">{t("fields.table_name_la")}</FieldLabel>
                    <Input
                      id="table_name_la"
                      name="table_name_la"
                      autoComplete="off"
                      disabled={saving}
                      required
                      value={tableNameLa}
                      onChange={(event) => setTableNameLa(event.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="table_name_eng">{t("fields.table_name_eng")}</FieldLabel>
                    <Input
                      id="table_name_eng"
                      name="table_name_eng"
                      autoComplete="off"
                      defaultValue={tableValue(editing, "table_name_eng")}
                      disabled={saving}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="table_qty">{t("fields.table_qty")}</FieldLabel>
                    <Input
                      id="table_qty"
                      name="table_qty"
                      autoComplete="off"
                      defaultValue={tableValue(editing, "table_qty", tableValue(editing, "number_of_seats"))}
                      disabled={saving}
                      inputMode="numeric"
                      min={0}
                      step={1}
                      type="number"
                    />
                  </Field>
                </FieldGroup>
              </FieldSet>

              <FieldSet className="gap-4 rounded-lg border border-border bg-card p-4">
                <Field>
                  <FieldLegend>{t("settings.tableZoneSection")}</FieldLegend>
                  <FieldDescription>{t("settings.tableZoneHint")}</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="zone_uuid_fk">{t("nav.zone")}</FieldLabel>
                  <input name="zone_uuid_fk" type="hidden" value={zoneUuid} />
                  <Select disabled={saving} required value={zoneUuid} onValueChange={setZoneUuid}>
                    <SelectTrigger id="zone_uuid_fk" className="w-full">
                      <SelectValue placeholder={t("settings.selectZone")} />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectGroup>
                        {zones.map((zone) => {
                          const uuid = tableValue(zone, "zone_uuid");
                          if (!uuid) return null;
                          return (
                            <SelectItem key={uuid} value={uuid}>
                              {zoneLabel(zone)}
                            </SelectItem>
                          );
                        })}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </FieldSet>

              <FieldSet className="gap-4 rounded-lg border border-border bg-card p-4">
                <Field>
                  <div className="flex min-w-0 items-center gap-2">
                    <FieldLegend>{t("settings.tableServiceChargeSection")}</FieldLegend>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          aria-label={t("settings.tableChargeTooltip")}
                          className="size-6 rounded-full text-muted-foreground hover:bg-muted"
                          disabled={saving}
                          size="iconSm"
                          type="button"
                          variant="ghost"
                        >
                          <CircleHelp aria-hidden />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-64" side="top">
                        {t("settings.tableChargeTooltip")}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <FieldDescription>{t("settings.tableChargeHint")}</FieldDescription>
                </Field>
                <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-md border border-border bg-muted/25 px-3 py-2 text-sm">
                  <span className="font-bold text-muted-foreground">{t("settings.tableBranchCharge")}</span>
                  <ChargeBadge active={serviceCharge.active} label={serviceChargeText} />
                </div>
                <Field>
                  <FieldLabel>{t("fields.charge_status")}</FieldLabel>
                  <input name="charge_status" type="hidden" value={chargeStatus} />
                  <RadioGroup className="grid gap-2 sm:grid-cols-2" value={chargeStatus} onValueChange={setChargeStatus}>
                    <label
                      className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-border bg-card p-3 text-sm font-medium has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5"
                      htmlFor="charge_status_2"
                    >
                      <RadioGroupItem id="charge_status_2" disabled={saving} value="2" />
                      {t("common.inactive")}
                    </label>
                    <label
                      className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-border bg-card p-3 text-sm font-medium has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5"
                      htmlFor="charge_status_1"
                    >
                      <RadioGroupItem id="charge_status_1" disabled={saving} value="1" />
                      {t("common.active")}
                    </label>
                  </RadioGroup>
                </Field>
              </FieldSet>
            </FieldGroup>
          </SettingsDialogBody>
          <input name="branch_uuid_fk" type="hidden" value={branchUuid} readOnly />
          <SettingsDialogFooter>
            <Button disabled={saving} type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("actions.cancel")}
            </Button>
            <Button disabled={saving || !branchUuid || !zoneUuid || !tableNameLa.trim()} type="submit">
              {saving ? <Spinner data-icon="inline-start" /> : null}
              {saving ? t("common.processing") : t("actions.save")}
            </Button>
          </SettingsDialogFooter>
        </SettingsDialogForm>
      </SettingsDialogContent>
    </Dialog>
  );
}
