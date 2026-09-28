"use client";

import { useState } from "react";
import { CalendarDays, Info, RefreshCcw, SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppPagination } from "@/components/common/app-pagination";
import { FilterHeaderToolbar } from "@/components/common/filter-header-toolbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import type { PageLimit, SortOrder } from "@/services/shared/types";
import {
  SALES_LIST_LIMIT_OPTIONS,
  orderOptions,
  type CancelDateChoice
} from "./cancel-sale-utils";

export function SalesListToolbar({
  dateChoices,
  dateSelect,
  limit,
  loading,
  orderBy,
  onDateChange,
  onLimitChange,
  onOrderChange,
  onRefresh
}: {
  dateChoices: CancelDateChoice[];
  dateSelect: string;
  limit: PageLimit;
  loading: boolean;
  orderBy: SortOrder;
  onDateChange: (value: string) => void;
  onLimitChange: (value: string) => void;
  onOrderChange: (value: SortOrder) => void;
  onRefresh: () => void;
}) {
  const { t } = useTranslation();
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const filterLabel = t("settings.filterTitle");
  const currentDateLabel = (dateChoices.find((choice) => choice.value === dateSelect) ?? dateChoices[0])?.label ?? "";

  // ยกเลิกได้แค่วันนี้/เมื่อวาน — ปุ่มสลับเห็นตัวเลือกทั้งหมดทันทีและกดครั้งเดียว
  // แทน dropdown ที่ต้องกดเปิดก่อนทั้งที่มีแค่ 2 ค่า
  function renderDateToggle(itemClassName: string) {
    return (
      <ToggleGroup
        aria-label={t("cancelSale.dateFilter")}
        type="single"
        value={dateSelect}
        onValueChange={(value) => {
          if (value && value !== dateSelect) onDateChange(value);
        }}
        className="w-full gap-1 rounded-lg border border-border bg-muted p-1"
      >
        {dateChoices.map((choice) => (
          <ToggleGroupItem
            key={choice.value}
            value={choice.value}
            className={cn(
              "flex-1 rounded-md px-3 font-semibold data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm",
              itemClassName
            )}
          >
            <CalendarDays data-icon="inline-start" />
            {choice.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
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
                {t(option === "ASC" ? "common.oldestFirst" : "common.newestFirst")}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    );
  }

  return (
    <>
      {/* จอ lg ขึ้นไปมีแถบตัวกรองอยู่บนหน้าแล้ว แถบนี้จึงเหลือไว้ให้จอเล็กที่ยังใช้ sheet — โครงเดียวกับ sales-list */}
      <div className="shrink-0 border-b border-border bg-card px-2 py-2 sm:px-3 lg:hidden">
        <FilterHeaderToolbar
          dateRange={{
            ariaLabel: `${t("cancelSale.dateFilter")}: ${currentDateLabel}`,
            label: currentDateLabel,
            onClick: () => setMobileFilterOpen(true)
          }}
          filterControl={
            <Button
              aria-label={filterLabel}
              className="size-11 shrink-0 sm:size-9"
              size="icon-sm"
              type="button"
              variant="outline"
              onClick={() => setMobileFilterOpen(true)}
            >
              <SlidersHorizontal data-icon="inline-start" />
              <span className="sr-only">{filterLabel}</span>
            </Button>
          }
          refreshControl={
            <Button
              aria-label={t("actions.refresh")}
              className="size-11 shrink-0 sm:size-9"
              disabled={loading}
              size="icon-sm"
              type="button"
              variant="outline"
              onClick={onRefresh}
            >
              <RefreshCcw className={loading ? "animate-spin" : undefined} data-icon="inline-start" />
              <span className="sr-only">{t("actions.refresh")}</span>
            </Button>
          }
        />
      </div>

      {/* py-0 กัน py ฐานของ Card (16px) บวกซ้อนกับ py ของ CardContent ด้านล่าง — ดู sales-list-filters.tsx */}
      <Card className="hidden min-w-0 shrink-0 rounded-none border-x-0 border-t-0 border-border bg-card py-0 shadow-none lg:block">
        <CardContent className="flex min-w-0 items-center gap-2 px-3 py-2.5">
          <div className="w-64 flex-none xl:w-72">{renderDateToggle("h-7")}</div>
          <div className="w-24 flex-none">{renderLimitSelect("cancel-sale-desktop-limit", "h-9")}</div>
          <div className="w-36 flex-none">{renderOrderSelect("cancel-sale-desktop-order", "h-9")}</div>
          {/* บอกกติกาไว้ตั้งแต่ก่อนเลือกบิล — เดิมรู้ว่ายกเลิกไม่ได้ก็ต่อเมื่อเจอปุ่มที่ถูกปิดไว้แล้ว */}
          <p className="ml-2 hidden min-w-0 flex-1 items-center gap-1.5 text-xs text-muted-foreground xl:flex">
            <Info aria-hidden="true" className="size-3.5 shrink-0" />
            <span className="truncate">{t("cancelSale.cancelUnavailable")}</span>
          </p>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="ml-auto size-9 shrink-0"
            aria-label={t("actions.refresh")}
            title={t("actions.refresh")}
            disabled={loading}
            onClick={onRefresh}
          >
            <RefreshCcw className={loading ? "animate-spin" : undefined} />
          </Button>
        </CardContent>
      </Card>

      <Sheet open={mobileFilterOpen} onOpenChange={setMobileFilterOpen}>
        <SheetContent className="max-h-[85dvh] gap-0 overflow-hidden rounded-t-xl p-0 lg:hidden" side="bottom">
          <SheetHeader className="border-b border-border px-4 py-3 pr-12 text-left">
            <SheetTitle>{filterLabel}</SheetTitle>
            <SheetDescription>{t("cancelSale.cancelUnavailable")}</SheetDescription>
          </SheetHeader>
          <div className="grid gap-4 overflow-y-auto px-4 py-4">
            <Field className="gap-2">
              <FieldLabel>{t("cancelSale.dateFilter")}</FieldLabel>
              {renderDateToggle("h-10")}
            </Field>
            <Field className="gap-2">
              <FieldLabel htmlFor="cancel-sale-mobile-limit">{t("common.rowsPerPage")}</FieldLabel>
              {renderLimitSelect("cancel-sale-mobile-limit", "h-11")}
            </Field>
            <Field className="gap-2">
              <FieldLabel htmlFor="cancel-sale-mobile-order">{t("common.order")}</FieldLabel>
              {renderOrderSelect("cancel-sale-mobile-order", "h-11")}
            </Field>
          </div>
          <SheetFooter className="border-t border-border px-4 py-3 pb-[calc(0.75rem+var(--pos-system-bottom-safe-area,0px))]">
            <SheetClose asChild>
              <Button type="button" variant="outline">
                {t("actions.close")}
              </Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

export function SalesListPaginationFooter({
  loading,
  onPageChange,
  page,
  pageEnd,
  pageStart,
  total,
  totalPages
}: {
  loading: boolean;
  onPageChange: (page: number) => void;
  page: number;
  pageEnd: number;
  pageStart: number;
  total: number;
  totalPages: number;
}) {
  const { t } = useTranslation();

  return (
    <div className="shrink-0 border-t border-border bg-muted/20 px-3 py-2.5 pb-[calc(0.625rem+max(var(--pos-system-bottom-safe-area,0px),var(--app-shell-bottom-nav-height,0px)))] text-sm text-muted-foreground sm:px-4 sm:py-3">
      <AppPagination
        disabled={loading}
        page={page}
        rangeLabel={t("common.showingRange", { start: pageStart, end: pageEnd, total })}
        totalPages={totalPages}
        onPageChange={onPageChange}
      />
    </div>
  );
}
