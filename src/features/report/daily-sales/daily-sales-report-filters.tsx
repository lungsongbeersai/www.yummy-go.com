"use client";

import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PAGE_LIMIT_OPTIONS, isAllPageLimit } from "@/lib/pagination";
import { reportOrderLabel, reportOrderOptions } from "../report-sort-utils";
import {
  ReportFilterCard,
  ReportFilterSheet as SharedReportFilterSheet,
  ReportMobileFilterSummary,
} from "../shared/report-filter-shell";
import type {
  DetailPaginationBasis,
  ReportBranchOption,
  ReportFilters,
} from "./daily-sales-report-types";
import {
  paymentMethodLabel,
  paymentMethodOptions,
} from "./daily-sales-report-utils";

type ReportFilterProps = {
  branchLoading: boolean;
  branchLocked: boolean;
  branchOptions: ReportBranchOption[];
  canApply: boolean;
  detailPaginationBasis: DetailPaginationBasis;
  draftFilters: ReportFilters;
  loading: boolean;
  onApply: () => void;
  onDraftChange: (filters: ReportFilters) => void;
};

export function ReportFilterBar({
  branchLoading,
  branchLocked,
  branchOptions,
  canApply,
  detailPaginationBasis,
  draftFilters,
  loading,
  onApply,
  onDraftChange,
}: ReportFilterProps) {
  return (
    <ReportFilterCard
      canApply={canApply}
      contentClassName="grid min-w-0 gap-3 p-3 sm:p-4 lg:grid-cols-4 lg:items-end 2xl:grid-cols-[repeat(7,minmax(0,1fr))_auto]"
      loading={loading}
      onApply={onApply}
    >
      <ReportFilterFields
        branchLoading={branchLoading}
        branchLocked={branchLocked}
        branchOptions={branchOptions}
        detailPaginationBasis={detailPaginationBasis}
        draftFilters={draftFilters}
        idPrefix="report"
        onDraftChange={onDraftChange}
      />
    </ReportFilterCard>
  );
}

export function ReportFilterSheet({
  branchLoading,
  branchLocked,
  branchOptions,
  canApply,
  detailPaginationBasis,
  draftFilters,
  loading,
  open,
  onApply,
  onDraftChange,
  onOpenChange,
}: ReportFilterProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();

  return (
    <SharedReportFilterSheet
      canApply={canApply}
      description={t("report.dailySalesTitle")}
      gridClassName="lg:grid-cols-3"
      loading={loading}
      open={open}
      onApply={onApply}
      onOpenChange={onOpenChange}
    >
      <ReportFilterFields
        branchLoading={branchLoading}
        branchLocked={branchLocked}
        branchOptions={branchOptions}
        detailPaginationBasis={detailPaginationBasis}
        draftFilters={draftFilters}
        idPrefix="report-mobile"
        onDraftChange={onDraftChange}
      />
    </SharedReportFilterSheet>
  );
}

