"use client";

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ReportFilterCard, ReportFilterSheet } from "../shared/report-filter-shell";
import { ReportDateRangeFields } from "../shared/report-filter-fields";
import { ReportLocationFields } from "../shared/report-location-fields";
import type { ReportLocationOptions } from "../shared/report-location";
import type { ReportBranchOption } from "../shared/report-branch-options";
import type { DailyClosingReportFilters } from "./daily-closing-report-types";

interface FieldsProps {
  branchLoading: boolean;
  branchLocked: boolean;
  branchOptions: ReportBranchOption[];
  disabled: boolean;
  draftFilters: DailyClosingReportFilters;
  locationOptions: ReportLocationOptions & { loading: boolean };
  onDraftChange: (filters: DailyClosingReportFilters) => void;
}

function DailyClosingFilterFields({
  branchLoading,
  branchLocked,
  branchOptions,
  disabled,
  draftFilters,
  idPrefix,
  locationOptions,
  onDraftChange,
}: FieldsProps & { idPrefix: string }) {
  const { t } = useTranslation();

  return (
    <>
      <Field data-disabled={branchLocked || disabled}>
        <FieldLabel htmlFor={`${idPrefix}-branch`}>{t("fields.branch_uuid_fk")}</FieldLabel>
        <Select
          value={draftFilters.branchUuid}
          disabled={branchLocked || branchLoading || disabled}
          onValueChange={branchUuid => onDraftChange({
            ...draftFilters,
            branchUuid,
            tableUuid: "all",
            zoneUuid: "all",
          })}
        >
          <SelectTrigger id={`${idPrefix}-branch`} className="w-full">
            <SelectValue placeholder={t("report.dailyClosing.selectBranch")} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {branchOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <ReportLocationFields
        branchUuid={draftFilters.branchUuid}
        disabled={disabled}
        idPrefix={idPrefix}
        loading={locationOptions.loading}
        tableOptions={locationOptions.tableOptions}
        tableUuid={draftFilters.tableUuid}
        zoneOptions={locationOptions.zoneOptions}
        zoneUuid={draftFilters.zoneUuid}
        onTableChange={tableUuid => onDraftChange({ ...draftFilters, tableUuid })}
        onZoneChange={zoneUuid => onDraftChange({ ...draftFilters, tableUuid: "all", zoneUuid })}
      />
      <ReportDateRangeFields
        dateFrom={draftFilters.dateFrom}
        dateTo={draftFilters.dateTo}
        disabled={disabled}
        idPrefix={idPrefix}
        onDateFromChange={dateFrom => onDraftChange({ ...draftFilters, dateFrom })}
        onDateToChange={dateTo => onDraftChange({ ...draftFilters, dateTo })}
      />
    </>
  );
}

interface FilterBarProps extends FieldsProps {
  actions: ReactNode;
  canApply: boolean;
  loading: boolean;
  onApply: () => void;
}

// จอ lg ขึ้นไปกรองได้จากหน้าเลย โครงเดียวกับรายงานหน้าอื่น — ปุ่มพิมพ์อยู่ในแถบเครื่องมือของหน้า
export function DailyClosingFilterBar({ actions, canApply, loading, onApply, ...fieldProps }: FilterBarProps) {
  return (
    <ReportFilterCard
      actions={actions}
      canApply={canApply}
      // shrink-0: Card มี overflow-hidden (min-height ของ flex item = 0) — กันถูกบีบ ดู report-layout.tsx
      className="hidden shrink-0 shadow-none lg:block"
      contentClassName="grid items-end gap-3 py-4 lg:grid-cols-3 xl:grid-cols-6"
      loading={loading}
      onApply={onApply}
    >
      <DailyClosingFilterFields idPrefix="daily-closing" {...fieldProps} />
    </ReportFilterCard>
  );
}

// จอเล็ก: modal เดียวกับรายงานอื่น (ReportFilterSheet)
export function DailyClosingFilterSheet({
  canApply,
  loading,
  open,
  onApply,
  onOpenChange,
  ...fieldProps
}: FieldsProps & {
  canApply: boolean;
  loading: boolean;
  open: boolean;
  onApply: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();

  return (
    <ReportFilterSheet
      canApply={canApply}
      description={t("report.dailyClosing.title")}
      gridClassName="grid-cols-1"
      loading={loading}
      open={open}
      onApply={onApply}
      onOpenChange={onOpenChange}
    >
      <DailyClosingFilterFields idPrefix="daily-closing-mobile" {...fieldProps} />
    </ReportFilterSheet>
  );
}
