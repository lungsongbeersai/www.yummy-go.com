"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, MapPin, MapPinned } from "lucide-react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { useDropdownButtonLoading } from "@/hooks/use-dropdown-button-loading";
import { DEFAULT_PAGE_LIMIT, PAGE_LIMIT_OPTIONS } from "@/lib/pagination";
import { canManageLocationSettings } from "@/lib/permissions";
import type { ApiEntity, PageLimit, SortOrder } from "@/services/shared/types";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { useDistrictStore } from "@/stores/district-store";
import { useProvinceStore } from "@/stores/province-store";
import { useToastStore } from "@/stores/toast-store";

type LocationKind = "province" | "district";
type Row = ApiEntity;

interface LocationLabels {
  district: string;
  formHint: string;
  list: string;
  no: string;
  page: string;
  province: string;
  selectProvince: string;
  showing: string;
  sortAsc: string;
  sortDesc: string;
}

const LOCATION_CONFIG = {
  province: {
    slug: "province",
    idKey: "province_uuid"
  },
  district: {
    slug: "district",
    idKey: "district_uuid"
  }
} as const;

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT: PageLimit = DEFAULT_PAGE_LIMIT;

function value(row: Row | null, key: string, fallback = "") {
  const raw = row?.[key];
  if (raw === null || raw === undefined || raw === "") return fallback;
  return String(raw);
}

function displayName(row: Row, kind: LocationKind) {
  const prefix = kind === "province" ? "province" : "district";
  return value(row, `${prefix}_name`, value(row, `${prefix}_name_la`, value(row, `${prefix}_name_eng`, "-")));
}

function rowId(row: Row, kind: LocationKind) {
  return value(row, kind === "province" ? "province_uuid" : "district_uuid");
}

function provinceLabel(row: Row) {
  return value(row, "province_name", value(row, "province_name_la", value(row, "province_name_eng", "-")));
}

