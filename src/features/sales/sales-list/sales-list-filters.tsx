"use client";

import { useState } from "react";
import { Eye, EyeOff, RefreshCcw, SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { FilterHeaderToolbar } from "@/components/common/filter-header-toolbar";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger
} from "@/components/ui/popover";
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
  onSearchChange: (value: string) => void;
  onSummaryToggle: () => void;
  searchText: string;
  summaryControlsId: string;
  summaryVisible: boolean;
}

export function SalesListHeader({
  appliedFilters,
  branchLabel,
  branchLoading,
  branchOptions,
  canApply,
  draftFilters,
  loading,
  searchText,
  summaryControlsId,
  summaryVisible,
  onApply,
  onDraftChange,
  onMobileFiltersOpen,
  onRefresh,
  onSearchChange,
  onSummaryToggle
}: SalesListHeaderProps) {
  const { t } = useTranslation();
  const [desktopFiltersOpen, setDesktopFiltersOpen] = useState(false);

  function applyDesktopFilters() {
    if (!canApply) return;
    onApply();
    setDesktopFiltersOpen(false);
  }

  const dateRangeLabel = `${appliedFilters.dateFrom} - ${appliedFilters.dateTo}`;

  return (
    <FilterHeaderToolbar
      dateRange={{
        ariaLabel: `${t("salesList.filters")}: ${dateRangeLabel}`,
        label: dateRangeLabel,
        onClick: () => setDesktopFiltersOpen(true)
      }}
      filterControl={
        <>
          <SalesListFilterPopover
            branchLabel={branchLabel}
            branchLoading={branchLoading}
            branchOptions={branchOptions}
            canApply={canApply}
            draftFilters={draftFilters}
            loading={loading}
            open={desktopFiltersOpen}
            onApply={applyDesktopFilters}
            onDraftChange={onDraftChange}
            onOpenChange={setDesktopFiltersOpen}
            onRefresh={onRefresh}
          />
          <Button
            type="button"
            variant="outline"
            size="iconSm"
            className="size-11 shrink-0 sm:hidden"
            aria-label={t("salesList.filters")}
            onClick={onMobileFiltersOpen}
          >
            <SlidersHorizontal data-icon="inline-start" />
            <span className="sr-only">{t("salesList.filters")}</span>
          </Button>
        </>
      }
      refreshControl={
        <Button
          type="button"
          variant="outline"
          size="iconSm"
          className="size-11 shrink-0 sm:size-9"
          aria-label={t("actions.refresh")}
          disabled={loading || !canApply}
          onClick={onRefresh}
        >
          <RefreshCcw className={loading ? "animate-spin" : undefined} data-icon="inline-start" />
          <span className="sr-only">{t("actions.refresh")}</span>
        </Button>
      }
      search={{
        ariaLabel: t("actions.search"),
        placeholder: t("actions.search"),
        value: searchText,
        onChange: onSearchChange
      }}
      summaryControl={
        <Button
          type="button"
          variant="outline"
          size="iconSm"
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

interface SalesListFilterPopoverProps extends SalesListFilterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function SalesListFilterPopover({
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
}: SalesListFilterPopoverProps) {
  const { t } = useTranslation();

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="hidden h-9 shrink-0 sm:inline-flex">
          <SlidersHorizontal data-icon="inline-start" />
          {t("salesList.filters")}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="hidden w-[calc(100vw-2rem)] max-w-4xl p-0 sm:block">
        <PopoverHeader className="border-b border-border px-4 py-3">
          <PopoverTitle className="text-sm font-semibold">{t("salesList.filters")}</PopoverTitle>
          <PopoverDescription className="text-xs">{t("salesList.subtitle")}</PopoverDescription>
        </PopoverHeader>
        <div className="grid grid-cols-2 gap-3 p-4 lg:grid-cols-6">
          <SalesListFilterFields
            branchLabel={branchLabel}
            branchLoading={branchLoading}
            branchOptions={branchOptions}
            draftFilters={draftFilters}
            idPrefix="sales-list"
            onDraftChange={onDraftChange}
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <Button type="button" variant="outline" size="sm" className="h-9" disabled={loading || !canApply} onClick={onRefresh}>
            <RefreshCcw className={loading ? "animate-spin" : undefined} data-icon="inline-start" />
            {t("actions.refresh")}
          </Button>
          <Button type="button" size="sm" className="h-9" disabled={loading || !canApply} onClick={onApply}>
            {loading ? <RefreshCcw className="animate-spin" data-icon="inline-start" /> : null}
            {t("salesList.apply")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
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
      <SheetContent side="bottom" className="max-h-[88dvh] gap-0 overflow-hidden rounded-t-xl p-0 sm:hidden">
        <SheetHeader className="shrink-0 border-b border-border px-4 py-3 pr-12 text-left">
          <SheetTitle className="text-base font-semibold">{t("salesList.filters")}</SheetTitle>
          <SheetDescription>{t("salesList.subtitle")}</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 overflow-y-auto p-4">
          <div className="grid gap-3">
            <SalesListFilterFields
              branchLabel={branchLabel}
              branchLoading={branchLoading}
              branchOptions={branchOptions}
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

interface SalesListFilterFieldsProps {
  branchLabel: string;
  branchLoading: boolean;
  branchOptions: SalesListBranchOption[];
  draftFilters: SalesListFilters;
  idPrefix: string;
  onDraftChange: (patch: Partial<SalesListFilters>) => void;
}

function SalesListFilterFields({
  branchLabel,
  branchLoading,
  branchOptions,
  draftFilters,
  idPrefix,
  onDraftChange
}: SalesListFilterFieldsProps) {
  const { t } = useTranslation();

  return (
    <>
      {/* แท็บเล็ต (2 คอลัมน์): สาขากินเต็มแถว วันที่เริ่ม-สิ้นสุดจึงได้อยู่แถวเดียวกัน — จอ lg เป็น 6 คอลัมน์อยู่แล้วจึงคืนเป็น 1 ช่อง */}
      <Field className="gap-1.5 sm:col-span-2 lg:col-span-1">
        <FieldLabel htmlFor={`${idPrefix}-branch`} className="text-xs font-medium text-muted-foreground">
          {t("nav.branch")}
        </FieldLabel>
        <Select
          value={draftFilters.branchUuid}
          disabled={branchLoading || branchOptions.length <= 1}
          onValueChange={(value) => onDraftChange({ branchUuid: value })}
        >
          <SelectTrigger id={`${idPrefix}-branch`} className="h-11 w-full">
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
      <Field className="gap-1.5">
        <FieldLabel htmlFor={`${idPrefix}-date-from`} className="text-xs font-medium text-muted-foreground">
          {t("salesList.dateFrom")}
        </FieldLabel>
        <Input
          id={`${idPrefix}-date-from`}
          className="h-11"
          name={`${idPrefix}-date-from`}
          type="date"
          value={draftFilters.dateFrom}
          onChange={(event) => onDraftChange({ dateFrom: event.target.value })}
        />
      </Field>
      <Field className="gap-1.5">
        <FieldLabel htmlFor={`${idPrefix}-date-to`} className="text-xs font-medium text-muted-foreground">
          {t("salesList.dateTo")}
        </FieldLabel>
        <Input
          id={`${idPrefix}-date-to`}
          className="h-11"
          name={`${idPrefix}-date-to`}
          type="date"
          value={draftFilters.dateTo}
          onChange={(event) => onDraftChange({ dateTo: event.target.value })}
        />
      </Field>
      <Field className="gap-1.5">
        <FieldLabel htmlFor={`${idPrefix}-limit`} className="text-xs font-medium text-muted-foreground">
          {t("common.rowsPerPage")}
        </FieldLabel>
        <Select
          value={String(draftFilters.limit)}
          onValueChange={(value) => onDraftChange({ limit: Number(value) as PageLimit })}
        >
          <SelectTrigger id={`${idPrefix}-limit`} className="h-11 w-full">
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
          <SelectTrigger id={`${idPrefix}-payment-method`} className="h-11 w-full">
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
          <SelectTrigger id={`${idPrefix}-order`} className="h-11 w-full">
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
