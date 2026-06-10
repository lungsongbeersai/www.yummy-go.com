"use client";

import { Check, ChevronLeft, ChevronRight, ReceiptText, RefreshCcw, SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { CancelableDateOption } from "@/services/cancel";
import type { PageLimit, SortOrder } from "@/services/shared/types";
import {
  SALES_LIST_LIMIT_OPTIONS,
  dateOptionLabel,
  dateOptionValue,
  orderOptions
} from "./sales-list-utils";

export function SalesListHeader({ loading, onRefresh }: { loading: boolean; onRefresh: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 lg:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <div className="hidden size-10 shrink-0 items-center justify-center rounded-md border border-border bg-card text-primary sm:flex">
          <ReceiptText />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-bold uppercase text-muted-foreground">{t("nav.sales")}</div>
          <h1 className="truncate text-xl font-black leading-tight">{t("cancelSale.title")}</h1>
          <p className="hidden max-w-2xl truncate text-xs text-muted-foreground md:block">{t("cancelSale.subtitle")}</p>
        </div>
      </div>
      <Button disabled={loading} size="sm" type="button" variant="outline" onClick={onRefresh}>
        {loading ? <Spinner data-icon="inline-start" /> : <RefreshCcw data-icon="inline-start" />}
        {t("actions.refresh")}
      </Button>
    </div>
  );
}

export function SalesListToolbar({
  dateOptions,
  dateSelect,
  limit,
  orderBy,
  onDateChange,
  onLimitChange,
  onOrderChange
}: {
  dateOptions: CancelableDateOption[];
  dateSelect: string;
  limit: PageLimit;
  orderBy: SortOrder;
  onDateChange: (value: string) => void;
  onLimitChange: (value: string) => void;
  onOrderChange: (value: SortOrder) => void;
}) {
  const { t } = useTranslation();
  const filterLabel = t("settings.filterTitle");

  function renderDateSelect(id: string, triggerClassName: string) {
    return (
      <Select value={dateSelect} onValueChange={onDateChange}>
        <SelectTrigger id={id} aria-label={t("cancelSale.dateFilter")} className={cn("w-full font-semibold", triggerClassName)}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper">
          <SelectGroup>
            {dateOptions.map((option) => {
              const value = dateOptionValue(option);
              return value ? (
                <SelectItem key={value} value={value}>
                  {dateOptionLabel(option)}
                </SelectItem>
              ) : null;
            })}
          </SelectGroup>
        </SelectContent>
      </Select>
    );
  }

  function renderLimitSelect(id: string, triggerClassName: string) {
    return (
      <Select value={String(limit)} onValueChange={onLimitChange}>
        <SelectTrigger id={id} aria-label={t("common.rowsPerPage")} className={cn("w-full font-semibold", triggerClassName)}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper">
          <SelectGroup>
            {SALES_LIST_LIMIT_OPTIONS.map((option) => (
              <SelectItem key={option} value={String(option)}>
                {option}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    );
  }

  function renderOrderSelect(id: string, triggerClassName: string) {
    return (
      <Select value={String(orderBy)} onValueChange={(value) => onOrderChange(value as SortOrder)}>
        <SelectTrigger id={id} aria-label={t("common.order")} className={cn("w-full font-semibold", triggerClassName)}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper">
          <SelectGroup>
            {orderOptions.map((option) => (
              <SelectItem key={option} value={option}>
                {t(`common.${option.toLowerCase()}`)}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    );
  }

  return (
    <div className="shrink-0 border-b border-border bg-card px-3 py-2.5 sm:px-4 lg:px-5">
      <div className="grid w-full grid-cols-[minmax(0,1fr)_2.75rem] items-center gap-2 lg:hidden">
        {renderDateSelect("sales-list-mobile-date", "h-10")}
        <Sheet>
          <SheetTrigger asChild>
            <Button aria-label={filterLabel} className="size-10 px-0" type="button" variant="outline">
              <SlidersHorizontal />
            </Button>
          </SheetTrigger>
          <SheetContent className="max-h-[85dvh] gap-0 overflow-hidden rounded-t-lg p-0" side="bottom">
            <SheetHeader className="border-b border-border px-4 py-3 pr-12 text-left">
              <SheetTitle>{filterLabel}</SheetTitle>
              <SheetDescription>{t("settings.filterDescription")}</SheetDescription>
            </SheetHeader>
            <div className="grid gap-4 overflow-y-auto px-4 py-4">
              <Field className="gap-2">
                <FieldLabel htmlFor="sales-list-mobile-limit">{t("common.rowsPerPage")}</FieldLabel>
                {renderLimitSelect("sales-list-mobile-limit", "h-11")}
              </Field>
              <Field className="gap-2">
                <FieldLabel htmlFor="sales-list-mobile-order">{t("common.order")}</FieldLabel>
                {renderOrderSelect("sales-list-mobile-order", "h-11")}
              </Field>
            </div>
            <SheetFooter className="border-t border-border px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:flex-row">
              <SheetClose asChild>
                <Button type="button" variant="outline">
                  {t("actions.cancel")}
                </Button>
              </SheetClose>
              <SheetClose asChild>
                <Button type="button">
                  <Check data-icon="inline-start" />
                  {t("actions.apply")}
                </Button>
              </SheetClose>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      <div className="hidden w-full min-w-0 items-center gap-2 lg:flex">
        <div className="w-[18rem] max-w-full flex-none xl:w-[20rem]">{renderDateSelect("sales-list-desktop-date", "h-8")}</div>
        <div className="ml-auto w-28 flex-none">{renderLimitSelect("sales-list-desktop-limit", "h-8")}</div>
        <div className="w-28 flex-none">{renderOrderSelect("sales-list-desktop-order", "h-8")}</div>
      </div>
    </div>
  );
}

export function SalesListPaginationFooter({
  canGoBack,
  canGoNext,
  loading,
  onBack,
  onNext,
  page,
  pageEnd,
  pageStart,
  total,
  totalPages
}: {
  canGoBack: boolean;
  canGoNext: boolean;
  loading: boolean;
  onBack: () => void;
  onNext: () => void;
  page: number;
  pageEnd: number;
  pageStart: number;
  total: number;
  totalPages: number;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex shrink-0 flex-col gap-2 border-t border-border px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <span>{t("common.showingRange", { start: pageStart, end: pageEnd, total })}</span>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:flex">
        <Button className="min-w-0" disabled={!canGoBack || loading} size="xs" type="button" variant="outline" onClick={onBack}>
          <ChevronLeft data-icon="inline-start" />
          {t("actions.back")}
        </Button>
        <Badge className="h-7 px-2 text-xs tabular-nums">
          {t("common.page", { current: page, total: totalPages })}
        </Badge>
        <Button className="min-w-0" disabled={!canGoNext || loading} size="xs" type="button" variant="outline" onClick={onNext}>
          {t("common.nextPage")}
          <ChevronRight data-icon="inline-end" />
        </Button>
      </div>
    </div>
  );
}
