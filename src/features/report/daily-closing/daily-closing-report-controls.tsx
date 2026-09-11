"use client";

import type { RefObject } from "react";
import { Printer, RefreshCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { ReportFilterCard, ReportFilterSheet } from "../shared/report-filter-shell";
import { ReportDateRangeFields } from "../shared/report-filter-fields";
import type { ReportBranchOption } from "../shared/report-branch-options";
import type { DailyClosingReportFilters } from "./daily-closing-report-types";

interface FieldsProps {
  branchLoading: boolean;
  branchLocked: boolean;
  branchOptions: ReportBranchOption[];
  disabled: boolean;
  draftFilters: DailyClosingReportFilters;
  onDraftChange: (filters: DailyClosingReportFilters) => void;
}

function DailyClosingFilterFields({
  branchLoading,
  branchLocked,
  branchOptions,
  disabled,
  draftFilters,
  idPrefix,
  onDraftChange,
}: FieldsProps & { idPrefix: string }) {
  const { t } = useTranslation();

  return (
    <>
      <Field className="gap-1.5" data-disabled={branchLocked || disabled}>
        <FieldLabel htmlFor={`${idPrefix}-branch`}>{t("fields.branch_uuid_fk")}</FieldLabel>
        <Select
          value={draftFilters.branchUuid}
          disabled={branchLocked || branchLoading || disabled}
          onValueChange={branchUuid => onDraftChange({ ...draftFilters, branchUuid })}
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
      <ReportDateRangeFields
        dateFrom={draftFilters.dateFrom}
        dateTo={draftFilters.dateTo}
        disabled={disabled}
        fieldClassName="gap-1.5"
        idPrefix={idPrefix}
        onDateFromChange={dateFrom => onDraftChange({ ...draftFilters, dateFrom })}
        onDateToChange={dateTo => onDraftChange({ ...draftFilters, dateTo })}
      />
    </>
  );
}

interface FilterBarProps extends FieldsProps {
  actionsRef: RefObject<HTMLDivElement | null>;
  canApply: boolean;
  loading: boolean;
  printDisabled: boolean;
  printing: boolean;
  refreshDisabled: boolean;
  onApply: () => void;
  onPrint: () => void;
  onRefresh: () => void;
}

// จอ lg ขึ้นไปกรองได้จากหน้าเลย โครงเดียวกับ category-sales/payment-methods
// actionsRef ครอบปุ่ม refresh/print ไว้เป็นเป้าของ IntersectionObserver (ใน page) เพื่อโชว์ปุ่มพิมพ์ลอย
// เมื่อแถบนี้เลื่อนพ้นจอ — จอเล็กที่ card นี้ถูกซ่อนไว้ ปุ่มลอยจึงโชว์ตลอดโดยอัตโนมัติ
export function DailyClosingFilterBar({
  actionsRef,
  canApply,
  loading,
  printDisabled,
  printing,
  refreshDisabled,
  onApply,
  onPrint,
  onRefresh,
  ...fieldProps
}: FilterBarProps) {
  const { t } = useTranslation();

  return (
    <ReportFilterCard
      actions={
        <div ref={actionsRef} className="flex min-w-0 flex-wrap items-center gap-2">
          <Button type="button" variant="outline" className="h-9" disabled={refreshDisabled} onClick={onRefresh}>
            <RefreshCcw data-icon="inline-start" className={loading ? "animate-spin" : undefined} aria-hidden="true" />
            {t("actions.refresh")}
          </Button>
          <Button type="button" className="h-9" disabled={printDisabled} onClick={onPrint}>
            {printing ? <Spinner aria-hidden="true" data-icon="inline-start" /> : <Printer data-icon="inline-start" aria-hidden="true" />}
            {t("report.dailyClosing.printClosingReport")}
          </Button>
        </div>
      }
      canApply={canApply}
      className="hidden shrink-0 rounded-none border-x-0 border-t-0 shadow-none lg:block"
      contentClassName="grid min-w-0 items-end gap-3 px-3 py-3 sm:grid-cols-3"
      loading={loading}
      onApply={onApply}
    >
      <DailyClosingFilterFields idPrefix="daily-closing" {...fieldProps} />
    </ReportFilterCard>
  );
}

// จอเล็ก: modal เดียวกับรายงานอื่น (ReportFilterSheet) — ปุ่มพิมพ์ใช้ FAB ลอยของ page แทน (ดู page.tsx)
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
