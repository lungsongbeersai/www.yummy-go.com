"use client";

import { RefreshCcw, SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { FilterHeaderToolbar } from "@/components/common/filter-header-toolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ReportDateInput, reportDateDisplayValue } from "@/features/report/shared/report-date-input";
import { cn } from "@/lib/utils";
import type { CancelHistoryOrder } from "@/services/cancel";
import type { PageLimit } from "@/services/shared/types";
import {
  CANCEL_HISTORY_LIMIT_OPTIONS,
  CANCEL_HISTORY_ORDER_OPTIONS,
  CANCEL_HISTORY_PRESETS,
  type CancelHistoryFilters,
  type CancelHistoryPreset
} from "./cancel-history-utils";

interface CancelHistoryFilterProps {
  /** ช่วงที่ตรงกับวันที่ใน draft — null เมื่อเลือกวันที่เอง */
  activePreset: CancelHistoryPreset | null;
  canApply: boolean;
  draftFilters: CancelHistoryFilters;
  loading: boolean;
  onApply: () => void;
  onDraftChange: (patch: Partial<CancelHistoryFilters>) => void;
  onPreset: (preset: CancelHistoryPreset) => void;
  onRefresh: () => void;
}

// เงื่อนไข "ไม่ใช่ค่าเริ่มต้น" ของฟิลด์ใน popover — ใช้โชว์ badge บอกว่ามีตัวกรองซ่อนอยู่ (แบบ sales-list)
function secondaryFilterCount(filters: CancelHistoryFilters) {
  let count = 0;
  if (filters.limit !== CANCEL_HISTORY_LIMIT_OPTIONS[0]) count += 1;
  if (filters.orderBy !== "DESC") count += 1;
  return count;
}

export function CancelHistoryMobileHeader({
  appliedFilters,
  loading,
  onOpenFilters,
  onRefresh
}: {
  appliedFilters: CancelHistoryFilters;
  loading: boolean;
  onOpenFilters: () => void;
  onRefresh: () => void;
}) {
  const { t } = useTranslation();
  const label = `${reportDateDisplayValue(appliedFilters.startDate)} - ${reportDateDisplayValue(appliedFilters.endDate)}`;

  return (
    <div className="shrink-0 border-b border-border bg-card px-2 py-2 sm:px-3 lg:hidden">
      <FilterHeaderToolbar
        dateRange={{ ariaLabel: `${t("cancelHistory.filters")}: ${label}`, label, onClick: onOpenFilters }}
        filterControl={
          <Button
            aria-label={t("cancelHistory.filters")}
            className="size-11 shrink-0 sm:size-9"
            size="icon-sm"
            type="button"
            variant="outline"
            onClick={onOpenFilters}
          >
            <SlidersHorizontal data-icon="inline-start" />
            <span className="sr-only">{t("cancelHistory.filters")}</span>
          </Button>
        }
        refreshControl={
          <Button
            aria-label={t("cancelHistory.refresh")}
            className="size-11 shrink-0 sm:size-9"
            disabled={loading}
            size="icon-sm"
            type="button"
            variant="outline"
            onClick={onRefresh}
          >
            <RefreshCcw className={loading ? "animate-spin" : undefined} data-icon="inline-start" />
            <span className="sr-only">{t("cancelHistory.refresh")}</span>
          </Button>
        }
      />
    </div>
  );
}

// จอ lg ขึ้นไป — ปุ่มช่วงเวลาด่วนแทนการกรอกสองช่องวันที่ทุกครั้ง (กดแล้วค้นหาเลย) ช่องวันที่ยังอยู่สำหรับช่วงเอง
// ฟิลด์รอง (จำนวนแถว/เรียงลำดับ) ย้ายเข้า popover และเอาช่องสาขาแบบอ่านอย่างเดียวออก (เป็นสาขาที่ล็อกอินเสมอ)
export function CancelHistoryFilterBar(props: CancelHistoryFilterProps) {
  const { t } = useTranslation();
  const { canApply, draftFilters, loading, onApply, onDraftChange, onRefresh } = props;
  const secondaryCount = secondaryFilterCount(draftFilters);

  // py-0 กัน py ฐานของ Card (16px) บวกซ้อนกับ py ของ CardContent — ดู sales-list-filters.tsx
  return (
    <Card className="hidden min-w-0 shrink-0 rounded-none border-x-0 border-t-0 border-border bg-card py-0 shadow-none lg:block">
      <CardContent className="flex min-w-0 flex-wrap items-end gap-3 px-3 py-2.5">
        <PresetToggle {...props} itemClassName="h-7" />
        <DateFields draftFilters={draftFilters} idPrefix="cancel-history" onDraftChange={onDraftChange} />

        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" className="relative h-9">
              <SlidersHorizontal data-icon="inline-start" />
              {t("cancelHistory.moreFilters")}
              {secondaryCount ? (
                <Badge className="ml-1 h-4.5 min-w-4.5 justify-center rounded-full border-transparent bg-primary px-1 text-2xs text-primary-foreground">
                  {secondaryCount}
                </Badge>
              ) : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72">
            <PopoverTitle>{t("cancelHistory.moreFilters")}</PopoverTitle>
            <div className="grid gap-3">
              <SecondaryFields draftFilters={draftFilters} idPrefix="cancel-history" onDraftChange={onDraftChange} />
            </div>
          </PopoverContent>
        </Popover>

        <Button type="button" className="h-9 min-w-24" disabled={loading || !canApply} onClick={onApply}>
          {loading ? <RefreshCcw className="animate-spin" data-icon="inline-start" /> : null}
          {t("cancelHistory.apply")}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-9 xl:ml-auto"
          aria-label={t("cancelHistory.refresh")}
          title={t("cancelHistory.refresh")}
          disabled={loading}
          onClick={onRefresh}
        >
          <RefreshCcw className={loading ? "animate-spin" : undefined} />
        </Button>
      </CardContent>
    </Card>
  );
}

export function CancelHistoryFilterSheet({
  open,
  onOpenChange,
  ...props
}: CancelHistoryFilterProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const { canApply, draftFilters, loading, onApply, onDraftChange } = props;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85dvh] gap-0 overflow-hidden rounded-t-xl p-0 lg:hidden">
        <SheetHeader className="shrink-0 border-b border-border px-4 py-3 pr-12 text-left">
          <SheetTitle className="text-base font-semibold">{t("cancelHistory.filters")}</SheetTitle>
          <SheetDescription>{t("cancelHistory.subtitle")}</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 overflow-y-auto p-4">
          <div className="grid gap-4">
            <PresetToggle {...props} itemClassName="h-10" wrap />
            <div className="grid grid-cols-2 gap-3">
              <DateFields draftFilters={draftFilters} idPrefix="cancel-history-mobile" onDraftChange={onDraftChange} />
            </div>
            <SecondaryFields draftFilters={draftFilters} idPrefix="cancel-history-mobile" onDraftChange={onDraftChange} />
          </div>
        </div>
        <SheetFooter className="grid grid-cols-2 gap-2 border-t border-border bg-card px-4 py-3 pb-[calc(0.75rem+var(--pos-system-bottom-safe-area,0px))]">
          <SheetClose asChild>
            <Button type="button" variant="outline" className="h-11">
              {t("actions.close")}
            </Button>
          </SheetClose>
          <Button type="button" className="h-11" disabled={loading || !canApply} onClick={onApply}>
            {loading ? <RefreshCcw className="animate-spin" data-icon="inline-start" /> : null}
            {t("cancelHistory.apply")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function PresetToggle({
  activePreset,
  itemClassName,
  loading,
  onPreset,
  wrap = false
}: Pick<CancelHistoryFilterProps, "activePreset" | "loading" | "onPreset"> & { itemClassName: string; wrap?: boolean }) {
  const { t } = useTranslation();

  return (
    <FieldSet className="gap-1.5">
      <FieldLegend variant="label" className="mb-0 font-medium text-muted-foreground">
        {t("cancelHistory.quickRange")}
      </FieldLegend>
      {/* value "" เมื่อเป็นช่วงที่เลือกเอง — ไม่มีปุ่มไหนถูกเลือกค้าง กันเข้าใจผิดว่ากำลังดู "วันนี้" */}
      <ToggleGroup
        type="single"
        value={activePreset ?? ""}
        disabled={loading}
        onValueChange={(value) => {
          if (value) onPreset(value as CancelHistoryPreset);
        }}
        className={cn("gap-1 rounded-lg border border-border bg-muted p-1", wrap ? "grid w-full grid-cols-2" : "w-fit")}
      >
        {CANCEL_HISTORY_PRESETS.map((preset) => (
          <ToggleGroupItem
            key={preset}
            value={preset}
            className={cn(
              "rounded-md px-3 font-semibold whitespace-nowrap data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm",
              itemClassName
            )}
          >
            {t(`cancelHistory.presets.${preset}`)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </FieldSet>
  );
}

function DateFields({
  draftFilters,
  idPrefix,
  onDraftChange
}: {
  draftFilters: CancelHistoryFilters;
  idPrefix: string;
  onDraftChange: (patch: Partial<CancelHistoryFilters>) => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      <Field className="gap-1.5 lg:w-36 lg:flex-none xl:w-40">
        <FieldLabel htmlFor={`${idPrefix}-start-date`} className="text-xs font-medium text-muted-foreground">
          {t("cancelHistory.startDate")}
        </FieldLabel>
        <ReportDateInput
          id={`${idPrefix}-start-date`}
          label={t("cancelHistory.startDate")}
          value={draftFilters.startDate}
          onValueChange={(startDate) => onDraftChange({ startDate })}
          className="h-11 lg:h-9"
        />
      </Field>
      <Field className="gap-1.5 lg:w-36 lg:flex-none xl:w-40">
        <FieldLabel htmlFor={`${idPrefix}-end-date`} className="text-xs font-medium text-muted-foreground">
          {t("cancelHistory.endDate")}
        </FieldLabel>
        <ReportDateInput
          id={`${idPrefix}-end-date`}
          label={t("cancelHistory.endDate")}
          value={draftFilters.endDate}
          onValueChange={(endDate) => onDraftChange({ endDate })}
          className="h-11 lg:h-9"
        />
      </Field>
    </>
  );
}

function SecondaryFields({
  draftFilters,
  idPrefix,
  onDraftChange
}: {
  draftFilters: CancelHistoryFilters;
  idPrefix: string;
  onDraftChange: (patch: Partial<CancelHistoryFilters>) => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      <Field className="gap-1.5">
        <FieldLabel htmlFor={`${idPrefix}-limit`} className="text-xs font-medium text-muted-foreground">
          {t("common.rowsPerPage")}
        </FieldLabel>
        <Select value={String(draftFilters.limit)} onValueChange={(value) => onDraftChange({ limit: Number(value) as PageLimit })}>
          <SelectTrigger id={`${idPrefix}-limit`} className="h-11 w-full data-[size=default]:h-11 lg:h-9 lg:data-[size=default]:h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {CANCEL_HISTORY_LIMIT_OPTIONS.map((limit) => (
                <SelectItem key={String(limit)} value={String(limit)}>
                  {limit}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <Field className="gap-1.5">
        <FieldLabel htmlFor={`${idPrefix}-order`} className="text-xs font-medium text-muted-foreground">
          {t("cancelHistory.orderBy")}
        </FieldLabel>
        <Select value={draftFilters.orderBy} onValueChange={(value) => onDraftChange({ orderBy: value as CancelHistoryOrder })}>
          <SelectTrigger id={`${idPrefix}-order`} className="h-11 w-full data-[size=default]:h-11 lg:h-9 lg:data-[size=default]:h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {CANCEL_HISTORY_ORDER_OPTIONS.map((order) => (
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
