"use client";

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  ReportBranchField,
  ReportDateRangeFields,
  ReportSelectField,
} from "@/features/report/shared/report-filter-fields";
import { ReportFilterCard, ReportFilterSheet } from "@/features/report/shared/report-filter-shell";
import type { ReportBranchOption } from "@/features/report/shared/report-branch-options";
import { useZoneOptions } from "./use-zone-options";
import { zoneOptionLabel } from "./zone-sales-utils";

export interface ZoneSalesDraft {
  branchUuid: string;
  zoneUuid: string;
  dateFrom: string;
  dateTo: string;
}

interface FieldsProps {
  branchLoading: boolean;
  branchLocked: boolean;
  branchOptions: ReportBranchOption[];
  draft: ZoneSalesDraft;
  draftBranch: string;
  language: string;
  onDraftChange: (updater: (previous: ZoneSalesDraft) => ZoneSalesDraft) => void;
}

function ZoneSalesFilterFields({
  branchLoading,
  branchLocked,
  branchOptions,
  draft,
  draftBranch,
  idPrefix,
  language,
  onDraftChange,
}: FieldsProps & { idPrefix: string }) {
  const { t } = useTranslation();
  const { zones, loading: zonesLoading } = useZoneOptions(draftBranch, language);
  // Radix Select ห้ามใช้ value เป็นสตริงว่าง (สงวนไว้สำหรับ clear/placeholder) — ใช้ "all" แทน
  // เหมือน order-audit's action/entity select แล้วค่อยแปลงเป็น "" ตอนส่ง API จริง
  const zoneOptions = [
    { value: "all", label: t("report.zoneSales.allZones") },
    ...zones.map(zone => ({ value: zone.zone_uuid, label: zoneOptionLabel(zone, language) })),
  ];

  return (
    <>
      <ReportBranchField
        id={`${idPrefix}-branch`}
        branchLoading={branchLoading}
        branchLocked={branchLocked}
        options={branchOptions}
        value={draftBranch}
        onValueChange={branchUuid => onDraftChange(previous => ({ ...previous, branchUuid, zoneUuid: "all" }))}
      />
      <ReportSelectField
        id={`${idPrefix}-zone`}
        label={t("report.zoneSales.zone")}
        disabled={!draftBranch || zonesLoading}
        options={zoneOptions}
        value={draft.zoneUuid}
        onValueChange={zoneUuid => onDraftChange(previous => ({ ...previous, zoneUuid }))}
      />
      <ReportDateRangeFields
        idPrefix={idPrefix}
        dateFrom={draft.dateFrom}
        dateTo={draft.dateTo}
        onDateFromChange={dateFrom => onDraftChange(previous => ({ ...previous, dateFrom }))}
        onDateToChange={dateTo => onDraftChange(previous => ({ ...previous, dateTo }))}
      />
    </>
  );
}

// จอ lg ขึ้นไปกรองได้จากหน้าเลย โครงเดียวกับ category-sales/payment-methods
export function ZoneSalesFilterBar({
  actions,
  canApply,
  loading,
  onApply,
  ...fieldProps
}: FieldsProps & { actions?: ReactNode; canApply: boolean; loading: boolean; onApply: () => void }) {
  return (
    <ReportFilterCard
      actions={actions}
      canApply={canApply}
      className="hidden shrink-0 rounded-none border-x-0 border-t-0 shadow-none lg:block"
      contentClassName="grid min-w-0 items-end gap-3 px-3 py-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-[repeat(3,minmax(0,1fr))_auto]"
      loading={loading}
      onApply={onApply}
    >
      <ZoneSalesFilterFields idPrefix="zone-sales" {...fieldProps} />
    </ReportFilterCard>
  );
}

// จอเล็ก: modal เดียวกับรายงานอื่น (ReportFilterSheet)
export function ZoneSalesFilterSheet({
  canApply,
  dateRangeInvalid,
  loading,
  open,
  onApply,
  onOpenChange,
  ...fieldProps
}: FieldsProps & {
  canApply: boolean;
  dateRangeInvalid: boolean;
  loading: boolean;
  open: boolean;
  onApply: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();

  return (
    <ReportFilterSheet
      canApply={canApply}
      description={t("report.zoneSales.title")}
      gridClassName="lg:grid-cols-2"
      loading={loading}
      open={open}
      onApply={onApply}
      onOpenChange={onOpenChange}
    >
      <ZoneSalesFilterFields idPrefix="zone-sales-mobile" {...fieldProps} />
      {dateRangeInvalid ? (
        <p className="text-sm text-destructive sm:col-span-2" role="alert">
          {t("report.zoneSales.invalidDateRange")}
        </p>
      ) : null}
    </ReportFilterSheet>
  );
}
