"use client";

import { useEffect, useMemo, useState } from "react";
import { useResetOnChange } from "@/hooks/use-reset-on-change";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import {
  SettingsModuleShell,
  SettingsPaginationFooter,
  SettingsToolbar
} from "@/features/settings/shared/settings-shell";
import { optionPageRange, optionPageSize, optionTotalPages } from "@/features/settings/shared/option-settings-utils";
import { useOptionRowSelection } from "@/features/settings/shared/use-option-row-selection";
import { useSettingsCrudController } from "@/features/settings/shared/use-settings-crud-controller";
import { PAGE_LIMIT_OPTIONS } from "@/lib/pagination";
import type { UrlPaginationState } from "@/lib/url-pagination";
import type { FetchTablesParams, SaveTableInput, Table as DiningTable, TableListRow } from "@/services/table";
import type { Zone } from "@/services/zone";
import { useBranchStore } from "@/stores/branch-store";
import { useReferenceStore } from "@/stores/reference-store";
import { useTableStore } from "@/stores/table-store";
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

const EMPTY_ZONES: Zone[] = [];

export function TableSettingsPage({ initialPagination }: { initialPagination: UrlPaginationState }) {
  const { t } = useTranslation();
  const branches = useBranchStore((state) => state.branches);
  const branchStoreUuid = useBranchStore((state) => state.storeUuid);
  const branchLoading = useBranchStore((state) => state.loading);
  const loadBranches = useBranchStore((state) => state.loadBranches);
  const loadZoneOptions = useReferenceStore((state) => state.loadZones);
  // แถวจริงเป็นกลุ่มโซน (TableListRow อาจเป็น ZoneGroup) ต้องแบน/นับหน้าเองแยกจาก controller และ
  // save ต้องจำโซนที่บันทึกสำเร็จล่าสุดไว้ตั้งค่าเริ่มต้นฟอร์มถัดไป — save() ของ controller ไม่มีจุด
  // ต่อขยายให้ทำหลังบันทึกสำเร็จเท่านั้น จึงเรียก saveRow/loadRows ของสโตร์ตรง (เหมือน category's persistOrder)
  const saveTableRow = useTableStore((state) => state.save);
  const loadTableRows = useTableStore((state) => state.load);
  const removeTableRow = useTableStore((state) => state.remove);
  const storeTotalPages = useTableStore((state) => state.totalPages);
  const [fetchedZoneOptions, setFetchedZoneOptions] = useState<Zone[]>([]);
  const [lastSavedZoneUuid, setLastSavedZoneUuid] = useState("");
  const [collapsedZones, setCollapsedZones] = useState<Set<string>>(() => new Set());

  const title = t("settings.modules.table.title");
  const description = t("settings.modules.table.description");
  const {
    applyFilters,
    backgroundLoading,
    changeLimit,
    deleteTarget,
    dialogOpen,
    editing,
    fullLoading,
    language,
    limit,
    missingRequiredScope,
    onDialogOpenChange,
    openEdit,
    orderBy,
    page,
    pagingBusy,
    requestParams,
    requiredScopeDescription,
    rows: storeRows,
    saving,
    search,
    setDeleteTarget,
    setDialogOpen,
    setEditing,
    setOrderBy,
    setPage,
    setSearch,
    showToast,
    storeUuid,
    total,
    user
  } = useSettingsCrudController<TableListRow, SaveTableInput, FetchTablesParams>({
    // buildInput/validateInput ให้ครบตามชนิดที่ controller ต้องการ แต่การบันทึกจริงยังเดินตรงผ่านสโตร์
    // ใน save() ท้องถิ่นด้านล่าง (ดูคอมเมนต์ที่ saveTableRow) เพื่อคงพฤติกรรม "จำโซนหลังบันทึกสำเร็จ" เดิม
    buildInput: ({ editing: editingRow, formData, user: currentUser }) => {
      const editingTable = editingRow && !isZoneGroup(editingRow) ? editingRow : null;
      return buildTablePayload({
        branchUuid: currentUser?.branch_uuid ?? "",
        chargeStatus: String(formData.get("charge_status") ?? "2").trim(),
        editing: editingTable,
        nameEng: String(formData.get("table_name_eng") ?? "").trim(),
        nameLa: String(formData.get("table_name_la") ?? "").trim(),
        seats: String(formData.get("table_qty") ?? "").trim(),
        zoneUuid: String(formData.get("zone_uuid_fk") ?? "").trim()
      });
    },
    idKey: "table_uuid",
    initialPagination,
    requiredScopeKey: "branch_uuid_fk",
    requiredScopeMessage: t("settings.branchRequired"),
    scope: (_storeUuid, currentUser) => ({ branch_uuid_fk: currentUser?.branch_uuid ?? "" }),
    store: useTableStore,
    title,
    validateInput: ({ formData, user: currentUser }) => {
      const missing = missingTableField({
        branchUuid: currentUser?.branch_uuid ?? "",
        nameLa: String(formData.get("table_name_la") ?? "").trim(),
        zoneUuid: String(formData.get("zone_uuid_fk") ?? "").trim()
      });
      return missing ? missingFieldDescription(missing) : null;
    }
  });

  const branchUuid = user?.branch_uuid ?? "";
  // ยังไม่มีสาขาที่อ้างอิง = ไม่มีตัวเลือก แต่คงค่าที่โหลดไว้ไม่ให้รายการกะพริบตอนสลับ
  const zoneOptions = branchUuid ? fetchedZoneOptions : EMPTY_ZONES;
  const zoneById = useMemo(() => {
    const map = new Map<string, Zone>();
    zoneOptions.forEach((zone) => {
      const id = tableValue(zone, "zone_uuid");
      if (id) map.set(id, zone);
    });
    return map;
  }, [zoneOptions]);
  const initialFormZoneUuid = zoneById.has(lastSavedZoneUuid) ? lastSavedZoneUuid : "";
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
  const pageSize = optionPageSize(limit, rows.length);
  const totalPages = optionTotalPages(storeTotalPages, displayTotal, pageSize);
  const { start: pageStart, end: pageEnd } = optionPageRange(rows.length, page, pageSize);
  const canGoBack = page > 1 && !pagingBusy;
  const canGoNext = page < totalPages && !pagingBusy;
  const { allSelected, removeSelected, selectedRows, toggleAll, toggleSelected } =
    useOptionRowSelection(rows, tableId);
  const allCollapsed = tableGroups.length > 0 && tableGroups.every((group) => collapsedZones.has(group.zoneId));
  const groupedTableRows = useMemo(() => buildGroupedTableRows(tableGroups, pageStart), [pageStart, tableGroups]);
  // editing มาจาก controller เป็น TableListRow (อาจเป็น ZoneGroup) แต่ในทางปฏิบัติมีแต่แถวโต๊ะเดี่ยว
  // เท่านั้นที่ถูกส่งเข้า openEdit จึงตีบให้แคบเป็น DiningTable ให้ dialog/ payload ใช้ตรงชนิดได้
  const editingTable = editing && !isZoneGroup(editing) ? editing : null;

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
    if (!branchUuid) return;

    let active = true;
    loadZoneOptions(language, branchUuid)
      .then((zones) => {
        if (active) setFetchedZoneOptions(zones);
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

  // โซนที่พับไว้อาจหายไปหลังโหลดชุดใหม่ ต้องตัดออกไม่ให้ค้างใน state
  useResetOnChange(tableGroups, () => {
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
  });

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

  function missingFieldDescription(field: ReturnType<typeof missingTableField>) {
    if (field === "branch") return t("settings.branchRequired");
    if (field === "zone") return t("settings.tableZoneRequired");
    if (field === "name") return t("settings.tableNameRequired");
    return t("toasts.pleaseTryAgain");
  }

  function openCreate() {
    if (missingRequiredScope) {
      showToast({ title: t("settings.saveFailed"), description: requiredScopeDescription, tone: "error" });
      return;
    }
    if (!zoneOptions.length) {
      showToast({ title: t("settings.saveFailed"), description: t("settings.createZoneFirst"), tone: "error" });
      return;
    }
    setEditing(null);
    setDialogOpen(true);
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
      await saveTableRow(buildTablePayload({ branchUuid, chargeStatus, editing: editingTable, nameEng, nameLa, seats, zoneUuid }));
      showToast({ title: t("settings.saved"), tone: "success" });
      setLastSavedZoneUuid(zoneUuid);
      setDialogOpen(false);
      setEditing(null);
      await loadTableRows(requestParams, { background: true });
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
      await removeTableRow(id);
      showToast({ title: t("settings.deleted"), tone: "success" });
      setDeleteTarget(null);
      removeSelected(id);
      await loadTableRows(requestParams, { background: true });
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
              onPageChange={setPage}
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
        editing={editingTable}
        initialZoneUuid={initialFormZoneUuid}
        open={dialogOpen}
        saving={saving}
        serviceCharge={serviceCharge}
        serviceChargeLoading={branchLoading && !currentBranch}
        title={title}
        zones={zoneOptions}
        onOpenChange={onDialogOpenChange}
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
          if (deleteTarget && !isZoneGroup(deleteTarget)) void remove(deleteTarget);
        }}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setDeleteTarget(null);
        }}
      />
    </>
  );
}
