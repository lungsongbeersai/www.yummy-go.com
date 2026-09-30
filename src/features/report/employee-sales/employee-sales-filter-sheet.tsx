"use client";

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  ReportBranchField,
  ReportDateRangeFields,
  ReportSelectField,
  type ReportFieldOption,
} from "@/features/report/shared/report-filter-fields";
import { ReportFilterCard, ReportFilterSheet } from "@/features/report/shared/report-filter-shell";
import { ReportLocationFields } from "@/features/report/shared/report-location-fields";
import type { ReportLocationFilters, ReportLocationOptions } from "@/features/report/shared/report-location";
import { reportOrderOptions } from "@/features/report/shared/report-sort-utils";
import type { PageLimit } from "@/services/shared/types";
import { EmployeeCombobox } from "./employee-combobox";
import { useEmployeeOptions } from "./use-employee-options";

export interface EmployeeSalesDraft extends ReportLocationFilters {
  branchUuid: string;
  loginUuid: string;
  dateFrom: string;
  dateTo: string;
  orderBy: "ASC" | "DESC";
  limit: PageLimit;
}

interface FieldsProps {
  branchLoading: boolean;
  branchLocked: boolean;
  branchOptions: ReportFieldOption[];
  draft: EmployeeSalesDraft;
  draftBranch: string;
  locationOptions: ReportLocationOptions & { loading: boolean };
  onDraftChange: (updater: (previous: EmployeeSalesDraft) => EmployeeSalesDraft) => void;
}

function EmployeeSalesFilterFields({
  branchLoading,
  branchLocked,
  branchOptions,
  draft,
  draftBranch,
  idPrefix,
  locationOptions,
  onDraftChange,
}: FieldsProps & { idPrefix: string }) {
  const { t } = useTranslation();
  const { options: employees, loading: employeesLoading } = useEmployeeOptions(draftBranch);

  return (
    <>
      <ReportBranchField
        id={`${idPrefix}-branch`}
        branchLoading={branchLoading}
        branchLocked={branchLocked}
        options={branchOptions}
        value={draftBranch}
        onValueChange={branchUuid => onDraftChange(previous => ({
          ...previous,
          branchUuid,
          loginUuid: "",
          tableUuid: "all",
          zoneUuid: "all",
        }))}
      />
      <ReportLocationFields
        branchUuid={draftBranch}
        idPrefix={idPrefix}
        loading={locationOptions.loading}
        tableOptions={locationOptions.tableOptions}
        tableUuid={draft.tableUuid}
        zoneOptions={locationOptions.zoneOptions}
        zoneUuid={draft.zoneUuid}
        onTableChange={tableUuid => onDraftChange(previous => ({ ...previous, tableUuid }))}
        onZoneChange={zoneUuid => onDraftChange(previous => ({ ...previous, tableUuid: "all", zoneUuid }))}
      />
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-employee`}>{t("employeeSales.employee")}</FieldLabel>
        <EmployeeCombobox
          disabled={!draftBranch}
          employees={employees}
          id={`${idPrefix}-employee`}
          loading={employeesLoading}
          value={draft.loginUuid}
          onValueChange={loginUuid => onDraftChange(previous => ({ ...previous, loginUuid }))}
        />
      </Field>
      <ReportDateRangeFields
        idPrefix={idPrefix}
        dateFrom={draft.dateFrom}
        dateTo={draft.dateTo}
        onDateFromChange={dateFrom => onDraftChange(previous => ({ ...previous, dateFrom }))}
        onDateToChange={dateTo => onDraftChange(previous => ({ ...previous, dateTo }))}
      />
      <ReportSelectField
        id={`${idPrefix}-order-by`}
        label={t("report.filters.orderBy")}
        options={reportOrderOptions(t)}
        value={draft.orderBy}
        onValueChange={orderBy => onDraftChange(previous => ({ ...previous, orderBy: orderBy as "ASC" | "DESC" }))}
      />
    </>
  );
}

// จอ lg ขึ้นไปกรองได้จากหน้าเลย โครงเดียวกับ category-sales/payment-methods
export function EmployeeSalesFilterBar({
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
      // shrink-0: Card มี overflow-hidden (min-height ของ flex item = 0) — กันถูกบีบ ดู report-layout.tsx
      className="hidden shrink-0 shadow-none lg:block"
      contentClassName="grid items-end gap-3 py-4 lg:grid-cols-3 2xl:grid-cols-[repeat(8,minmax(0,1fr))_auto]"
      loading={loading}
      onApply={onApply}
    >
      <EmployeeSalesFilterFields idPrefix="employee-sales" {...fieldProps} />
    </ReportFilterCard>
  );
}

// จอเล็ก: modal เดียวกับรายงานอื่น (ReportFilterSheet) แทน Sheet เดิมที่ใช้ทุกขนาดจอ
export function EmployeeSalesFilterSheet({
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
      description={t("employeeSales.title")}
      gridClassName="lg:grid-cols-3"
      loading={loading}
      open={open}
      onApply={onApply}
      onOpenChange={onOpenChange}
    >
      <EmployeeSalesFilterFields idPrefix="employee-sales-mobile" {...fieldProps} />
      {dateRangeInvalid ? (
        <p className="text-sm text-destructive sm:col-span-2 lg:col-span-3" role="alert">
          {t("employeeSales.invalidDateRange")}
        </p>
      ) : null}
    </ReportFilterSheet>
  );
}
