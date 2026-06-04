"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CircleHelp, ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, Map as MapIcon, Table2 } from "lucide-react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Table as DataTable, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  SettingsModuleShell,
  SettingsPaginationFooter,
  SettingsDialogBody,
  SettingsDialogContent,
  SettingsDialogFooter,
  SettingsDialogForm,
  SettingsDialogHeader,
  SettingsMobileCard,
  SettingsMobileList,
  SettingsMobileMeta,
  SettingsMobileMetaGrid,
  SettingsRowActions,
  SettingsTableScroll,
  SettingsToolbar
} from "@/features/settings/shared/settings-shell";
import { DEFAULT_PAGE_LIMIT, PAGE_LIMIT_OPTIONS } from "@/lib/pagination";
import type { ApiEntity, PageLimit, SortOrder } from "@/services/shared/types";
import type { FetchTablesParams, SaveTableInput, Table as DiningTable, TableListRow, ZoneGroup } from "@/services/table";
import type { Zone } from "@/services/zone";
import { useAppStore } from "@/stores/app-store";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";
import { useReferenceStore } from "@/stores/reference-store";
import { useTableStore } from "@/stores/table-store";
import { useToastStore } from "@/stores/toast-store";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT: PageLimit = DEFAULT_PAGE_LIMIT;

function value(row: ApiEntity | null, key: string, fallback = "") {
  const raw = row?.[key];
  if (raw === null || raw === undefined || raw === "") return fallback;
  return String(raw);
}

function tableId(row: DiningTable) {
  return value(row, "table_uuid");
}

function tableName(row: DiningTable) {
  return value(row, "table_name", value(row, "table_name_la", value(row, "table_name_eng", "-")));
}

function tableSeats(row: DiningTable) {
  return value(row, "table_qty", value(row, "number_of_seats", "-"));
}

function numberValue(row: ApiEntity | null | undefined, key: string, fallback = 0) {
  const raw = row?.[key];
  const parsed = Number(raw);
  return Number.isFinite(parsed) && raw !== "" && raw !== undefined && raw !== null ? parsed : fallback;
}

