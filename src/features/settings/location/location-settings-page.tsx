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
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
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
import {
  buildDistrictPayload,
  buildNumberedDistrictGroups,
  buildProvincePayload,
  groupDistrictRows,
  locationId,
  locationName,
  locationValue,
  missingDistrictField,
  missingProvinceField,
  provinceLabel,
  type LocationKind,
  type LocationRow
} from "@/features/settings/location/location-utils";
import { useDropdownButtonLoading } from "@/hooks/use-dropdown-button-loading";
import { DEFAULT_PAGE_LIMIT, PAGE_LIMIT_OPTIONS } from "@/lib/pagination";
import { canManageLocationSettings } from "@/lib/permissions";
import type { PageLimit, SortOrder } from "@/services/shared/types";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { useDistrictStore } from "@/stores/district-store";
import { useProvinceStore } from "@/stores/province-store";
import { useToastStore } from "@/stores/toast-store";

type Row = LocationRow;

interface LocationLabels {
  district: string;
  no: string;
  province: string;
  sortAsc: string;
  sortDesc: string;
}

const LOCATION_CONFIG = {
  province: {
    slug: "province"
  },
  district: {
    slug: "district"
  }
} as const;

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT: PageLimit = DEFAULT_PAGE_LIMIT;

function LocationIcon({ kind }: { kind: LocationKind }) {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
      {kind === "province" ? <MapPin aria-hidden /> : <MapPinned aria-hidden />}
    </span>
  );
}

