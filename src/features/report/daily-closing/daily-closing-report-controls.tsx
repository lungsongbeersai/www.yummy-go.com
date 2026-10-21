"use client";

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ReportFilterCard, ReportFilterSheet } from "../shared/report-filter-shell";
import { ReportDateField } from "../shared/report-filter-fields";
import { ReportLocationFields } from "../shared/report-location-fields";
import type { ReportLocationOptions } from "../shared/report-location";
import type { ReportBranchOption } from "../shared/report-branch-options";
import type { DailyClosingReportFilters } from "./daily-closing-report-types";
import { dailyClosingFilterError } from "./daily-closing-report-utils";

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
  const filterError = dailyClosingFilterError(draftFilters);
  const errorKey = filterError === "date" ? "report.dailyClosing.invalidDateRange"
    : filterError === "time" ? "report.dailyClosing.invalidTime"
    : "report.dailyClosing.invalidDateTimeRange";

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
      <div
        className="col-span-full grid gap-3 rounded-lg border border-border bg-muted/20 p-3"
        role="group"
        aria-labelledby={`${idPrefix}-payment-period`}
      >
        <div>
          <p id={`${idPrefix}-payment-period`} className="mb-1 text-sm font-semibold">
            {t("report.dailyClosing.paymentPeriod")}
          </p>
          <FieldDescription id={`${idPrefix}-time-hint`}>{t("report.dailyClosing.paymentPeriodHint")}</FieldDescription>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ReportDateField
            id={`${idPrefix}-date-from`}
            label={t("report.filters.dateFrom")}
            value={draftFilters.dateFrom}
            disabled={disabled}
            onChange={dateFrom => onDraftChange({ ...draftFilters, dateFrom })}
          />
          <Field data-invalid={filterError === "time" || filterError === "range"}>
            <FieldLabel htmlFor={`${idPrefix}-time-from`}>{t("report.dailyClosing.timeFrom")}</FieldLabel>
            <Input
              id={`${idPrefix}-time-from`}
              type="time"
              step={60}
              required
              value={draftFilters.timeFrom}
              disabled={disabled}
              aria-invalid={filterError === "time" || filterError === "range"}
              aria-describedby={filterError ? `${idPrefix}-range-error` : `${idPrefix}-time-hint`}
              onChange={event => onDraftChange({ ...draftFilters, timeFrom: event.target.value })}
            />
          </Field>
          <ReportDateField
            id={`${idPrefix}-date-to`}
            label={t("report.filters.dateTo")}
            value={draftFilters.dateTo}
            disabled={disabled}
            onChange={dateTo => onDraftChange({ ...draftFilters, dateTo })}
          />
          <Field data-invalid={filterError === "time" || filterError === "range"}>
            <FieldLabel htmlFor={`${idPrefix}-time-to`}>{t("report.dailyClosing.timeTo")}</FieldLabel>
            <Input
              id={`${idPrefix}-time-to`}
              type="time"
              step={60}
              required
              value={draftFilters.timeTo}
              disabled={disabled}
              aria-invalid={filterError === "time" || filterError === "range"}
              aria-describedby={filterError ? `${idPrefix}-range-error` : `${idPrefix}-time-hint`}
              onChange={event => onDraftChange({ ...draftFilters, timeTo: event.target.value })}
            />
          </Field>
        </div>
        {filterError ? <p id={`${idPrefix}-range-error`} className="text-sm text-destructive" role="alert">{t(errorKey)}</p> : null}
      </div>
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
      contentClassName="grid items-end gap-3 py-4 lg:grid-cols-4"
      actionsClassName="lg:col-start-4 lg:row-start-1"
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
