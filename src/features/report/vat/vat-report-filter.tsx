"use client";

import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Field, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
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

export interface VatReportDraft extends ReportLocationFilters {
  branchUuid: string;
  dateFrom: string;
  dateTo: string;
  search: string;
  orderBy: "ASC" | "DESC";
}

interface FieldsProps {
  branchLoading: boolean;
  branchLocked: boolean;
  branchOptions: ReportFieldOption[];
  draft: VatReportDraft;
  draftBranch: string;
  locationOptions: ReportLocationOptions & { loading: boolean };
  onDraftChange: (updater: (previous: VatReportDraft) => VatReportDraft) => void;
}

function VatReportFilterFields({
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

  return (
    <>
      <Field className="sm:col-span-2 lg:col-span-1">
        <FieldLabel htmlFor={`${idPrefix}-search`}>{t("actions.search")}</FieldLabel>
        <InputGroup>
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            id={`${idPrefix}-search`}
            type="search"
            placeholder={t("report.vat.searchPlaceholder")}
            value={draft.search}
            onChange={event => {
              const search = event.target.value;
              onDraftChange(previous => ({ ...previous, search }));
            }}
          />
        </InputGroup>
      </Field>
      <ReportBranchField
        id={`${idPrefix}-branch`}
        branchLoading={branchLoading}
        branchLocked={branchLocked}
        options={branchOptions}
        value={draftBranch}
        onValueChange={branchUuid => onDraftChange(previous => ({
          ...previous,
          branchUuid,
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
export function VatReportFilterBar({
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
      contentClassName="grid items-end gap-3 py-4 lg:grid-cols-4 2xl:grid-cols-[repeat(7,minmax(0,1fr))_auto]"
      loading={loading}
      onApply={onApply}
    >
      <VatReportFilterFields idPrefix="vat-report" {...fieldProps} />
    </ReportFilterCard>
  );
}

// จอเล็ก: modal เดียวกับรายงานอื่น (ReportFilterSheet)
export function VatReportFilterSheet({
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
      description={t("report.vat.title")}
      gridClassName="lg:grid-cols-3"
      loading={loading}
      open={open}
      onApply={onApply}
      onOpenChange={onOpenChange}
    >
      <VatReportFilterFields idPrefix="vat-report-mobile" {...fieldProps} />
      {dateRangeInvalid ? (
        <p className="text-sm text-destructive sm:col-span-2 lg:col-span-3" role="alert">
          {t("report.vat.invalidDateRange")}
        </p>
      ) : null}
    </ReportFilterSheet>
  );
}
