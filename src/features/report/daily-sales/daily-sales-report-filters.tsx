"use client";

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { SearchInput } from "@/components/common/search-input";
import { Badge } from "@/components/ui/badge";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PAGE_LIMIT_OPTIONS, isAllPageLimit } from "@/lib/pagination";
import { reportOrderLabel, reportOrderOptions } from "../shared/report-sort-utils";
import { ReportDateInput } from "../shared/report-date-input";
import { ReportFilterCard, ReportFilterSheet } from "../shared/report-filter-shell";
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

// จอ lg ขึ้นไปมีที่ว่างพอให้ตัวกรองอยู่บนหน้าเลย ไม่ต้องเปิด modal เพื่อเปลี่ยนแค่สาขา
// (ก่อนหน้านี้คอมโพเนนต์นี้ถูกเขียนไว้แต่ไม่มีใครเรียก ทุกขนาดจอจึงถูกบังคับให้ใช้ modal)
export function DailySalesFilterBar({
  actions,
  branchLoading,
  branchLocked,
  branchOptions,
  canApply,
  detailPaginationBasis,
  draftFilters,
  loading,
  onApply,
  onDraftChange,
}: ReportFilterProps & { actions?: ReactNode }) {
  return (
    <ReportFilterCard
      actions={actions}
      canApply={canApply}
      className="hidden shrink-0 rounded-none border-x-0 border-t-0 shadow-none lg:block"
      contentClassName="grid min-w-0 items-end gap-3 px-3 py-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-[repeat(7,minmax(0,1fr))_auto]"
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

export function DailySalesFilterSheet({
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
    <ReportFilterSheet
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
    </ReportFilterSheet>
  );
}

// จอเล็กยังต้องใช้ modal แต่ต้องอ่านออกได้ว่า "ตอนนี้กรองอะไรอยู่" โดยไม่ต้องเปิดเข้าไปดู
// เดิมมีคอมโพเนนต์ทำหน้าที่นี้อยู่แล้วแต่ไม่มีใครเรียก และยังซ้ำกับ FilterHeaderToolbar
// (ปุ่มวันที่/ปุ่มเปิดตัวกรอง) จึงเหลือไว้แค่ส่วนที่ให้ข้อมูลจริงคือแถว badge
export function AppliedFilterBadges({
  branchLabel,
  detailPaginationBasis,
  filters,
}: {
  branchLabel: string;
  detailPaginationBasis: DetailPaginationBasis;
  filters: ReportFilters;
}) {
  const { t } = useTranslation();
  const limitCount = isAllPageLimit(filters.limit) ? t("common.all") : filters.limit;
  const limitLabel =
    filters.typePage === "detail"
      ? detailPaginationBasis === "bills"
        ? t("report.billsPerPageValue", { count: limitCount })
        : t("report.linesPerPageValue", { count: limitCount })
      : t("report.rowsPerPageValue", { count: limitCount });
  const badges = [
    branchLabel,
    paymentMethodLabel(t, filters.paymentMethod),
    reportOrderLabel(t, filters.orderBy),
    limitLabel,
    filters.search
  ].filter(Boolean);

  return (
    <div className="flex min-w-0 flex-wrap gap-1.5">
      {badges.map((label) => (
        <Badge
          key={label}
          className="h-6 max-w-44 truncate border-border bg-muted px-2 text-xs font-normal text-muted-foreground"
        >
          {label}
        </Badge>
      ))}
    </div>
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
      {/* ค้นหาเป็นตัวกรองปกติ = มีผลตอนกดปุ่ม "ໃຊ້" เหมือนช่องอื่น (เดิมอยู่หัวตารางและกรองทันทีที่พิมพ์) */}
      <Field className="min-w-0 gap-1.5">
        <FieldLabel htmlFor={`${idPrefix}-search`} className="text-xs font-medium text-muted-foreground">
          {t("actions.search")}
        </FieldLabel>
        <SearchInput
          id={`${idPrefix}-search`}
          ariaLabel={t("actions.search")}
          placeholder={t("actions.search")}
          value={draftFilters.search}
          onChange={(value) => patch({ search: value })}
        />
      </Field>
      <Field className="min-w-0 gap-1.5">
        <FieldLabel
          htmlFor={`${idPrefix}-branch`}
          className="text-xs font-medium text-muted-foreground"
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
          className="text-xs font-medium text-muted-foreground"
        >
          {t("report.filters.dateFrom")}
        </FieldLabel>
        <ReportDateInput
          id={`${idPrefix}-date-from`}
          label={t("report.filters.dateFrom")}
          value={draftFilters.dateFrom}
          onValueChange={(dateFrom) => patch({ dateFrom })}
        />
      </Field>
      <Field className="min-w-0 gap-1.5">
        <FieldLabel
          htmlFor={`${idPrefix}-date-to`}
          className="text-xs font-medium text-muted-foreground"
        >
          {t("report.filters.dateTo")}
        </FieldLabel>
        <ReportDateInput
          id={`${idPrefix}-date-to`}
          label={t("report.filters.dateTo")}
          value={draftFilters.dateTo}
          onValueChange={(dateTo) => patch({ dateTo })}
        />
      </Field>
      <Field className="min-w-0 gap-1.5">
        <FieldLabel
          htmlFor={`${idPrefix}-payment-method`}
          className="text-xs font-medium text-muted-foreground"
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
          className="text-xs font-medium text-muted-foreground"
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
          className="text-xs font-medium text-muted-foreground"
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