function formatPercent(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function branchServiceCharge(row: ApiEntity | null | undefined) {
  const active = numberValue(row, "charge_status", 2) === 1;
  const percent = active ? Math.max(0, numberValue(row, "charge_name", 0)) : 0;

  return {
    active,
    percent,
    percentLabel: `${formatPercent(percent)}%`
  };
}

function zoneLabel(row: ApiEntity | null) {
  return value(row, "zone_name", value(row, "zone_name_la", value(row, "zone_name_eng", "-")));
}

interface TableGroup {
  zoneId: string;
  zoneName: string;
  totalTables?: number;
  tables: DiningTable[];
}

type ZoneGroupWithTables = ZoneGroup & { tables: DiningTable[] };

function isZoneGroup(row: TableListRow): row is ZoneGroupWithTables {
  return Array.isArray((row as ZoneGroup).tables);
}

function flattenTableRows(rows: TableListRow[]): DiningTable[] {
  return rows.flatMap((row) => {
    if (!isZoneGroup(row)) return [row];
    return row.tables.map((table) => ({
      ...table,
      zone_uuid_fk: value(table, "zone_uuid_fk", value(row, "zone_uuid")),
      zone_name: value(table, "zone_name", zoneLabel(row))
    }));
  });
}

function groupTableRows(rows: TableListRow[], zoneById: Map<string, Zone>): TableGroup[] {
  const groups = new Map<string, TableGroup>();
  rows.forEach((row) => {
    if (isZoneGroup(row)) {
      const zoneId = value(row, "zone_uuid") || "__unknown__";
      const zoneName = zoneLabel(row);
      groups.set(zoneId, {
        zoneId,
        zoneName,
        totalTables: Number(row.total_tables ?? row.tables.length),
        tables: row.tables.map((table) => ({
          ...table,
          zone_uuid_fk: value(table, "zone_uuid_fk", zoneId),
          zone_name: value(table, "zone_name", zoneName)
        }))
      });
      return;
    }

    const zoneId = value(row, "zone_uuid_fk") || "__unknown__";
    const zone = zoneById.get(zoneId);
    const group = groups.get(zoneId) ?? { zoneId, zoneName: zone ? zoneLabel(zone) : zoneLabel(row), tables: [] };
    group.tables.push(row);
    group.totalTables = group.tables.length;
    groups.set(zoneId, group);
  });
  return Array.from(groups.values());
}

export function TableSettingsPage() {
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
  const loading = useTableStore((state) => state.loading);
  const saving = useTableStore((state) => state.saving);
  const setSearch = useTableStore((state) => state.setSearch);
  const loadRows = useTableStore((state) => state.load);
  const saveRow = useTableStore((state) => state.save);
  const removeRow = useTableStore((state) => state.remove);
  const loadZoneOptions = useReferenceStore((state) => state.loadZones);
  const [page, setPage] = useState(DEFAULT_PAGE);
  const [limit, setLimit] = useState<PageLimit>(DEFAULT_LIMIT);
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
      const id = value(zone, "zone_uuid");
      if (id) map.set(id, zone);
    });
    return map;
  }, [zoneOptions]);
  const rows = useMemo(() => flattenTableRows(storeRows), [storeRows]);
  const tableGroups = useMemo(() => groupTableRows(storeRows, zoneById), [storeRows, zoneById]);
  const currentBranch = useMemo(() => {
    if (branchStoreUuid !== storeUuid) return null;
    return branches.find((branch) => value(branch, "branch_uuid") === branchUuid) ?? null;
  }, [branches, branchStoreUuid, branchUuid, storeUuid]);
  const serviceCharge = useMemo(() => branchServiceCharge(currentBranch), [currentBranch]);
  const serviceChargeRateLabel = branchLoading && !currentBranch ? t("common.loading") : serviceCharge.percentLabel;
  const groupedResponse = useMemo(() => storeRows.some(isZoneGroup), [storeRows]);
  const displayTotal = groupedResponse ? rows.length : Number(total || rows.length);
  const pageSize = limit === "All" ? rows.length || Number(DEFAULT_LIMIT) : Number(limit ?? DEFAULT_LIMIT);
  const totalPages = Math.max(1, Number(storeTotalPages || Math.ceil(displayTotal / pageSize) || 1));
  const pageStart = rows.length ? (page - 1) * pageSize + 1 : 0;
  const pageEnd = rows.length ? pageStart + rows.length - 1 : 0;
  const canGoBack = page > 1 && !loading;
  const canGoNext = page < totalPages && !loading;
  const ids = useMemo(() => rows.map(tableId).filter(Boolean), [rows]);
  const allSelected = ids.length > 0 && ids.every((id) => selectedRows.has(id));
  const allCollapsed = tableGroups.length > 0 && tableGroups.every((group) => collapsedZones.has(group.zoneId));
  const groupedTableRows = useMemo(() => {
    let rowNumber = pageStart;
    return tableGroups.map((group) => ({
      ...group,
      rows: group.tables.map((row) => ({ row, rowNumber: rowNumber++ }))
    }));
  }, [pageStart, tableGroups]);

  async function load() {
    if (!branchUuid) {
      showToast({ title: t("settings.loadFailed", { title }), description: t("settings.branchRequired"), tone: "error" });
      return;
    }
    try {
      await loadRows(requestParams);
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
    else setPage(1);
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

  async function save(formData: FormData) {
    if (!branchUuid) {
      showToast({ title: t("settings.saveFailed"), description: t("settings.branchRequired"), tone: "error" });
      return;
    }

    const input: SaveTableInput = {
      branch_uuid_fk: branchUuid,
      zone_uuid_fk: formData.get("zone_uuid_fk") ?? "",
      table_name_la: formData.get("table_name_la") ?? "",
      table_name_eng: formData.get("table_name_eng") ?? "",
      charge_status: Number(formData.get("charge_status") ?? 2)
    };
    const seats = formData.get("table_qty");
    if (seats !== null && seats !== "") input.table_qty = Number(seats);
    const id = value(editing, "table_uuid");
    if (id) input.table_uuid = id;

    try {
      await saveRow(input);
      showToast({ title: t("settings.saved"), tone: "success" });
      setDialogOpen(false);
      setEditing(null);
      await loadRows(requestParams);
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
      await loadRows(requestParams);
    } catch (error) {
      showToast({
        title: t("settings.deleteFailed"),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    }
  }

  function renderTableRow(row: DiningTable, rowNumber: number) {
    const id = tableId(row);
    const selected = selectedRows.has(id);
    const relatedZone = zoneById.get(value(row, "zone_uuid_fk"));
    const status = Number(row.table_status ?? 0);
    const chargeActive = Number(row.charge_status ?? 2) === 1;

    return (
      <TableRow key={id || rowNumber} data-state={selected ? "selected" : undefined}>
        <TableCell className="w-10 px-2">
          <Checkbox aria-label={t("common.selectRow", { name: tableName(row) })} checked={selected} onChange={(event) => toggleSelected(id, event.target.checked)} />
        </TableCell>
        <TableCell className="w-px whitespace-nowrap px-2 text-center text-sm font-black text-muted-foreground">{rowNumber}</TableCell>
        <TableCell>
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <Table2 />
            </span>
            <div className="min-w-0">
              <p className="truncate font-black">{tableName(row)}</p>
              <p className="truncate text-xs text-muted-foreground">{relatedZone ? zoneLabel(relatedZone) : zoneLabel(row)}</p>
            </div>
          </div>
        </TableCell>
        <TableCell className="text-muted-foreground">{tableSeats(row)}</TableCell>
        <TableCell>
          {status ? <Badge>{status === 2 ? t("common.busy") : t("common.free")}</Badge> : <span className="text-muted-foreground">-</span>}
        </TableCell>
        <TableCell>
          <Badge className={chargeActive ? "border-primary/25 bg-primary/10 text-primary" : undefined}>
            {chargeActive ? `${t("common.active")} · ${serviceChargeRateLabel}` : t("common.inactive")}
          </Badge>
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
                <TableRow className="bg-muted/40 hover:bg-muted/60">
                  <TableCell colSpan={7} className="px-2 py-0">
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-auto w-full justify-start px-2 py-2 text-left font-bold"
                      onClick={() => toggleZoneCollapse(group.zoneId)}
                    >
                      {collapsed ? <ChevronRight /> : <ChevronDown />}
                      <MapIcon />
                      <span className="min-w-0 flex-1 truncate">{group.zoneName}</span>
                      <Badge className="bg-primary/10 text-primary">{group.totalTables ?? group.tables.length}</Badge>
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
    const relatedZone = zoneById.get(value(row, "zone_uuid_fk"));
    const status = Number(row.table_status ?? 0);
    const chargeActive = Number(row.charge_status ?? 2) === 1;

    return (
      <SettingsMobileCard
        key={id || rowNumber}
        actions={<SettingsRowActions row={row} onEdit={openEdit} onDelete={setDeleteTarget} />}
        badges={<Badge className="shrink-0">{rowNumber}</Badge>}
        checked={selected}
        leading={
          <span className="grid size-9 place-items-center rounded-md bg-primary/10 text-primary">
            <Table2 />
          </span>
        }
        selectLabel={t("common.selectRow", { name: tableName(row) })}
        selected={selected}
        subtitle={<span className="block truncate">{relatedZone ? zoneLabel(relatedZone) : zoneLabel(row)}</span>}
        title={tableName(row)}
        onCheckedChange={(checked) => toggleSelected(id, checked)}
      >
        <SettingsMobileMetaGrid>
          <SettingsMobileMeta label={t("fields.table_qty")} value={tableSeats(row)} />
          <SettingsMobileMeta
            label={t("fields.table_status")}
            value={status ? <Badge>{status === 2 ? t("common.busy") : t("common.free")}</Badge> : "-"}
          />
          <SettingsMobileMeta
            label={t("fields.charge_status")}
            value={
              <Badge className={chargeActive ? "border-primary/25 bg-primary/10 text-primary" : undefined}>
                {chargeActive ? `${t("common.active")} · ${serviceChargeRateLabel}` : t("common.inactive")}
              </Badge>
            }
          />
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
              type="button"
              variant="outline"
              className="min-h-11 justify-start px-3 text-left"
              onClick={() => toggleZoneCollapse(group.zoneId)}
            >
              {collapsed ? <ChevronRight data-icon="inline-start" /> : <ChevronDown data-icon="inline-start" />}
              <MapIcon data-icon="inline-start" />
              <span className="min-w-0 flex-1 truncate">{group.zoneName}</span>
              <Badge className="bg-primary/10 text-primary">{group.totalTables ?? group.tables.length}</Badge>
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

  const groupToggleAction = tableGroups.length ? (
    <div className="flex flex-wrap gap-2">
      <Button
        size="xs"
        type="button"
        variant="outline"
        onClick={() => setCollapsedZones(allCollapsed ? new Set() : new Set(tableGroups.map((group) => group.zoneId)))}
      >
        {allCollapsed ? <ChevronsUpDown data-icon="inline-start" /> : <ChevronsDownUp data-icon="inline-start" />}
        {allCollapsed ? t("actions.expandAll") : t("actions.collapseAll")}
      </Button>
    </div>
  ) : null;

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
        loading={loading}
        loadingLabel={t("settings.loading", { title })}
        mobileList={mobileList}
        summary={`${t("common.showingRange", { start: pageStart, end: pageEnd, total: displayTotal })} - ${t("common.page", { current: page, total: totalPages })}`}
        table={table}
        title={title}
        toolbarStart={groupToggleAction}
        toolbar={
          <SettingsToolbar
            state={{
              search,
              limit,
              orderBy,
              limitOptions: PAGE_LIMIT_OPTIONS,
              selectedCount: selectedRows.size,
              onApply: applyFilters,
              onLimit: (nextLimit) => {
                setLimit(nextLimit);
                setPage(1);
              },
              onOrder: (nextOrder) => {
                setOrderBy(nextOrder);
                setPage(1);
              },
              onSearch: setSearch
            }}
          />
        }
        onAdd={openCreate}
      />
      <TableFormDialog
        branchUuid={branchUuid}
        description={description}
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
  description,
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
  description: string;
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
  const [chargeStatus, setChargeStatus] = useState("2");
  const serviceChargeSummary = serviceChargeLoading
    ? t("common.loading")
    : serviceCharge.active
      ? serviceCharge.percentLabel
      : `${t("common.inactive")} · ${serviceCharge.percentLabel}`;

  useEffect(() => {
    setZoneUuid(value(editing, "zone_uuid_fk"));
    setChargeStatus(value(editing, "charge_status", "2"));
  }, [editing, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SettingsDialogContent>
        <SettingsDialogForm action={onSubmit}>
          <SettingsDialogHeader>
            <DialogTitle>{editing ? t("settings.editRecord") : t("settings.newRecord")}: {title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </SettingsDialogHeader>
          <SettingsDialogBody>
            <FieldGroup>
              <Field>
                <FieldLabel>{t("settings.tableFormHint")}</FieldLabel>
                <FieldDescription>{t("settings.selectZone")}</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="zone_uuid_fk">{t("nav.zone")}</FieldLabel>
                <input name="zone_uuid_fk" type="hidden" value={zoneUuid} />
                <Select required value={zoneUuid} onValueChange={setZoneUuid}>
                  <SelectTrigger id="zone_uuid_fk" className="w-full">
                    <SelectValue placeholder={t("settings.selectZone")} />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectGroup>
                      {zones.map((zone) => {
                        const uuid = value(zone, "zone_uuid");
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
              <div className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="table_name_la">{t("fields.table_name_la")}</FieldLabel>
                  <Input id="table_name_la" name="table_name_la" defaultValue={value(editing, "table_name_la", value(editing, "table_name"))} required />
                </Field>
                <Field>
                  <FieldLabel htmlFor="table_name_eng">{t("fields.table_name_eng")}</FieldLabel>
                  <Input id="table_name_eng" name="table_name_eng" defaultValue={value(editing, "table_name_eng")} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="table_qty">{t("fields.table_qty")}</FieldLabel>
                  <Input id="table_qty" min={0} name="table_qty" type="number" defaultValue={value(editing, "table_qty", value(editing, "number_of_seats"))} />
                </Field>
              </div>
              <Field>
                <div className="flex min-w-0 items-center gap-2">
                  <FieldLabel>{t("fields.charge_status")}</FieldLabel>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        aria-label={t("settings.tableChargeTooltip")}
                        type="button"
                        size="iconSm"
                        variant="ghost"
                        className="size-6 rounded-full text-muted-foreground hover:bg-muted"
                      >
                        <CircleHelp />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-64" side="top">
                      {t("settings.tableChargeTooltip")}
                    </TooltipContent>
                  </Tooltip>
                </div>
                <FieldDescription>{t("settings.tableChargeHint")}</FieldDescription>
                <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-md border border-border bg-muted/25 px-3 py-2 text-sm">
                  <span className="font-bold text-muted-foreground">{t("settings.tableBranchCharge")}</span>
                  <Badge className={serviceCharge.active ? "border-primary/25 bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground"}>
                    {serviceChargeSummary}
                  </Badge>
                </div>
                <input name="charge_status" type="hidden" value={chargeStatus} />
                <RadioGroup className="grid gap-2 sm:grid-cols-2" value={chargeStatus} onValueChange={setChargeStatus}>
                  <label
                    className="flex cursor-pointer items-center gap-3 rounded-md border border-border bg-card p-3 text-sm font-medium has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5"
                    htmlFor="charge_status_2"
                  >
                    <RadioGroupItem id="charge_status_2" value="2" />
                    {t("common.inactive")}
                  </label>
                  <label
                    className="flex cursor-pointer items-center gap-3 rounded-md border border-border bg-card p-3 text-sm font-medium has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5"
                    htmlFor="charge_status_1"
                  >
                    <RadioGroupItem id="charge_status_1" value="1" />
                    {t("common.active")}
                  </label>
                </RadioGroup>
              </Field>
            </FieldGroup>
          </SettingsDialogBody>
          <input name="branch_uuid_fk" type="hidden" value={branchUuid} readOnly />
          <SettingsDialogFooter>
            <Button disabled={saving} type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("actions.cancel")}
            </Button>
            <Button disabled={saving || !branchUuid || !zoneUuid} type="submit">
              {saving ? <Spinner data-icon="inline-start" /> : null}
              {saving ? t("common.processing") : t("actions.save")}
            </Button>
          </SettingsDialogFooter>
        </SettingsDialogForm>
      </SettingsDialogContent>
    </Dialog>
  );
}