function ProvinceCombobox({
  id,
  loading = false,
  onValueChange,
  provinces,
  value: selectedValue
}: {
  id: string;
  loading?: boolean;
  onValueChange: (value: string) => void;
  provinces: Row[];
  value: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const options = useMemo(() => {
    const selectedExists = provinces.some((province) => value(province, "province_uuid") === selectedValue);
    const list = provinces.map((province) => {
      const uuid = value(province, "province_uuid");
      const label = provinceLabel(province);
      const laoName = value(province, "province_name_la");
      const englishName = value(province, "province_name_eng");
      return {
        label,
        searchText: [uuid, label, laoName, englishName].join(" ").toLowerCase(),
        value: uuid
      };
    });

    if (!selectedValue || selectedExists) return list;
    return [{ label: selectedValue, searchText: selectedValue.toLowerCase(), value: selectedValue }, ...list];
  }, [provinces, selectedValue]);
  const selected = options.find((option) => option.value === selectedValue);
  const dropdownLoading = useDropdownButtonLoading({ loading, open, loadingKey: `${options.length}:${selectedValue}` });

  return (
    <>
      <input name="province_uuid_fk" type="hidden" value={selectedValue} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-busy={dropdownLoading}
            className="w-full justify-between"
            id={id}
            role="combobox"
            type="button"
            variant="outline"
          >
            <span className="min-w-0 truncate">{selected?.label || t("settings.selectProvince")}</span>
            {dropdownLoading ? (
              <Spinner data-icon="inline-end" />
            ) : (
              <ChevronsUpDown className="opacity-50" data-icon="inline-end" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] overflow-hidden p-0"
          portalled={false}
          side="bottom"
          sideOffset={6}
          onTouchMove={(event) => event.stopPropagation()}
          onWheel={(event) => event.stopPropagation()}
        >
          <Command
            className="[&_[data-slot=command-input-wrapper]]:h-8 [&_[data-slot=command-input]]:h-8 [&_[data-slot=command-item]]:py-1"
            filter={(value, search) => (value.includes(search.toLowerCase()) ? 1 : 0)}
          >
            <CommandInput placeholder={t("settings.searchProvince")} />
            <CommandList className="max-h-28 overscroll-contain">
              <CommandEmpty>{t("settings.noProvincesFound")}</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={`${option.value} ${option.searchText}`}
                    onSelect={() => {
                      onValueChange(option.value);
                      setOpen(false);
                    }}
                  >
                    <MapPin />
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    <Check className={option.value === selectedValue ? "ml-auto opacity-100" : "ml-auto opacity-0"} />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  );
}

export function LocationSettingsPage({ kind }: { kind: LocationKind }) {
  const { t } = useTranslation();
  const config = LOCATION_CONFIG[kind];
  const language = useAppStore((state) => state.language);
  const user = useAuthStore((state) => state.user);
  const showToast = useToastStore((state) => state.show);
  const provinceRows = useProvinceStore((state) => state.rows) as Row[];
  const provinceTotal = useProvinceStore((state) => state.total);
  const provinceTotalPages = useProvinceStore((state) => state.totalPages);
  const provinceSearch = useProvinceStore((state) => state.search);
  const provinceLoading = useProvinceStore((state) => state.loading);
  const provinceSaving = useProvinceStore((state) => state.saving);
  const setProvinceSearch = useProvinceStore((state) => state.setSearch);
  const loadProvinces = useProvinceStore((state) => state.load);
  const saveProvince = useProvinceStore((state) => state.save);
  const removeProvince = useProvinceStore((state) => state.remove);
  const districtRows = useDistrictStore((state) => state.rows) as Row[];
  const districtTotal = useDistrictStore((state) => state.total);
  const districtTotalPages = useDistrictStore((state) => state.totalPages);
  const districtSearch = useDistrictStore((state) => state.search);
  const districtLoading = useDistrictStore((state) => state.loading);
  const districtSaving = useDistrictStore((state) => state.saving);
  const setDistrictSearch = useDistrictStore((state) => state.setSearch);
  const loadDistricts = useDistrictStore((state) => state.load);
  const saveDistrict = useDistrictStore((state) => state.save);
  const removeDistrict = useDistrictStore((state) => state.remove);
  const [page, setPage] = useState(DEFAULT_PAGE);
  const [limit, setLimit] = useState<PageLimit>(DEFAULT_LIMIT);
  const [orderBy, setOrderBy] = useState<SortOrder>("ASC");
  const [editing, setEditing] = useState<Row | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(() => new Set());
  const [collapsedProvinces, setCollapsedProvinces] = useState<Set<string>>(() => new Set());

  const rows = kind === "province" ? provinceRows : districtRows;
  const search = kind === "province" ? provinceSearch : districtSearch;
  const loading = kind === "province" ? provinceLoading : districtLoading;
  const saving = kind === "province" ? provinceSaving : districtSaving;
  const setSearch = kind === "province" ? setProvinceSearch : setDistrictSearch;
  const total = kind === "province" ? provinceTotal : districtTotal;
  const storeTotalPages = kind === "province" ? provinceTotalPages : districtTotalPages;
  const canManage = canManageLocationSettings(user?.status);
  const title = t(`settings.modules.${config.slug}.title`);
  const description = t(`settings.modules.${config.slug}.description`);
  const labels: LocationLabels = {
    district: t("nav.district"),
    formHint: t("settings.locationFormHint"),
    list: t("settings.locationList"),
    no: t("fields.no"),
    page: t("common.pageLabel"),
    province: t("nav.province"),
    selectProvince: t("settings.selectProvince"),
    showing: t("common.showing"),
    sortAsc: t("common.asc"),
    sortDesc: t("common.desc")
  };
  const requestParams = useMemo(
    () => ({ search, page, limit, orderBy, lang: language }),
    [language, limit, orderBy, page, search]
  );
  const pageSize = limit === "All" ? rows.length || Number(DEFAULT_LIMIT) : Number(limit ?? DEFAULT_LIMIT);
  const totalPages = Math.max(1, Number(storeTotalPages || Math.ceil(total / pageSize) || 1));
  const pageStart = rows.length ? (page - 1) * pageSize + 1 : 0;
  const pageEnd = rows.length ? pageStart + rows.length - 1 : 0;
  const canGoBack = page > 1 && !loading;
  const canGoNext = page < totalPages && !loading;
  const ids = useMemo(() => rows.map((row) => rowId(row, kind)).filter(Boolean), [kind, rows]);
  const allSelected = ids.length > 0 && ids.every((id) => selectedRows.has(id));
  const provinceById = useMemo(() => {
    const map = new Map<string, Row>();
    provinceRows.forEach((province) => {
      const id = value(province, "province_uuid");
      if (id) map.set(id, province);
    });
    return map;
  }, [provinceRows]);
  const groupedDistricts = useMemo(() => {
    if (kind !== "district") return [];
    const groups = new Map<string, { provinceId: string; provinceName: string; districts: Array<{ row: Row; index: number }> }>();
    rows.forEach((row, index) => {
      const provinceId = value(row, "province_uuid_fk") || "__unknown__";
      const province = provinceById.get(provinceId);
      const provinceName = province ? provinceLabel(province) : provinceLabel(row) || "-";
      const group = groups.get(provinceId) ?? { provinceId, provinceName, districts: [] };
      group.districts.push({ row, index });
      groups.set(provinceId, group);
    });
    return Array.from(groups.values());
  }, [kind, provinceById, rows]);
  const allCollapsed =
    kind === "district" &&
    groupedDistricts.length > 0 &&
    groupedDistricts.every((group) => collapsedProvinces.has(group.provinceId));
  const tableColumnCount = 3 + (kind === "district" ? 1 : 0) + (canManage ? 1 : 0);

  async function load() {
    try {
      if (kind === "province") await loadProvinces(requestParams);
      else await loadDistricts(requestParams);
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
  }, [config.slug, language, page, limit, orderBy]);

  useEffect(() => {
    if (kind !== "district") return;
    void loadProvinces({ search: "", page: 1, limit: "All", orderBy: "ASC", lang: language });
  }, [kind, language, loadProvinces]);

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

  function toggleProvinceCollapse(provinceId: string) {
    setCollapsedProvinces((current) => {
      const next = new Set(current);
      if (next.has(provinceId)) next.delete(provinceId);
      else next.add(provinceId);
      return next;
    });
  }

  function openCreate() {
    if (!canManage) return;
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(row: Row) {
    if (!canManage) return;
    setEditing(row);
    setDialogOpen(true);
  }

  async function save(formData: FormData) {
    if (!canManage) return;
    const input: Row = {};
    const id = editing ? rowId(editing, kind) : "";
    if (id) input[config.idKey] = id;

    if (kind === "province") {
      input.province_name_la = formData.get("province_name_la") ?? "";
      input.province_name_eng = formData.get("province_name_eng") ?? "";
    } else {
      input.province_uuid_fk = formData.get("province_uuid_fk") ?? "";
      input.district_name_la = formData.get("district_name_la") ?? "";
      input.district_name_eng = formData.get("district_name_eng") ?? "";
    }

    try {
      if (kind === "province") await saveProvince(input);
      else await saveDistrict(input);
      showToast({ title: t("settings.saved"), tone: "success" });
      setDialogOpen(false);
      setEditing(null);
      if (kind === "province") await loadProvinces(requestParams);
      else await loadDistricts(requestParams);
    } catch (error) {
      showToast({
        title: t("settings.saveFailed"),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    }
  }

  async function remove(row: Row) {
    const id = rowId(row, kind);
    if (!canManage || !id) return;
    try {
      if (kind === "province") await removeProvince(id);
      else await removeDistrict(id);
      showToast({ title: t("settings.deleted"), tone: "success" });
      setDeleteTarget(null);
      setSelectedRows((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      if (kind === "province") await loadProvinces(requestParams);
      else await loadDistricts(requestParams);
    } catch (error) {
      showToast({
        title: t("settings.deleteFailed"),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    }
  }

  function renderLocationRow(row: Row, rowNumber: number) {
    const id = rowId(row, kind);
    const selected = selectedRows.has(id);
    const relatedProvince = provinceById.get(value(row, "province_uuid_fk"));

    return (
      <TableRow key={id || rowNumber} data-state={selected ? "selected" : undefined}>
        <TableCell className="w-10 px-2">
          <Checkbox
            aria-label={t("common.selectRow", { name: displayName(row, kind) })}
            checked={selected}
            onChange={(event) => toggleSelected(id, event.target.checked)}
          />
        </TableCell>
        <TableCell className="w-px whitespace-nowrap px-2 text-center text-sm font-black text-muted-foreground">{rowNumber}</TableCell>
        <TableCell>
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <MapPinned />
            </span>
            <div className="min-w-0">
              <p className="truncate font-black">{displayName(row, kind)}</p>
              <p className="truncate text-xs text-muted-foreground">
                {value(row, `${kind}_name_la`, "-")} / {value(row, `${kind}_name_eng`, "-")}
              </p>
            </div>
          </div>
        </TableCell>
        {kind === "district" ? (
          <TableCell className="text-muted-foreground">
            {relatedProvince ? provinceLabel(relatedProvince) : provinceLabel(row)}
          </TableCell>
        ) : null}
        {canManage ? (
          <TableCell className="text-right">
            <SettingsRowActions row={row} onEdit={openEdit} onDelete={setDeleteTarget} />
          </TableCell>
        ) : null}
      </TableRow>
    );
  }

  const table = rows.length ? (
    <SettingsTableScroll>
      <Table className="min-w-[940px]">
        <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
          <TableRow>
            <TableHead className="w-10 px-2">
              <Checkbox aria-label={t("common.selectAll")} checked={allSelected} onChange={(event) => toggleAll(event.target.checked)} />
            </TableHead>
            <TableHead className="w-px whitespace-nowrap px-2 text-center">{labels.no}</TableHead>
            <TableHead>{kind === "province" ? labels.province : labels.district}</TableHead>
            {kind === "district" ? <TableHead>{labels.province}</TableHead> : null}
            {canManage ? <TableHead className="w-16 text-right">{t("common.actions")}</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {kind === "district"
            ? groupedDistricts.map((group) => {
                const collapsed = collapsedProvinces.has(group.provinceId);
                return (
                  <Fragment key={group.provinceId}>
                    <TableRow className="bg-muted/40 hover:bg-muted/60">
                      <TableCell colSpan={tableColumnCount} className="px-2 py-0">
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-auto w-full justify-start px-2 py-2 text-left font-bold"
                          onClick={() => toggleProvinceCollapse(group.provinceId)}
                        >
                          {collapsed ? <ChevronRight /> : <ChevronDown />}
                          <MapPin />
                          <span className="min-w-0 flex-1 truncate">{group.provinceName}</span>
                          <Badge className="bg-primary/10 text-primary">{group.districts.length}</Badge>
                        </Button>
                      </TableCell>
                    </TableRow>
                    {collapsed ? null : group.districts.map(({ row, index }) => renderLocationRow(row, pageStart + index))}
                  </Fragment>
                );
              })
            : rows.map((row, index) => renderLocationRow(row, pageStart + index))}
        </TableBody>
      </Table>
    </SettingsTableScroll>
  ) : null;
  function renderLocationMobileCard(row: Row, rowNumber: number) {
    const id = rowId(row, kind);
    const selected = selectedRows.has(id);
    const relatedProvince = provinceById.get(value(row, "province_uuid_fk"));

    return (
      <SettingsMobileCard
        key={id || rowNumber}
        actions={canManage ? <SettingsRowActions row={row} onEdit={openEdit} onDelete={setDeleteTarget} /> : undefined}
        badges={<Badge className="shrink-0">{rowNumber}</Badge>}
        checked={selected}
        leading={
          <span className="grid size-9 place-items-center rounded-md bg-primary/10 text-primary">
            <MapPinned />
          </span>
        }
        selectLabel={t("common.selectRow", { name: displayName(row, kind) })}
        selected={selected}
        subtitle={
          <span className="block truncate">
            {value(row, `${kind}_name_la`, "-")} / {value(row, `${kind}_name_eng`, "-")}
          </span>
        }
        title={displayName(row, kind)}
        onCheckedChange={(checked) => toggleSelected(id, checked)}
      >
        <SettingsMobileMetaGrid>
          {kind === "district" ? (
            <SettingsMobileMeta label={labels.province} value={relatedProvince ? provinceLabel(relatedProvince) : provinceLabel(row)} />
          ) : null}
        </SettingsMobileMetaGrid>
      </SettingsMobileCard>
    );
  }
  const mobileList = rows.length ? (
    <SettingsMobileList>
      {kind === "district"
        ? groupedDistricts.map((group) => {
            const collapsed = collapsedProvinces.has(group.provinceId);
            return (
              <div key={group.provinceId} className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 justify-start px-3 text-left"
                  onClick={() => toggleProvinceCollapse(group.provinceId)}
                >
                  {collapsed ? <ChevronRight data-icon="inline-start" /> : <ChevronDown data-icon="inline-start" />}
                  <MapPin data-icon="inline-start" />
                  <span className="min-w-0 flex-1 truncate">{group.provinceName}</span>
                  <Badge className="bg-primary/10 text-primary">{group.districts.length}</Badge>
                </Button>
                {collapsed
                  ? null
                  : group.districts.map(({ row, index }) => renderLocationMobileCard(row, pageStart + index))}
              </div>
            );
          })
        : rows.map((row, index) => renderLocationMobileCard(row, pageStart + index))}
    </SettingsMobileList>
  ) : null;
  const addLabel = `${t("actions.add")} ${kind === "province" ? labels.province : labels.district}`;
  const groupToggleAction =
    kind === "district" && groupedDistricts.length > 0 ? (
      <div className="flex flex-wrap gap-2">
        <Button
          size="xs"
          type="button"
          variant="outline"
          onClick={() => setCollapsedProvinces(allCollapsed ? new Set() : new Set(groupedDistricts.map((group) => group.provinceId)))}
        >
          {allCollapsed ? <ChevronsUpDown data-icon="inline-start" /> : <ChevronsDownUp data-icon="inline-start" />}
          {allCollapsed ? t("actions.expandAll") : t("actions.collapseAll")}
        </Button>
      </div>
    ) : null;
  const toolbar = (
    <SettingsToolbar
      state={{
        search,
        limit,
        orderBy,
        limitOptions: PAGE_LIMIT_OPTIONS,
        orderOptions: [
          { label: labels.sortAsc, value: "ASC" },
          { label: labels.sortDesc, value: "DESC" }
        ],
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
  );

  return (
    <>
      <SettingsModuleShell
        addLabel={addLabel}
        cardTitle={labels.list}
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
        loading={loading}
        loadingLabel={t("settings.loading", { title })}
        mobileList={mobileList}
        summary={`${t("common.showingRange", { start: pageStart, end: pageEnd, total })} - ${t("common.page", { current: page, total: totalPages })}`}
        table={table}
        title={title}
        toolbarStart={groupToggleAction}
        toolbar={toolbar}
        onAdd={canManage ? openCreate : undefined}
      />
      {canManage ? (
        <>
          <LocationFormDialog
            description={description}
            editing={editing}
            kind={kind}
            labels={labels}
            open={dialogOpen}
            provinceLoading={provinceLoading}
            provinces={provinceRows}
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
      ) : null}
    </>
  );
}

function LocationFormDialog({
  description,
  editing,
  kind,
  labels,
  onOpenChange,
  onSubmit,
  open,
  provinceLoading,
  provinces,
  saving,
  title
}: {
  description: string;
  editing: Row | null;
  kind: LocationKind;
  labels: LocationLabels;
  onOpenChange: (open: boolean) => void;
  onSubmit: (formData: FormData) => Promise<void>;
  open: boolean;
  provinceLoading: boolean;
  provinces: Row[];
  saving: boolean;
  title: string;
}) {
  const { t } = useTranslation();
  const [provinceUuid, setProvinceUuid] = useState("");

  useEffect(() => {
    setProvinceUuid(value(editing, "province_uuid_fk"));
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
                <FieldLabel>{labels.formHint}</FieldLabel>
                <FieldDescription>{kind === "district" ? labels.selectProvince : title}</FieldDescription>
              </Field>
              {kind === "district" ? (
                <Field>
                  <FieldLabel htmlFor="province_uuid_fk">{labels.province}</FieldLabel>
                  <ProvinceCombobox
                    id="province_uuid_fk"
                    loading={provinceLoading}
                    provinces={provinces}
                    value={provinceUuid}
                    onValueChange={setProvinceUuid}
                  />
                </Field>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor={`${kind}_name_la`}>{t("fields.nameLa")}</FieldLabel>
                  <Input
                    id={`${kind}_name_la`}
                    name={`${kind}_name_la`}
                    defaultValue={value(editing, `${kind}_name_la`, value(editing, `${kind}_name`))}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`${kind}_name_eng`}>{t("fields.nameEn")}</FieldLabel>
                  <Input id={`${kind}_name_eng`} name={`${kind}_name_eng`} defaultValue={value(editing, `${kind}_name_eng`)} />
                </Field>
              </div>
            </FieldGroup>
          </SettingsDialogBody>
          <SettingsDialogFooter>
            <Button disabled={saving} type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("actions.cancel")}
            </Button>
            <Button disabled={saving || (kind === "district" && !provinceUuid)} type="submit">
              {saving ? <Spinner data-icon="inline-start" /> : null}
              {saving ? t("common.processing") : t("actions.save")}
            </Button>
          </SettingsDialogFooter>
        </SettingsDialogForm>
      </SettingsDialogContent>
    </Dialog>
  );
}