function ProvinceCombobox({
  disabled = false,
  id,
  loading = false,
  onValueChange,
  provinces,
  value: selectedValue
}: {
  disabled?: boolean;
  id: string;
  loading?: boolean;
  onValueChange: (value: string) => void;
  provinces: Row[];
  value: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const options = useMemo(() => {
    const selectedExists = provinces.some((province) => locationValue(province, "province_uuid") === selectedValue);
    const list = provinces.map((province) => {
      const uuid = locationValue(province, "province_uuid");
      const label = provinceLabel(province);
      const laoName = locationValue(province, "province_name_la");
      const englishName = locationValue(province, "province_name_eng");
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
      <input name="province_uuid_fk" readOnly type="hidden" value={selectedValue} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-busy={dropdownLoading}
            className="w-full justify-between"
            disabled={disabled}
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
  const provinceHasLoaded = useProvinceStore((state) => state.hasLoaded);
  const provinceLoading = useProvinceStore((state) => state.loading);
  const provinceRefreshing = useProvinceStore((state) => state.refreshing);
  const provinceSaving = useProvinceStore((state) => state.saving);
  const setProvinceSearch = useProvinceStore((state) => state.setSearch);
  const loadProvinces = useProvinceStore((state) => state.load);
  const saveProvince = useProvinceStore((state) => state.save);
  const removeProvince = useProvinceStore((state) => state.remove);
  const districtRows = useDistrictStore((state) => state.rows) as Row[];
  const districtTotal = useDistrictStore((state) => state.total);
  const districtTotalPages = useDistrictStore((state) => state.totalPages);
  const districtSearch = useDistrictStore((state) => state.search);
  const districtHasLoaded = useDistrictStore((state) => state.hasLoaded);
  const districtLoading = useDistrictStore((state) => state.loading);
  const districtRefreshing = useDistrictStore((state) => state.refreshing);
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
  const hasLoaded = kind === "province" ? provinceHasLoaded : districtHasLoaded;
  const loading = kind === "province" ? provinceLoading : districtLoading;
  const refreshing = kind === "province" ? provinceRefreshing : districtRefreshing;
  const saving = kind === "province" ? provinceSaving : districtSaving;
  const setSearch = kind === "province" ? setProvinceSearch : setDistrictSearch;
  const total = kind === "province" ? provinceTotal : districtTotal;
  const storeTotalPages = kind === "province" ? provinceTotalPages : districtTotalPages;
  const canManage = canManageLocationSettings(user?.status);
  const title = t(`settings.modules.${config.slug}.title`);
  const description = t(`settings.modules.${config.slug}.description`);
  const labels: LocationLabels = {
    district: t("nav.district"),
    no: t("fields.no"),
    province: t("nav.province"),
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
  const fullLoading = loading && !hasLoaded;
  const backgroundLoading = refreshing || (loading && hasLoaded);
  const pagingBusy = loading || refreshing;
  const canGoBack = page > 1 && !pagingBusy;
  const canGoNext = page < totalPages && !pagingBusy;
  const ids = useMemo(() => rows.map((row) => locationId(row, kind)).filter(Boolean), [kind, rows]);
  const allSelected = ids.length > 0 && ids.every((id) => selectedRows.has(id));
  const provinceById = useMemo(() => {
    const map = new Map<string, Row>();
    provinceRows.forEach((province) => {
      const id = locationValue(province, "province_uuid");
      if (id) map.set(id, province);
    });
    return map;
  }, [provinceRows]);
  const groupedDistricts = useMemo(() => {
    if (kind !== "district") return [];
    return groupDistrictRows(rows, provinceById);
  }, [kind, provinceById, rows]);
  const numberedDistrictGroups = useMemo(
    () => buildNumberedDistrictGroups(groupedDistricts, pageStart),
    [groupedDistricts, pageStart]
  );
  const allCollapsed =
    kind === "district" &&
    groupedDistricts.length > 0 &&
    groupedDistricts.every((group) => collapsedProvinces.has(group.provinceId));
  const tableColumnCount = 3 + (kind === "district" ? 1 : 0) + (canManage ? 1 : 0);

  async function load(background = hasLoaded) {
    try {
      if (kind === "province") await loadProvinces(requestParams, { background });
      else await loadDistricts(requestParams, { background });
    } catch (error) {
      showToast({
        title: t("settings.loadFailed", { title }),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    }
  }

  useEffect(() => {
    void load(hasLoaded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.slug, language, page, limit, orderBy]);

  useEffect(() => {
    if (kind !== "district") return;
    void loadProvinces({ search: "", page: 1, limit: "All", orderBy: "ASC", lang: language }, { background: provinceHasLoaded });
  }, [kind, language, loadProvinces, provinceHasLoaded]);

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
    if (page === 1) void load(hasLoaded);
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

  function missingFieldDescription(field: ReturnType<typeof missingDistrictField> | ReturnType<typeof missingProvinceField>) {
    if (field === "province") return t("settings.districtProvinceRequired");
    if (field === "name") return kind === "province" ? t("settings.provinceNameRequired") : t("settings.districtNameRequired");
    return t("toasts.pleaseTryAgain");
  }

  async function save(formData: FormData) {
    if (!canManage) return;
    const nameLa = String(formData.get(`${kind}_name_la`) ?? "").trim();
    const nameEng = String(formData.get(`${kind}_name_eng`) ?? "").trim();
    const provinceUuid = String(formData.get("province_uuid_fk") ?? "").trim();

    if (kind === "province") {
      const missing = missingProvinceField({ nameLa });
      if (missing) {
        showToast({ title: t("settings.saveFailed"), description: missingFieldDescription(missing), tone: "error" });
        return;
      }
    } else {
      const missing = missingDistrictField({ nameLa, provinceUuid });
      if (missing) {
        showToast({ title: t("settings.saveFailed"), description: missingFieldDescription(missing), tone: "error" });
        return;
      }
    }

    try {
      if (kind === "province") await saveProvince(buildProvincePayload({ editing, nameEng, nameLa }));
      else await saveDistrict(buildDistrictPayload({ editing, nameEng, nameLa, provinceUuid }));
      showToast({ title: t("settings.saved"), tone: "success" });
      setDialogOpen(false);
      setEditing(null);
      if (kind === "province") await loadProvinces(requestParams, { background: true });
      else await loadDistricts(requestParams, { background: true });
    } catch (error) {
      showToast({
        title: t("settings.saveFailed"),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    }
  }

  async function remove(row: Row) {
    const id = locationId(row, kind);
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
      if (kind === "province") await loadProvinces(requestParams, { background: true });
      else await loadDistricts(requestParams, { background: true });
    } catch (error) {
      showToast({
        title: t("settings.deleteFailed"),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    }
  }

  function renderLocationRow(row: Row, rowNumber: number) {
    const id = locationId(row, kind);
    const name = locationName(row, kind);
    const selected = selectedRows.has(id);
    const relatedProvince = provinceById.get(locationValue(row, "province_uuid_fk"));
    const laoName = locationValue(row, `${kind}_name_la`, "-");
    const englishName = locationValue(row, `${kind}_name_eng`, "-");

    return (
      <TableRow key={id || rowNumber} className="h-14" data-state={selected ? "selected" : undefined}>
        <TableCell className="w-10 px-2">
          <Checkbox
            aria-label={t("common.selectRow", { name })}
            checked={selected}
            onChange={(event) => toggleSelected(id, event.target.checked)}
          />
        </TableCell>
        <TableCell className="w-px whitespace-nowrap px-2 text-center text-sm font-black tabular-nums text-muted-foreground">{rowNumber}</TableCell>
        <TableCell className="max-w-[30rem]">
          <div className="flex min-w-0 items-center gap-3">
            <LocationIcon kind={kind} />
            <div className="min-w-0">
              <p className="truncate font-black">{name}</p>
              {kind === "district" ? <p className="truncate text-xs text-muted-foreground">{laoName} / {englishName}</p> : null}
              {id ? (
                <p className="mt-0.5 truncate text-xs text-muted-foreground" translate="no">
                  {id}
                </p>
              ) : null}
            </div>
          </div>
        </TableCell>
        {kind === "province" ? (
          <>
            <TableCell className="max-w-[18rem] text-muted-foreground">
              <span className="block truncate">{laoName}</span>
            </TableCell>
            <TableCell className="max-w-[18rem] text-muted-foreground">
              <span className="block truncate">{englishName}</span>
            </TableCell>
          </>
        ) : (
          <TableCell className="max-w-[18rem] text-muted-foreground">
            <span className="block truncate">{relatedProvince ? provinceLabel(relatedProvince) : provinceLabel(row)}</span>
          </TableCell>
        )}
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
      <Table className={kind === "province" ? "min-w-[860px]" : "min-w-[940px]"}>
        <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
          <TableRow>
            <TableHead className="w-10 px-2">
              <Checkbox aria-label={t("common.selectAll")} checked={allSelected} onChange={(event) => toggleAll(event.target.checked)} />
            </TableHead>
            <TableHead className="w-px whitespace-nowrap px-2 text-center">{labels.no}</TableHead>
            <TableHead>{kind === "province" ? labels.province : labels.district}</TableHead>
            {kind === "province" ? (
              <>
                <TableHead>{t("fields.province_name_la")}</TableHead>
                <TableHead>{t("fields.province_name_eng")}</TableHead>
              </>
            ) : (
              <TableHead>{labels.province}</TableHead>
            )}
            {canManage ? <TableHead className="w-16 text-right">{t("common.actions")}</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {kind === "district"
            ? numberedDistrictGroups.map((group) => {
                const collapsed = collapsedProvinces.has(group.provinceId);
                return (
                  <Fragment key={group.provinceId}>
                    <TableRow className="bg-muted/40 hover:bg-muted/60">
                      <TableCell colSpan={tableColumnCount} className="px-2 py-0">
                        <Button
                          aria-expanded={!collapsed}
                          aria-label={collapsed ? t("settings.expandProvince", { province: group.provinceName }) : t("settings.collapseProvince", { province: group.provinceName })}
                          type="button"
                          variant="ghost"
                          className="h-auto w-full justify-start px-2 py-2 text-left font-bold"
                          onClick={() => toggleProvinceCollapse(group.provinceId)}
                        >
                          {collapsed ? <ChevronRight data-icon="inline-start" /> : <ChevronDown data-icon="inline-start" />}
                          <MapPin data-icon="inline-start" />
                          <span className="min-w-0 flex-1 truncate">{group.provinceName}</span>
                          <Badge className="bg-primary/10 text-primary tabular-nums">{group.districts.length}</Badge>
                        </Button>
                      </TableCell>
                    </TableRow>
                    {collapsed ? null : group.districts.length ? (
                      group.districts.map(({ row, rowNumber }) => renderLocationRow(row, rowNumber))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={tableColumnCount} className="h-16 text-center text-sm text-muted-foreground">
                          {t("settings.emptyProvinceDistricts")}
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })
            : rows.map((row, index) => renderLocationRow(row, pageStart + index))}
        </TableBody>
      </Table>
    </SettingsTableScroll>
  ) : null;
  function renderLocationMobileCard(row: Row, rowNumber: number) {
    const id = locationId(row, kind);
    const name = locationName(row, kind);
    const selected = selectedRows.has(id);
    const relatedProvince = provinceById.get(locationValue(row, "province_uuid_fk"));

    return (
      <SettingsMobileCard
        key={id || rowNumber}
        actions={canManage ? <SettingsRowActions row={row} onEdit={openEdit} onDelete={setDeleteTarget} /> : undefined}
        badges={<Badge className="shrink-0 tabular-nums">{rowNumber}</Badge>}
        checked={selected}
        leading={<LocationIcon kind={kind} />}
        selectLabel={t("common.selectRow", { name })}
        selected={selected}
        subtitle={
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="block truncate">
              {locationValue(row, `${kind}_name_la`, "-")} / {locationValue(row, `${kind}_name_eng`, "-")}
            </span>
            {id ? (
              <span className="block truncate" translate="no">
                {id}
              </span>
            ) : null}
          </span>
        }
        title={name}
        onCheckedChange={(checked) => toggleSelected(id, checked)}
      >
        {kind === "district" ? (
          <SettingsMobileMetaGrid>
            <SettingsMobileMeta label={labels.province} value={relatedProvince ? provinceLabel(relatedProvince) : provinceLabel(row)} />
          </SettingsMobileMetaGrid>
        ) : null}
      </SettingsMobileCard>
    );
  }
  const mobileList = rows.length ? (
    <SettingsMobileList>
      {kind === "district"
        ? numberedDistrictGroups.map((group) => {
            const collapsed = collapsedProvinces.has(group.provinceId);
            return (
              <div key={group.provinceId} className="flex flex-col gap-2">
                <Button
                  aria-expanded={!collapsed}
                  aria-label={collapsed ? t("settings.expandProvince", { province: group.provinceName }) : t("settings.collapseProvince", { province: group.provinceName })}
                  type="button"
                  variant="outline"
                  className="min-h-11 justify-start px-3 text-left"
                  onClick={() => toggleProvinceCollapse(group.provinceId)}
                >
                  {collapsed ? <ChevronRight data-icon="inline-start" /> : <ChevronDown data-icon="inline-start" />}
                  <MapPin data-icon="inline-start" />
                  <span className="min-w-0 flex-1 truncate">{group.provinceName}</span>
                  <Badge className="bg-primary/10 text-primary tabular-nums">{group.districts.length}</Badge>
                </Button>
                {collapsed ? null : group.districts.length ? (
                  group.districts.map(({ row, rowNumber }) => renderLocationMobileCard(row, rowNumber))
                ) : (
                  <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                    {t("settings.emptyProvinceDistricts")}
                  </div>
                )}
              </div>
            );
          })
        : rows.map((row, index) => renderLocationMobileCard(row, pageStart + index))}
    </SettingsMobileList>
  ) : null;
  const addLabel = `${t("actions.add")} ${kind === "province" ? labels.province : labels.district}`;
  const listTitle = kind === "province" ? t("settings.provinceList") : t("settings.districtList");
  const refreshLabel = kind === "province" ? t("settings.refreshingProvinceList") : t("settings.refreshingDistrictList");
  const groupToggleAction =
    kind === "district" && groupedDistricts.length > 0 ? (
      <Button
        size="xs"
        type="button"
        variant="outline"
        onClick={() => setCollapsedProvinces(allCollapsed ? new Set() : new Set(groupedDistricts.map((group) => group.provinceId)))}
      >
        {allCollapsed ? <ChevronsUpDown data-icon="inline-start" /> : <ChevronsDownUp data-icon="inline-start" />}
        {allCollapsed ? t("actions.expandAll") : t("actions.collapseAll")}
      </Button>
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
  const listSurface = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-border bg-card/95 px-3 py-2.5 backdrop-blur sm:px-4 lg:px-5">
        <div className="flex min-w-0 flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <p className="text-sm font-black">{listTitle}</p>
              {groupToggleAction}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("common.showingRange", { start: pageStart, end: pageEnd, total })} - {t("common.page", { current: page, total: totalPages })}
            </p>
          </div>
          <div className="min-w-0 xl:max-w-[48rem]">{toolbar}</div>
        </div>
        {backgroundLoading ? (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Spinner aria-hidden />
            {refreshLabel}
          </div>
        ) : null}
      </div>
      {rows.length ? (
        <>
          <div className="hidden min-h-0 flex-1 md:flex">{table}</div>
          <div className="min-h-0 flex-1 overflow-y-auto md:hidden">{mobileList}</div>
        </>
      ) : (
        <div className="flex min-h-72 flex-1 items-center justify-center p-4">
          <Empty className="max-w-md border border-dashed bg-muted/20">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                {kind === "province" ? <MapPin aria-hidden /> : <MapPinned aria-hidden />}
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
        addLabel={addLabel}
        cardTitle={listTitle}
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
        table={listSurface}
        title={title}
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
  const [nameLa, setNameLa] = useState("");
  const [nameEng, setNameEng] = useState("");
  const formKey = locationId(editing, kind) || `new-${kind}`;
  const detailsTitle = kind === "province" ? t("settings.provinceDetails") : t("settings.districtDetails");
  const detailsHint = kind === "province" ? t("settings.provinceDetailsHint") : t("settings.districtDetailsHint");
  const formHint = kind === "province" ? t("settings.provinceFormHint") : t("settings.districtFormHint");
  const saveDisabled = saving || !nameLa.trim() || (kind === "district" && !provinceUuid.trim());

  useEffect(() => {
    setProvinceUuid(locationValue(editing, "province_uuid_fk"));
    setNameLa(locationValue(editing, `${kind}_name_la`, locationValue(editing, `${kind}_name`)));
    setNameEng(locationValue(editing, `${kind}_name_eng`));
  }, [editing, kind, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SettingsDialogContent className="sm:max-w-2xl">
        <SettingsDialogForm key={formKey} action={onSubmit}>
          <SettingsDialogHeader>
            <DialogTitle>{editing ? t("settings.editRecord") : t("settings.newRecord")}: {title}</DialogTitle>
            <DialogDescription>{formHint || description}</DialogDescription>
          </SettingsDialogHeader>
          <SettingsDialogBody>
            <FieldGroup>
              <FieldSet className="gap-4 rounded-lg border border-border bg-card p-4">
                <Field>
                  <FieldLegend>{detailsTitle}</FieldLegend>
                  <FieldDescription>{detailsHint}</FieldDescription>
                </Field>
                <FieldGroup className="grid gap-3 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor={`${kind}_name_la`}>{t("fields.nameLa")}</FieldLabel>
                    <Input
                      autoComplete="off"
                      id={`${kind}_name_la`}
                      name={`${kind}_name_la`}
                      required
                      value={nameLa}
                      onChange={(event) => setNameLa(event.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`${kind}_name_eng`}>{t("fields.nameEn")}</FieldLabel>
                    <Input
                      autoComplete="off"
                      id={`${kind}_name_eng`}
                      name={`${kind}_name_eng`}
                      value={nameEng}
                      onChange={(event) => setNameEng(event.target.value)}
                    />
                  </Field>
                </FieldGroup>
              </FieldSet>
              {kind === "district" ? (
                <FieldSet className="gap-4 rounded-lg border border-border bg-card p-4">
                  <Field>
                    <FieldLegend>{t("settings.districtProvinceSection")}</FieldLegend>
                    <FieldDescription>{t("settings.districtProvinceHint")}</FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="province_uuid_fk">{labels.province}</FieldLabel>
                    <ProvinceCombobox
                      disabled={saving}
                      id="province_uuid_fk"
                      loading={provinceLoading}
                      provinces={provinces}
                      value={provinceUuid}
                      onValueChange={setProvinceUuid}
                    />
                  </Field>
                </FieldSet>
              ) : null}
            </FieldGroup>
          </SettingsDialogBody>
          <SettingsDialogFooter>
            <Button disabled={saving} type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("actions.cancel")}
            </Button>
            <Button disabled={saveDisabled} type="submit">
              {saving ? <Spinner data-icon="inline-start" /> : null}
              {saving ? t("common.processing") : t("actions.save")}
            </Button>
          </SettingsDialogFooter>
        </SettingsDialogForm>
      </SettingsDialogContent>
    </Dialog>
  );
}
