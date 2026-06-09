"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import {
  SettingsModuleShell,
  SettingsPaginationFooter,
  SettingsToolbar
} from "@/features/settings/shared/settings-shell";
import { LocationFormDialog } from "./location-form-dialog";
import { LocationListSurface } from "./location-list";
import type { LocationLabels, LocationSettingsRow as Row } from "./location-types";
import {
  buildDistrictPayload,
  buildNumberedDistrictGroups,
  buildProvincePayload,
  groupDistrictRows,
  locationId,
  locationValue,
  missingDistrictField,
  missingProvinceField,
  type LocationKind
} from "@/features/settings/location/location-utils";
import { useUrlPagination } from "@/hooks/use-url-pagination";
import { DEFAULT_PAGE_LIMIT, PAGE_LIMIT_OPTIONS } from "@/lib/pagination";
import { canManageLocationSettings } from "@/lib/permissions";
import type { UrlPaginationState } from "@/lib/url-pagination";
import type { PageLimit, SortOrder } from "@/services/shared/types";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { useDistrictStore } from "@/stores/district-store";
import { useProvinceStore } from "@/stores/province-store";
import { useToastStore } from "@/stores/toast-store";

const LOCATION_CONFIG = {
  province: {
    slug: "province"
  },
  district: {
    slug: "district"
  }
} as const;

const DEFAULT_LIMIT: PageLimit = DEFAULT_PAGE_LIMIT;

export function LocationSettingsPage({ initialPagination, kind }: { initialPagination: UrlPaginationState; kind: LocationKind }) {
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
  const { changeLimit, limit, page, resetPage, setPage } = useUrlPagination({ initialPagination });
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

  function toggleProvinceCollapse(provinceId: string) {
    setCollapsedProvinces((current) => {
      const next = new Set(current);
      if (next.has(provinceId)) next.delete(provinceId);
      else next.add(provinceId);
      return next;
    });
  }

  function toggleAllGroups() {
    setCollapsedProvinces(allCollapsed ? new Set() : new Set(groupedDistricts.map((group) => group.provinceId)));
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

  const addLabel = `${t("actions.add")} ${kind === "province" ? labels.province : labels.district}`;
  const listTitle = kind === "province" ? t("settings.provinceList") : t("settings.districtList");
  const refreshLabel = kind === "province" ? t("settings.refreshingProvinceList") : t("settings.refreshingDistrictList");
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
    <LocationListSurface
      allCollapsed={allCollapsed}
      allSelected={allSelected}
      backgroundLoading={backgroundLoading}
      canManage={canManage}
      collapsedProvinces={collapsedProvinces}
      districtGroups={numberedDistrictGroups}
      kind={kind}
      labels={labels}
      listTitle={listTitle}
      page={page}
      pageEnd={pageEnd}
      pageStart={pageStart}
      provinceById={provinceById}
      refreshLabel={refreshLabel}
      rows={rows}
      selectedRows={selectedRows}
      title={title}
      toolbar={toolbar}
      total={total}
      totalPages={totalPages}
      onDelete={setDeleteTarget}
      onEdit={openEdit}
      onToggleAll={toggleAll}
      onToggleAllGroups={toggleAllGroups}
      onToggleProvinceCollapse={toggleProvinceCollapse}
      onToggleSelected={toggleSelected}
    />
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
