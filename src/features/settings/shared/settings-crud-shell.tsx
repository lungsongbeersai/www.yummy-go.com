"use client";

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import {
  SettingsModuleShell,
  SettingsPaginationFooter,
  SettingsToolbar
} from "@/features/settings/shared/settings-shell";
import type { PageLimit, SortOrder } from "@/services/shared/types";

// สไลซ์ของ useSettingsCrudController ที่ chrome ต้องใช้ ประกาศเป็น interface ตรง ๆ แทน
// ReturnType<> เพื่อให้หน้าที่คำนวณ rows/pagination เองทับค่าได้ด้วยการ spread
export interface SettingsCrudToolbarState {
  applyFilters: () => void;
  changeLimit: (limit: PageLimit) => void;
  limit: PageLimit;
  orderBy: SortOrder;
  search: string;
  selectedRows: Set<string>;
  setOrderBy: (order: SortOrder) => void;
  setPage: (page: number) => void;
  setSearch: (search: string) => void;
}

export interface SettingsCrudChrome<Row> extends SettingsCrudToolbarState {
  backgroundLoading: boolean;
  deleteTarget: Row | null;
  fullLoading: boolean;
  openCreate: () => void;
  page: number;
  pageEnd: number;
  pageStart: number;
  remove: (row: Row) => Promise<void>;
  rows: Row[];
  saving: boolean;
  setDeleteTarget: (row: Row | null) => void;
  total: number;
  totalPages: number;
}

// toolbar ของหน้ารายการ settings — ทุกหน้าส่ง state ชุดเดียวกันเป๊ะ ต่างแค่ตัวเลือก limit/order
export function SettingsCrudToolbar({
  controller,
  limitOptions,
  orderOptions
}: {
  controller: SettingsCrudToolbarState;
  limitOptions?: PageLimit[];
  orderOptions?: Array<{ label: string; value: SortOrder }>;
}) {
  return (
    <SettingsToolbar
      state={{
        search: controller.search,
        limit: controller.limit,
        orderBy: controller.orderBy,
        limitOptions,
        orderOptions,
        selectedCount: controller.selectedRows.size,
        onApply: controller.applyFilters,
        onLimit: controller.changeLimit,
        onOrder: (nextOrder) => {
          controller.setOrderBy(nextOrder);
          controller.setPage(1);
        },
        onSearch: controller.setSearch
      }}
    />
  );
}

// เปลือกนอกของหน้า CRUD ใน settings: module shell + footer แบ่งหน้า + ไดอะล็อกยืนยันลบ
// ส่วนที่ต่างกันจริงมีแค่ listSurface (ตารางเฉพาะทาง) กับ formDialog ของแต่ละโดเมน
export function SettingsCrudShell<Row>({
  addLabel,
  cardTitle,
  controller,
  description,
  formDialog,
  listSurface,
  title,
  // หน้าที่มีเงื่อนไขก่อนเปิด/ลบ (สิทธิ์, ต้องมีสกุลเงิน/โซนก่อน) ส่ง handler ของตัวเองมาแทน
  // ส่ง onAdd={null} เมื่อผู้ใช้ไม่มีสิทธิ์สร้าง เพื่อซ่อนปุ่มเพิ่มทั้งปุ่ม
  onAdd = controller.openCreate,
  onRemove = controller.remove
}: {
  addLabel: string;
  cardTitle: string;
  controller: SettingsCrudChrome<Row>;
  description: string;
  formDialog: ReactNode;
  listSurface: ReactNode;
  title: string;
  onAdd?: (() => void) | null;
  onRemove?: (row: Row) => void | Promise<void>;
}) {
  const { t } = useTranslation();

  return (
    <>
      <SettingsModuleShell
        addLabel={addLabel}
        cardTitle={cardTitle}
        description={description}
        emptyDescription={t("empty.adjustSearch")}
        emptyTitle={t("settings.noRecords", { title: title.toLowerCase() })}
        footer={
          controller.rows.length ? (
            <SettingsPaginationFooter
              page={controller.page}
              pageEnd={controller.pageEnd}
              pageStart={controller.pageStart}
              total={controller.total}
              totalPages={controller.totalPages}
              onPageChange={controller.setPage}
            />
          ) : undefined
        }
        hideCardHeader
        loading={controller.fullLoading}
        loadingLabel={t("settings.loading", { title })}
        table={listSurface}
        title={title}
        onAdd={onAdd ?? undefined}
      />
      {formDialog}
      <ConfirmDialog
        cancelLabel={t("actions.cancel")}
        confirmLabel={t("actions.delete")}
        confirmPending={controller.saving}
        description={t("settings.deleteConfirm")}
        open={Boolean(controller.deleteTarget)}
        title={t("actions.delete")}
        onConfirm={() => {
          if (controller.deleteTarget) void onRemove(controller.deleteTarget);
        }}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) controller.setDeleteTarget(null);
        }}
      />
    </>
  );
}
