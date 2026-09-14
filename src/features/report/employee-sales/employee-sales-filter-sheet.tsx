"use client";

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  ReportBranchField,
  ReportDateRangeFields,
  ReportPageLimitField,
  ReportSelectField,
  type ReportFieldOption,
} from "@/features/report/shared/report-filter-fields";
import { ReportFilterCard, ReportFilterSheet } from "@/features/report/shared/report-filter-shell";
import { reportOrderOptions } from "@/features/report/shared/report-sort-utils";
import type { PageLimit } from "@/services/shared/types";
import { EmployeeCombobox } from "./employee-combobox";
import { useEmployeeOptions } from "./use-employee-options";

export interface EmployeeSalesDraft {
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
  onDraftChange: (updater: (previous: EmployeeSalesDraft) => EmployeeSalesDraft) => void;
}

function EmployeeSalesFilterFields({
  branchLoading,
  branchLocked,
  branchOptions,
  draft,
  draftBranch,
  idPrefix,
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
        onValueChange={branchUuid => onDraftChange(previous => ({ ...previous, branchUuid, loginUuid: "" }))}
      />
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-bold text-muted-foreground" htmlFor={`${idPrefix}-employee`}>
          {t("employeeSales.employee")}
        </label>
        <EmployeeCombobox
          disabled={!draftBranch}
          employees={employees}
          id={`${idPrefix}-employee`}
          loading={employeesLoading}
          value={draft.loginUuid}
          onValueChange={loginUuid => onDraftChange(previous => ({ ...previous, loginUuid }))}
        />
      </div>
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
      <ReportPageLimitField
        id={`${idPrefix}-limit`}
        value={draft.limit}
        onValueChange={limit => onDraftChange(previous => ({ ...previous, limit }))}
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
      className="hidden shrink-0 rounded-none border-x-0 border-t-0 shadow-none lg:block"
      contentClassName="grid min-w-0 items-end gap-3 px-3 py-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-[repeat(5,minmax(0,1fr))_auto]"
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
