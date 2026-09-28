"use client";

import { useEffect, useMemo, useState } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import { SettingsListPageLayout } from "@/features/settings/shared/settings-list-page-layout";
import { SettingsEmptyRecords } from "@/features/settings/shared/settings-shell";
import { useSettingsCrudController } from "@/features/settings/shared/use-settings-crud-controller";
import { LocationFormDialog } from "./location-form-dialog";
import { DistrictMobileList, DistrictTable, LOCATION_ICONS, ProvinceMobileList, ProvinceTable } from "./location-list";
import type { LocationLabels, LocationSettingsRow } from "./location-types";
import {
  buildDistrictPayload,
  buildNumberedDistrictGroups,
  buildProvincePayload,
  groupDistrictRows,
  locationValue,
  missingDistrictField,
  missingProvinceField,
  type LocationKind
} from "@/features/settings/location/location-utils";
import { canManageLocationSettings } from "@/lib/permissions";
import type { UrlPaginationState } from "@/lib/url-pagination";
import type { District, FetchDistrictsParams, SaveDistrictInput } from "@/services/district";
import type { FetchProvincesParams, Province, SaveProvinceInput } from "@/services/province";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { useDistrictStore } from "@/stores/district-store";
import { useProvinceStore } from "@/stores/province-store";

// จังหวัด/อำเภอเป็นสโตร์คนละตัว (useProvinceStore / useDistrictStore) — kind ผูกกับเราท์ (province/
// district) จึงคงที่ตลอดอายุของอินสแตนซ์ที่ mount แต่ละครั้ง ทำให้แยกเป็น 2 คอมโพเนนต์ย่อยที่ผูก
// useSettingsCrudController กับสโตร์เดียวคนละตัวได้อย่างปลอดภัย (ไม่มี rules-of-hooks หรือชนิดข้ามกัน)
// แทนที่จะพยายามรวมเป็น instance เดียวซึ่งต้อง cast ชนิดแบบไม่ปลอดภัย หรือทำให้ทั้งสอง entity โดน
// fetch พร้อมกันทุกครั้ง (useEffect โหลดอัตโนมัติในตัว hook ไม่มีทางปิดสำหรับฝั่งที่ไม่ได้ใช้งาน)
export function LocationSettingsPage({ initialPagination, kind }: { initialPagination: UrlPaginationState; kind: LocationKind }) {
  if (kind === "district") return <DistrictSettingsPage initialPagination={initialPagination} />;
  return <ProvinceSettingsPage initialPagination={initialPagination} />;
}

function buildLocationLabels(t: TFunction): LocationLabels {
  return {
    district: t("nav.district"),
    no: t("fields.no"),
    province: t("nav.province"),
    sortAsc: t("common.oldestFirst"),
    sortDesc: t("common.newestFirst")
  };
}

// หน้าจังหวัดไม่มีรายชื่อจังหวัดให้เลือกในฟอร์ม — ค่าคงที่ว่างกันสร้าง array ใหม่ทุก render
const EMPTY_PROVINCES: LocationSettingsRow[] = [];

