"use client";

import { useEffect, useMemo, useState } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { SettingsCrudShell, SettingsCrudToolbar } from "@/features/settings/shared/settings-crud-shell";
import { useSettingsCrudController } from "@/features/settings/shared/use-settings-crud-controller";
import { LocationFormDialog } from "./location-form-dialog";
import { LocationListSurface } from "./location-list";
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
import { PAGE_LIMIT_OPTIONS } from "@/lib/pagination";
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

// หน้าจังหวัดไม่มีกลุ่มอำเภอ/แถวที่พับไว้ ใช้ค่าคงที่ว่างเปล่าเหล่านี้กันสร้าง object/Set ใหม่ทุก render
const EMPTY_COLLAPSED = new Set<string>();
const EMPTY_DISTRICT_GROUPS: ReturnType<typeof buildNumberedDistrictGroups> = [];
const EMPTY_PROVINCES: LocationSettingsRow[] = [];
function NOOP() {}

function ProvinceSettingsPage({ initialPagination }: { initialPagination: UrlPaginationState }) {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const canManage = canManageLocationSettings(user?.status);
  const title = t("settings.modules.province.title");
  const description = t("settings.modules.province.description");
  const labels = buildLocationLabels(t);
  const controller = useSettingsCrudController<Province, SaveProvinceInput, FetchProvincesParams>({
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
  const {
    allSelected,
    backgroundLoading,
    openCreate: controllerOpenCreate,
    openEdit: controllerOpenEdit,
    pageStart,
    remove: crudRemove,
    rows,
    save: crudSave,
    selectedRows,
    setDeleteTarget,
    toggleAll,
    toggleSelected
  } = controller;

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

  // ใช้เองเป็นแผนที่จังหวัด->แถวเพื่อส่งให้ LocationListSurface ตามชนิด props ที่ต้องการ แต่หน้า
  // จังหวัดไม่ได้ใช้ค่านี้แสดงผลจริง (ใช้เฉพาะฝั่งอำเภอ อ้างอิงจังหวัดของแต่ละแถว)
  const provinceById = useMemo(() => {
    const map = new Map<string, LocationSettingsRow>();
    rows.forEach((row) => {
      const id = locationValue(row, "province_uuid");
      if (id) map.set(id, row);
    });
    return map;
  }, [rows]);

  const addLabel = `${t("actions.add")} ${labels.province}`;
  const listTitle = t("settings.provinceList");
  const refreshLabel = t("settings.refreshingProvinceList");

  return (
    <SettingsCrudShell
      addLabel={addLabel}
      cardTitle={listTitle}
      controller={controller}
      description={description}
      formDialog={
        canManage ? (
          <LocationFormDialog
            description={description}
            editing={controller.editing}
            kind="province"
            labels={labels}
            open={controller.dialogOpen}
            provinceLoading={false}
            provinces={EMPTY_PROVINCES}
            saving={controller.saving}
            title={title}
            onOpenChange={controller.onDialogOpenChange}
            onSubmit={save}
          />
        ) : null
      }
      listSurface={
        <LocationListSurface
          allCollapsed={false}
          allSelected={allSelected}
          backgroundLoading={backgroundLoading}
          canManage={canManage}
          collapsedProvinces={EMPTY_COLLAPSED}
          districtGroups={EMPTY_DISTRICT_GROUPS}
          kind="province"
          labels={labels}
          listTitle={listTitle}
          pageStart={pageStart}
          provinceById={provinceById}
          refreshLabel={refreshLabel}
          rows={rows}
          selectedRows={selectedRows}
          title={title}
          toolbar={
            <SettingsCrudToolbar
              controller={controller}
              limitOptions={PAGE_LIMIT_OPTIONS}
              orderOptions={[
                { label: labels.sortAsc, value: "ASC" },
                { label: labels.sortDesc, value: "DESC" }
              ]}
            />
          }
          onDelete={handleDeleteTarget}
          onEdit={handleEdit}
          onToggleAll={toggleAll}
          onToggleAllGroups={NOOP}
          onToggleProvinceCollapse={NOOP}
          onToggleSelected={toggleSelected}
        />
      }
      title={title}
      onAdd={canManage ? openCreate : null}
      onRemove={remove}
    />
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
  const controller = useSettingsCrudController<District, SaveDistrictInput, FetchDistrictsParams>({
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
  const {
    allSelected,
    backgroundLoading,
    openCreate: controllerOpenCreate,
    openEdit: controllerOpenEdit,
    pageStart,
    remove: crudRemove,
    rows,
    save: crudSave,
    selectedRows,
    setDeleteTarget,
    toggleAll,
    toggleSelected
  } = controller;

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

  const addLabel = `${t("actions.add")} ${labels.district}`;
  const listTitle = t("settings.districtList");
  const refreshLabel = t("settings.refreshingDistrictList");

  return (
    <SettingsCrudShell
      addLabel={addLabel}
      cardTitle={listTitle}
      controller={controller}
      description={description}
      formDialog={
        canManage ? (
          <LocationFormDialog
            description={description}
            editing={controller.editing}
            kind="district"
            labels={labels}
            open={controller.dialogOpen}
            provinceLoading={provinceOptionsLoading}
            provinces={provinceRows}
            saving={controller.saving}
            title={title}
            onOpenChange={controller.onDialogOpenChange}
            onSubmit={save}
          />
        ) : null
      }
      listSurface={
        <LocationListSurface
          allCollapsed={allCollapsed}
          allSelected={allSelected}
          backgroundLoading={backgroundLoading}
          canManage={canManage}
          collapsedProvinces={collapsedProvinces}
          districtGroups={numberedDistrictGroups}
          kind="district"
          labels={labels}
          listTitle={listTitle}
          pageStart={pageStart}
          provinceById={provinceById}
          refreshLabel={refreshLabel}
          rows={rows}
          selectedRows={selectedRows}
          title={title}
          toolbar={
            <SettingsCrudToolbar
              controller={controller}
              limitOptions={PAGE_LIMIT_OPTIONS}
              orderOptions={[
                { label: labels.sortAsc, value: "ASC" },
                { label: labels.sortDesc, value: "DESC" }
              ]}
            />
          }
          onDelete={handleDeleteTarget}
          onEdit={handleEdit}
          onToggleAll={toggleAll}
          onToggleAllGroups={toggleAllGroups}
          onToggleProvinceCollapse={toggleProvinceCollapse}
          onToggleSelected={toggleSelected}
        />
      }
      title={title}
      onAdd={canManage ? openCreate : null}
      onRemove={remove}
    />
  );
}