export function MobileReportFilterSummary({
  branchLabel,
  detailPaginationBasis,
  filters,
  onOpen,
}: {
  branchLabel: string;
  detailPaginationBasis: DetailPaginationBasis;
  filters: ReportFilters;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const typeLabel =
    filters.typePage === "bill"
      ? t("report.salesReportByBill")
      : t("report.detailedSalesReport");
  const paymentLabel = paymentMethodLabel(t, filters.paymentMethod);
  const limitCount = isAllPageLimit(filters.limit)
    ? t("common.all")
    : filters.limit;
  const limitLabel =
    filters.typePage === "detail"
      ? detailPaginationBasis === "bills"
        ? t("report.billsPerPageValue", { count: limitCount })
        : t("report.linesPerPageValue", { count: limitCount })
      : t("report.rowsPerPageValue", { count: limitCount });
  const dateRangeLabel = `${filters.dateFrom} - ${filters.dateTo}`;

  return (
    <ReportMobileFilterSummary dateRangeLabel={dateRangeLabel} onOpen={onOpen}
      badges={
        <>
          <Badge className="h-6 max-w-44 truncate border-border bg-muted px-2 text-[11px] text-muted-foreground">
            {branchLabel}
          </Badge>
          <Badge className="h-6 max-w-32 truncate px-2 text-[11px]">
            {typeLabel}
          </Badge>
          <Badge className="h-6 border-border bg-muted px-2 text-[11px] text-muted-foreground">
            {paymentLabel}
          </Badge>
          {filters.search ? (
            <Badge className="h-6 max-w-36 truncate border-border bg-muted px-2 text-[11px] text-muted-foreground">
              {filters.search}
            </Badge>
          ) : null}
          <Badge className="h-6 border-border bg-muted px-2 text-[11px] text-muted-foreground">
            {limitLabel}
          </Badge>
          <Badge className="h-6 border-border bg-muted px-2 text-[11px] text-muted-foreground">
            {reportOrderLabel(t, filters.orderBy)}
          </Badge>
        </>
      }
    />
  );
}

function ReportFilterFields({
  branchLoading,
  branchLocked,
  branchOptions,
  detailPaginationBasis,
  draftFilters,
  idPrefix,
  onDraftChange,
}: {
  branchLoading: boolean;
  branchLocked: boolean;
  branchOptions: ReportBranchOption[];
  detailPaginationBasis: DetailPaginationBasis;
  draftFilters: ReportFilters;
  idPrefix: string;
  onDraftChange: (filters: ReportFilters) => void;
}) {
  const { t } = useTranslation();

  function patch(patch: Partial<ReportFilters>) {
    onDraftChange({ ...draftFilters, ...patch });
  }

  return (
    <>
      <Field className="min-w-0 gap-1.5">
        <FieldLabel
          htmlFor={`${idPrefix}-branch`}
          className="text-xs font-bold text-muted-foreground"
        >
          {t("nav.branch")}
        </FieldLabel>
        <Select
          value={draftFilters.branchUuid}
          disabled={branchLoading || branchLocked || branchOptions.length <= 1}
          onValueChange={(value) => patch({ branchUuid: value })}
        >
          <SelectTrigger id={`${idPrefix}-branch`} className="w-full">
            <SelectValue placeholder={t("nav.branch")} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {branchOptions.map((branch) => (
                <SelectItem key={branch.value} value={branch.value}>
                  {branch.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <Field className="min-w-0 gap-1.5">
        <FieldLabel
          htmlFor={`${idPrefix}-date-from`}
          className="text-xs font-bold text-muted-foreground"
        >
          {t("report.filters.dateFrom")}
        </FieldLabel>
        <Input
          id={`${idPrefix}-date-from`}
          type="date"
          value={draftFilters.dateFrom}
          onChange={(event) => patch({ dateFrom: event.target.value })}
        />
      </Field>
      <Field className="min-w-0 gap-1.5">
        <FieldLabel
          htmlFor={`${idPrefix}-date-to`}
          className="text-xs font-bold text-muted-foreground"
        >
          {t("report.filters.dateTo")}
        </FieldLabel>
        <Input
          id={`${idPrefix}-date-to`}
          type="date"
          value={draftFilters.dateTo}
          onChange={(event) => patch({ dateTo: event.target.value })}
        />
      </Field>
      <Field className="min-w-0 gap-1.5">
        <FieldLabel
          htmlFor={`${idPrefix}-payment-method`}
          className="text-xs font-bold text-muted-foreground"
        >
          {t("report.filters.paymentMethod")}
        </FieldLabel>
        <Select
          value={draftFilters.paymentMethod}
          onValueChange={(value) =>
            patch({ paymentMethod: value as ReportFilters["paymentMethod"] })
          }
        >
          <SelectTrigger id={`${idPrefix}-payment-method`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {paymentMethodOptions.map((method) => (
                <SelectItem key={method} value={method}>
                  {paymentMethodLabel(t, method)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <Field className="min-w-0 gap-1.5">
        <FieldLabel
          htmlFor={`${idPrefix}-order-by`}
          className="text-xs font-bold text-muted-foreground"
        >
          {t("report.filters.orderBy")}
        </FieldLabel>
        <Select
          value={draftFilters.orderBy}
          onValueChange={(value) =>
            patch({ orderBy: value as ReportFilters["orderBy"] })
          }
        >
          <SelectTrigger id={`${idPrefix}-order-by`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {reportOrderOptions(t).map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <Field className="min-w-0 gap-1.5">
        <FieldLabel
          htmlFor={`${idPrefix}-limit`}
          className="text-xs font-bold text-muted-foreground"
        >
          {draftFilters.typePage === "detail"
            ? detailPaginationBasis === "bills"
              ? t("report.billsPerPage")
              : t("report.linesPerPage")
            : t("common.rowsPerPage")}
        </FieldLabel>
        <Select
          value={String(draftFilters.limit)}
          onValueChange={(value) =>
            patch({ limit: value === "All" ? "All" : Number(value) })
          }
        >
          <SelectTrigger id={`${idPrefix}-limit`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {PAGE_LIMIT_OPTIONS.map((limit) => (
                <SelectItem key={String(limit)} value={String(limit)}>
                  {limit === "All" ? t("common.all") : limit}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
    </>
  );
}