function ProvinceSettingsPage({ initialPagination }: { initialPagination: UrlPaginationState }) {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const canManage = canManageLocationSettings(user?.status);
  const title = t("settings.modules.province.title");
  const description = t("settings.modules.province.description");
  const labels = buildLocationLabels(t);
  const {
    allSelected,
    applyFilters,
    backgroundLoading,
    changeLimit,
    deleteTarget,
    dialogOpen,
    editing,
    fullLoading,
    limit,
    onDialogOpenChange,
    openCreate: controllerOpenCreate,
    openEdit: controllerOpenEdit,
    orderBy,
    page,
    pageEnd,
    pageStart,
    remove: crudRemove,
    rows,
    save: crudSave,
    saving,
    search,
    selectedRows,
    setDeleteTarget,
    setOrderBy,
    setPage,
    setSearch,
    toggleAll,
    toggleSelected,
    total,
    totalPages
  } = useSettingsCrudController<Province, SaveProvinceInput, FetchProvincesParams>({
    buildInput: ({ editing: editingRow, formData }) =>
      buildProvincePayload({
        editing: editingRow,
        nameEng: String(formData.get("province_name_eng") ?? "").trim(),
        nameLa: String(formData.get("province_name_la") ?? "").trim()
      }),
    idKey: "province_uuid",
    initialPagination,
    store: useProvinceStore,
    title,
    validateInput: ({ formData }) => {
      const missing = missingProvinceField({ nameLa: String(formData.get("province_name_la") ?? "").trim() });
      return missing ? t("settings.provinceNameRequired") : null;
    }
  });

  // แถวในหน้านี้เป็น Province เสมอ (ผูกกับ useProvinceStore ตัวเดียว) แต่ LocationListSurface ใช้ชนิด
  // กลาง LocationSettingsRow (ApiEntity) ร่วมกับหน้าอำเภอ จึงต้องตีบชนิดตรงจุดที่ส่ง callback เข้าไป
  function handleEdit(row: LocationSettingsRow) {
    if (!canManage) return;
    controllerOpenEdit(row as Province);
  }

  function handleDeleteTarget(row: LocationSettingsRow) {
    setDeleteTarget(row as Province);
  }

  function openCreate() {
    if (!canManage) return;
    controllerOpenCreate();
  }

  async function save(formData: FormData) {
    if (!canManage) return;
    await crudSave(formData);
  }

  async function remove(row: Province) {
    if (!canManage) return;
    await crudRemove(row);
  }

  const handlers = { canManage, selectedRows, onDelete: handleDeleteTarget, onEdit: handleEdit, onToggleSelected: toggleSelected };

  return (
    <SettingsListPageLayout
      id="province"
      title={title}
      description={description}
      icon={LOCATION_ICONS.province}
      addLabel={`${t("actions.add")} ${labels.province}`}
      onAdd={canManage ? openCreate : undefined}
      loading={fullLoading}
      loadingLabel={t("settings.loading", { title })}
      search={search}
      searching={backgroundLoading}
      searchingLabel={t("settings.refreshingProvinceList")}
      onSearchChange={setSearch}
      onSearchApply={applyFilters}
      orderBy={orderBy}
      onOrderChange={(nextOrder) => {
        setOrderBy(nextOrder);
        setPage(1);
      }}
      allSelected={allSelected}
      selectAllLabel={t("common.selectAll")}
      selectedCount={selectedRows.size}
      onToggleAll={toggleAll}
      hasRows={rows.length > 0}
      table={<ProvinceTable {...handlers} allSelected={allSelected} pageStart={pageStart} rows={rows} onToggleAll={toggleAll} />}
      mobileList={<ProvinceMobileList {...handlers} rows={rows} />}
      empty={<SettingsEmptyRecords icon={<LOCATION_ICONS.province aria-hidden />} title={title.toLowerCase()} />}
      page={page}
      pageStart={pageStart}
      pageEnd={pageEnd}
      total={total}
      totalPages={totalPages}
      limit={limit}
      onLimitChange={changeLimit}
      onPageChange={setPage}
    >
      {canManage ? (
        <>
          <LocationFormDialog
            description={description}
            editing={editing}
            kind="province"
            labels={labels}
            open={dialogOpen}
            provinceLoading={false}
            provinces={EMPTY_PROVINCES}
            saving={saving}
            title={title}
            onOpenChange={onDialogOpenChange}
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
    </SettingsListPageLayout>
  );
}

function DistrictSettingsPage({ initialPagination }: { initialPagination: UrlPaginationState }) {
  const { t } = useTranslation();
  const language = useAppStore((state) => state.language);
  const user = useAuthStore((state) => state.user);
  const canManage = canManageLocationSettings(user?.status);
  // รายชื่อจังหวัดทั้งหมดไว้ผูกดรอปดาวน์/แสดงชื่อจังหวัดของแต่ละอำเภอ เป็นข้อมูลอ้างอิงข้าม entity
  // เหมือน zone options ของ table-page — โหลดตรงจาก useProvinceStore ไม่ผ่าน controller
  const provinceRows = useProvinceStore((state) => state.rows);
  const provinceHasLoaded = useProvinceStore((state) => state.hasLoaded);
  const provinceOptionsLoading = useProvinceStore((state) => state.loading);
  const loadProvinceOptions = useProvinceStore((state) => state.load);
  const [collapsedProvinces, setCollapsedProvinces] = useState<Set<string>>(() => new Set());

  const title = t("settings.modules.district.title");
  const description = t("settings.modules.district.description");
  const labels = buildLocationLabels(t);
  const {
    allSelected,
    applyFilters,
    backgroundLoading,
    changeLimit,
    deleteTarget,
    dialogOpen,
    editing,
    fullLoading,
    limit,
    onDialogOpenChange,
    openCreate: controllerOpenCreate,
    openEdit: controllerOpenEdit,
    orderBy,
    page,
    pageEnd,
    pageStart,
    remove: crudRemove,
    rows,
    save: crudSave,
    saving,
    search,
    selectedRows,
    setDeleteTarget,
    setOrderBy,
    setPage,
    setSearch,
    toggleAll,
    toggleSelected,
    total,
    totalPages
  } = useSettingsCrudController<District, SaveDistrictInput, FetchDistrictsParams>({
    buildInput: ({ editing: editingRow, formData }) =>
      buildDistrictPayload({
        editing: editingRow,
        nameEng: String(formData.get("district_name_eng") ?? "").trim(),
        nameLa: String(formData.get("district_name_la") ?? "").trim(),
        provinceUuid: String(formData.get("province_uuid_fk") ?? "").trim()
      }),
    idKey: "district_uuid",
    initialPagination,
    store: useDistrictStore,
    title,
    validateInput: ({ formData }) => {
      const missing = missingDistrictField({
        nameLa: String(formData.get("district_name_la") ?? "").trim(),
        provinceUuid: String(formData.get("province_uuid_fk") ?? "").trim()
      });
      if (missing === "province") return t("settings.districtProvinceRequired");
      if (missing === "name") return t("settings.districtNameRequired");
      return null;
    }
  });

  const provinceById = useMemo(() => {
    const map = new Map<string, LocationSettingsRow>();
    provinceRows.forEach((province) => {
      const id = locationValue(province, "province_uuid");
      if (id) map.set(id, province);
    });
    return map;
  }, [provinceRows]);
  const groupedDistricts = useMemo(() => groupDistrictRows(rows, provinceById), [provinceById, rows]);
  const numberedDistrictGroups = useMemo(
    () => buildNumberedDistrictGroups(groupedDistricts, pageStart),
    [groupedDistricts, pageStart]
  );
  const allCollapsed =
    groupedDistricts.length > 0 && groupedDistricts.every((group) => collapsedProvinces.has(group.provinceId));

  useEffect(() => {
    void loadProvinceOptions(
      { search: "", page: 1, limit: "All", orderBy: "ASC", lang: language },
      { background: provinceHasLoaded }
    );
  }, [language, loadProvinceOptions, provinceHasLoaded]);

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

  // แถวในหน้านี้เป็น District เสมอ (ผูกกับ useDistrictStore ตัวเดียว) แต่ LocationListSurface ใช้ชนิด
  // กลาง LocationSettingsRow (ApiEntity) ร่วมกับหน้าจังหวัด จึงต้องตีบชนิดตรงจุดที่ส่ง callback เข้าไป
  function handleEdit(row: LocationSettingsRow) {
    if (!canManage) return;
    controllerOpenEdit(row as District);
  }

  function handleDeleteTarget(row: LocationSettingsRow) {
    setDeleteTarget(row as District);
  }

  function openCreate() {
    if (!canManage) return;
    controllerOpenCreate();
  }

  async function save(formData: FormData) {
    if (!canManage) return;
    await crudSave(formData);
  }

  async function remove(row: District) {
    if (!canManage) return;
    await crudRemove(row);
  }

  const handlers = { canManage, selectedRows, onDelete: handleDeleteTarget, onEdit: handleEdit, onToggleSelected: toggleSelected };
  const groupProps = {
    collapsedProvinces,
    groups: numberedDistrictGroups,
    onToggleProvinceCollapse: toggleProvinceCollapse
  };

  return (
    <SettingsListPageLayout
      id="district"
      title={title}
      description={description}
      icon={LOCATION_ICONS.district}
      addLabel={`${t("actions.add")} ${labels.district}`}
      onAdd={canManage ? openCreate : undefined}
      loading={fullLoading}
      loadingLabel={t("settings.loading", { title })}
      search={search}
      searching={backgroundLoading}
      searchingLabel={t("settings.refreshingDistrictList")}
      onSearchChange={setSearch}
      onSearchApply={applyFilters}
      orderBy={orderBy}
      onOrderChange={(nextOrder) => {
        setOrderBy(nextOrder);
        setPage(1);
      }}
      toolbarExtra={
        groupedDistricts.length ? (
          <Button type="button" variant="outline" onClick={toggleAllGroups}>
            {allCollapsed ? <ChevronsUpDown data-icon="inline-start" /> : <ChevronsDownUp data-icon="inline-start" />}
            {allCollapsed ? t("actions.expandAll") : t("actions.collapseAll")}
          </Button>
        ) : null
      }
      allSelected={allSelected}
      selectAllLabel={t("common.selectAll")}
      selectedCount={selectedRows.size}
      onToggleAll={toggleAll}
      hasRows={rows.length > 0}
      table={<DistrictTable {...handlers} {...groupProps} allSelected={allSelected} onToggleAll={toggleAll} />}
      mobileList={<DistrictMobileList {...handlers} {...groupProps} />}
      empty={<SettingsEmptyRecords icon={<LOCATION_ICONS.district aria-hidden />} title={title.toLowerCase()} />}
      page={page}
      pageStart={pageStart}
      pageEnd={pageEnd}
      total={total}
      totalPages={totalPages}
      limit={limit}
      onLimitChange={changeLimit}
      onPageChange={setPage}
    >
      {canManage ? (
        <>
          <LocationFormDialog
            description={description}
            editing={editing}
            kind="district"
            labels={labels}
            open={dialogOpen}
            provinceLoading={provinceOptionsLoading}
            provinces={provinceRows}
            saving={saving}
            title={title}
            onOpenChange={onDialogOpenChange}
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
    </SettingsListPageLayout>
  );
}
