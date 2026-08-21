"use client";

import { Eye, EyeOff, RefreshCcw, SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { FilterHeaderToolbar } from "@/components/common/filter-header-toolbar";
import { SearchInput } from "@/components/common/search-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { ReportDateInput } from "@/features/report/shared/report-date-input";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { DailySaleItemsOrder } from "@/services/report";
import type { PageLimit } from "@/services/shared/types";
import {
  SALES_LIST_LIMIT_OPTIONS,
  SALES_LIST_ORDER_OPTIONS,
  SALES_LIST_PAYMENT_METHOD_OPTIONS,
  paymentMethodLabel,
  type SalesListBranchOption,
  type SalesListFilters,
  type SalesListPaymentMethod
} from "./sales-list-utils";

// เงื่อนไข "ไม่ใช่ค่าเริ่มต้น" ของฟิลด์รอง — ใช้ตัดสินว่าจะโชว์ badge บอกจำนวนตัวกรองที่ซ่อนอยู่ใน popover หรือไม่
function secondaryFilterCount(filters: SalesListFilters) {
  let count = 0;
  if (filters.limit !== SALES_LIST_LIMIT_OPTIONS[0]) count += 1;
  if (filters.paymentMethod !== "All") count += 1;
  if (filters.orderBy !== "DESC") count += 1;
  return count;
}

interface SalesListFilterProps {
  branchLabel: string;
  branchLoading: boolean;
  branchOptions: SalesListBranchOption[];
  canApply: boolean;
  draftFilters: SalesListFilters;
  loading: boolean;
  onApply: () => void;
  onDraftChange: (patch: Partial<SalesListFilters>) => void;
  onRefresh: () => void;
}

interface SalesListHeaderProps extends SalesListFilterProps {
  appliedFilters: SalesListFilters;
  onMobileFiltersOpen: () => void;
  onSummaryToggle: () => void;
  summaryControlsId: string;
  summaryVisible: boolean;
}

export function SalesListHeader({
  appliedFilters,
  canApply,
  loading,
  summaryControlsId,
  summaryVisible,
  onMobileFiltersOpen,
  onRefresh,
  onSummaryToggle
}: SalesListHeaderProps) {
  const { t } = useTranslation();
  const dateRangeLabel = `${appliedFilters.dateFrom} - ${appliedFilters.dateTo}`;

  return (
    <FilterHeaderToolbar
      dateRange={{
        ariaLabel: `${t("salesList.filters")}: ${dateRangeLabel}`,
        label: dateRangeLabel,
        onClick: onMobileFiltersOpen
      }}
      filterControl={
        // จอ lg ขึ้นไปมีแถบตัวกรองอยู่บนหน้าแล้ว ปุ่มนี้จึงเหลือไว้ให้จอเล็กที่ยังใช้ sheet
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="size-11 shrink-0 sm:size-9 lg:hidden"
          aria-label={t("salesList.filters")}
          onClick={onMobileFiltersOpen}
        >
          <SlidersHorizontal data-icon="inline-start" />
          <span className="sr-only">{t("salesList.filters")}</span>
        </Button>
      }
      refreshControl={
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="size-11 shrink-0 sm:size-9"
          aria-label={t("actions.refresh")}
          disabled={loading || !canApply}
          onClick={onRefresh}
        >
          <RefreshCcw className={loading ? "animate-spin" : undefined} data-icon="inline-start" />
          <span className="sr-only">{t("actions.refresh")}</span>
        </Button>
      }
      summaryControl={
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="size-11 shrink-0 sm:size-9"
          aria-controls={summaryControlsId}
          aria-expanded={summaryVisible}
          aria-label={summaryVisible ? t("report.hideSummary") : t("report.showSummary")}
          onClick={onSummaryToggle}
        >
          {summaryVisible ? <EyeOff data-icon="inline-start" /> : <Eye data-icon="inline-start" />}
          <span className="sr-only">{summaryVisible ? t("report.hideSummary") : t("report.showSummary")}</span>
        </Button>
      }
    />
  );
}

// จอ lg ขึ้นไปกรองได้จากหน้าเลย — เหลือแค่ฟิลด์หลักที่ใช้บ่อย (ค้นหา/สาขา/ช่วงวันที่) ตลอดเวลา
// ส่วนฟิลด์รอง (จำนวนแถว/วิธีชำระ/เรียงลำดับ) ย้ายเข้า popover กันแถบยาวเกินไปจนดูอึดอัด
export function SalesListFilterBar({
  branchLabel,
  branchLoading,
  branchOptions,
  canApply,
  draftFilters,
  loading,
  onApply,
  onDraftChange
}: SalesListFilterProps) {
  const { t } = useTranslation();
  const secondaryCount = secondaryFilterCount(draftFilters);

  // Card ฐานมี py-(--card-spacing) ของตัวเอง (16px) ถ้าไม่ล้างด้วย py-0 จะบวกซ้อนกับ py ของ CardContent
  // ด้านล่างอีกชั้น กลายเป็นช่องว่างเหนือแถบตัวกรองใหญ่เกินจริง — ให้ CardContent คุมระยะในเพียงจุดเดียว
  return (
    <Card className="hidden min-w-0 shrink-0 rounded-none border-x-0 border-t-0 border-border bg-card py-0 shadow-none lg:block">
      <CardContent className="flex min-w-0 flex-wrap items-end gap-3 px-3 py-2.5">
        <SalesListPrimaryFields
          branchLabel={branchLabel}
          branchLoading={branchLoading}
          branchOptions={branchOptions}
          draftFilters={draftFilters}
          idPrefix="sales-list"
          onDraftChange={onDraftChange}
          onSearchEnter={onApply}
        />

        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" className="relative h-9">
              <SlidersHorizontal data-icon="inline-start" />
              {t("salesList.moreFilters")}
              {secondaryCount ? (
                <Badge className="ml-1 h-4.5 min-w-4.5 justify-center rounded-full border-transparent bg-primary px-1 text-[10px] text-primary-foreground">
                  {secondaryCount}
                </Badge>
              ) : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72">
            <PopoverTitle>{t("salesList.moreFilters")}</PopoverTitle>
            <div className="grid gap-3">
              <SalesListSecondaryFields
                draftFilters={draftFilters}
                idPrefix="sales-list"
                onDraftChange={onDraftChange}
              />
            </div>
          </PopoverContent>
        </Popover>

        <Button type="button" className="h-9 min-w-24" disabled={loading || !canApply} onClick={onApply}>
          {loading ? <RefreshCcw className="animate-spin" data-icon="inline-start" /> : null}
          {t("salesList.apply")}
        </Button>
      </CardContent>
    </Card>
  );
}

interface SalesListFilterSheetProps extends SalesListFilterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SalesListFilterSheet({
  branchLabel,
  branchLoading,
  branchOptions,
  canApply,
  draftFilters,
  loading,
  open,
  onApply,
  onDraftChange,
  onOpenChange,
  onRefresh
}: SalesListFilterSheetProps) {
  const { t } = useTranslation();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[88dvh] gap-0 overflow-hidden rounded-t-xl p-0 lg:hidden">
        <SheetHeader className="shrink-0 border-b border-border px-4 py-3 pr-12 text-left">
          <SheetTitle className="text-base font-semibold">{t("salesList.filters")}</SheetTitle>
          <SheetDescription>{t("salesList.subtitle")}</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 overflow-y-auto p-4">
          <div className="grid gap-3">
            <SalesListPrimaryFields
              branchLabel={branchLabel}
              branchLoading={branchLoading}
              branchOptions={branchOptions}
              draftFilters={draftFilters}
              idPrefix="sales-list-mobile"
              onDraftChange={onDraftChange}
              onSearchEnter={onApply}
            />
            <SalesListSecondaryFields
              draftFilters={draftFilters}
              idPrefix="sales-list-mobile"
              onDraftChange={onDraftChange}
            />
          </div>
        </div>
        <SheetFooter className="grid grid-cols-3 gap-2 border-t border-border bg-card/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
          <SheetClose asChild>
            <Button type="button" variant="outline">
              {t("actions.close")}
            </Button>
          </SheetClose>
          <Button type="button" variant="outline" disabled={loading || !canApply} onClick={onRefresh}>
            <RefreshCcw className={loading ? "animate-spin" : undefined} data-icon="inline-start" />
            {t("actions.refresh")}
          </Button>
          <Button type="button" disabled={loading || !canApply} onClick={onApply}>
            {loading ? <RefreshCcw className="animate-spin" data-icon="inline-start" /> : null}
            {t("salesList.apply")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

interface SalesListPrimaryFieldsProps {
  branchLabel: string;
  branchLoading: boolean;
  branchOptions: SalesListBranchOption[];
  draftFilters: SalesListFilters;
  idPrefix: string;
  onDraftChange: (patch: Partial<SalesListFilters>) => void;
  onSearchEnter?: () => void;
}

// ฟิลด์ที่ใช้บ่อยที่สุด — โชว์ตลอดทั้งบนแถบ desktop และ sheet มือถือ
function SalesListPrimaryFields({
  branchLabel,
  branchLoading,
  branchOptions,
  draftFilters,
  idPrefix,
  onDraftChange,
  onSearchEnter
}: SalesListPrimaryFieldsProps) {
  const { t } = useTranslation();

  return (
    <>
      <Field className="min-w-48 flex-1 gap-1.5 sm:col-span-2 lg:col-span-1">
        <FieldLabel htmlFor={`${idPrefix}-search`} className="text-xs font-medium text-muted-foreground">
          {t("actions.search")}
        </FieldLabel>
        <SearchInput
          id={`${idPrefix}-search`}
          ariaLabel={t("actions.search")}
          placeholder={t("actions.search")}
          value={draftFilters.search}
          onChange={(value) => onDraftChange({ search: value })}
          onEnter={onSearchEnter}
          className="h-11 bg-background lg:h-9"
        />
      </Field>
      {/* แท็บเล็ต (2 คอลัมน์): สาขากินเต็มแถว วันที่เริ่ม-สิ้นสุดจึงได้อยู่แถวเดียวกัน */}
      <Field className="gap-1.5 sm:col-span-2 lg:w-52 lg:flex-none">
        <FieldLabel htmlFor={`${idPrefix}-branch`} className="text-xs font-medium text-muted-foreground">
          {t("nav.branch")}
        </FieldLabel>
        <Select
          value={draftFilters.branchUuid}
          disabled={branchLoading || branchOptions.length <= 1}
          onValueChange={(value) => onDraftChange({ branchUuid: value })}
        >
          <SelectTrigger id={`${idPrefix}-branch`} className="h-11 w-full data-[size=default]:h-11 lg:h-9">
            <SelectValue placeholder={branchLabel || t("nav.branch")} />
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
      <Field className="gap-1.5 lg:w-40 lg:flex-none">
        <FieldLabel htmlFor={`${idPrefix}-date-from`} className="text-xs font-medium text-muted-foreground">
          {t("salesList.dateFrom")}
        </FieldLabel>
        <ReportDateInput
          id={`${idPrefix}-date-from`}
          label={t("salesList.dateFrom")}
          value={draftFilters.dateFrom}
          onValueChange={(dateFrom) => onDraftChange({ dateFrom })}
          className="h-11 lg:h-9"
        />
      </Field>
      <Field className="gap-1.5 lg:w-40 lg:flex-none">
        <FieldLabel htmlFor={`${idPrefix}-date-to`} className="text-xs font-medium text-muted-foreground">
          {t("salesList.dateTo")}
        </FieldLabel>
        <ReportDateInput
          id={`${idPrefix}-date-to`}
          label={t("salesList.dateTo")}
          value={draftFilters.dateTo}
          onValueChange={(dateTo) => onDraftChange({ dateTo })}
          className="h-11 lg:h-9"
        />
      </Field>
    </>
  );
}

interface SalesListSecondaryFieldsProps {
  draftFilters: SalesListFilters;
  idPrefix: string;
  onDraftChange: (patch: Partial<SalesListFilters>) => void;
}

// ฟิลด์ที่ใช้น้อยกว่า — desktop ซ่อนไว้ใน popover "ตัวกรองเพิ่มเติม", มือถือต่อท้ายฟิลด์หลักใน sheet เดิม
function SalesListSecondaryFields({
  draftFilters,
  idPrefix,
  onDraftChange
}: SalesListSecondaryFieldsProps) {
  const { t } = useTranslation();

  return (
    <>
      <Field className="gap-1.5">
        <FieldLabel htmlFor={`${idPrefix}-limit`} className="text-xs font-medium text-muted-foreground">
          {t("common.rowsPerPage")}
        </FieldLabel>
        <Select
          value={String(draftFilters.limit)}
          onValueChange={(value) => onDraftChange({ limit: Number(value) as PageLimit })}
        >
          <SelectTrigger id={`${idPrefix}-limit`} className="h-11 w-full data-[size=default]:h-11 lg:h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {SALES_LIST_LIMIT_OPTIONS.map((limit) => (
                <SelectItem key={String(limit)} value={String(limit)}>
                  {limit}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <Field className="gap-1.5">
        <FieldLabel htmlFor={`${idPrefix}-payment-method`} className="text-xs font-medium text-muted-foreground">
          {t("salesList.paymentMethod")}
        </FieldLabel>
        <Select
          value={draftFilters.paymentMethod}
          onValueChange={(value) => onDraftChange({ paymentMethod: value as SalesListPaymentMethod })}
        >
          <SelectTrigger id={`${idPrefix}-payment-method`} className="h-11 w-full data-[size=default]:h-11 lg:h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {SALES_LIST_PAYMENT_METHOD_OPTIONS.map((paymentMethod) => (
                <SelectItem key={paymentMethod} value={paymentMethod}>
                  {paymentMethodLabel(paymentMethod, t)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <Field className="gap-1.5">
        <FieldLabel htmlFor={`${idPrefix}-order`} className="text-xs font-medium text-muted-foreground">
          {t("salesList.orderBy")}
        </FieldLabel>
        <Select
          value={draftFilters.orderBy}
          onValueChange={(value) => onDraftChange({ orderBy: value as DailySaleItemsOrder })}
        >
          <SelectTrigger id={`${idPrefix}-order`} className="h-11 w-full data-[size=default]:h-11 lg:h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {SALES_LIST_ORDER_OPTIONS.map((order) => (
                <SelectItem key={order} value={order}>
                  {t(order === "ASC" ? "common.oldestFirst" : "common.newestFirst")}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
    </>
  );
}
