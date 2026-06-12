"use client";

import { CalendarDays, RefreshCcw, SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PAGE_LIMIT_OPTIONS, isAllPageLimit } from "@/lib/pagination";
import type {
  DetailPaginationBasis,
  ReportBranchOption,
  ReportFilters,
  ReportPaymentMethodFilter,
} from "./daily-sales-report-types";
import { paymentMethodOptions } from "./daily-sales-report-utils";
import type { DailySalesReportOrder } from "@/services/report";

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
  const { t } = useTranslation();

  return (
    <Card className="min-w-0 border-border bg-card shadow-sm">
      <CardContent className="grid min-w-0 gap-3 p-3 sm:p-4 lg:grid-cols-4 lg:items-end 2xl:grid-cols-[repeat(7,minmax(0,1fr))_auto]">
        <ReportFilterFields
          branchLoading={branchLoading}
          branchLocked={branchLocked}
          branchOptions={branchOptions}
          detailPaginationBasis={detailPaginationBasis}
          draftFilters={draftFilters}
          idPrefix="report"
          onDraftChange={onDraftChange}
        />
        <Button
          type="button"
          className="h-9 min-w-28"
          disabled={loading || !canApply}
          onClick={onApply}
        >
          {loading ? (
            <RefreshCcw className="animate-spin" data-icon="inline-start" />
          ) : null}
          {t("report.apply")}
        </Button>
      </CardContent>
    </Card>
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[88dvh] gap-0 overflow-hidden rounded-t-xl p-0 sm:hidden"
      >
        <SheetHeader className="shrink-0 border-b border-border px-4 py-3 pr-12 text-left">
          <SheetTitle className="text-base font-black">
            {t("report.filters.currentFilters")}
          </SheetTitle>
          <SheetDescription>{t("report.dailySalesTitle")}</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 overflow-y-auto p-4">
          <div className="grid gap-3">
            <ReportFilterFields
              branchLoading={branchLoading}
              branchLocked={branchLocked}
              branchOptions={branchOptions}
              detailPaginationBasis={detailPaginationBasis}
              draftFilters={draftFilters}
              idPrefix="report-mobile"
              onDraftChange={onDraftChange}
            />
          </div>
        </div>
        <SheetFooter className="grid-cols-2 gap-2 border-t border-border bg-card/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur grid">
          <SheetClose asChild>
            <Button type="button" variant="outline">
              {t("actions.close")}
            </Button>
          </SheetClose>
          <Button
            type="button"
            disabled={loading || !canApply}
            onClick={onApply}
          >
            {loading ? (
              <RefreshCcw className="animate-spin" data-icon="inline-start" />
            ) : null}
            {t("report.apply")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
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
    filters.typePage === "summary" ? t("report.summary") : t("report.detail");
  const paymentMethodLabel =
    filters.paymentMethod === "all"
      ? t("common.all")
      : t(`report.paymentMethods.${filters.paymentMethod}`);
  const limitCount = isAllPageLimit(filters.limit)
    ? t("common.all")
    : filters.limit;
  const limitLabel =
    filters.typePage === "detail"
      ? detailPaginationBasis === "bills"
        ? t("report.billsPerPageValue", { count: limitCount })
        : t("report.linesPerPageValue", { count: limitCount })
      : t("report.rowsPerPageValue", { count: limitCount });

  return (
    <div className="rounded-md border border-border bg-card p-2 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1 text-xs font-bold text-muted-foreground">
            <CalendarDays className="size-3.5 shrink-0" />
            <span className="truncate">
              {filters.dateFrom} - {filters.dateTo}
            </span>
          </div>
          <div className="mt-1 flex min-w-0 flex-wrap gap-1">
            <Badge className="h-6 max-w-44 truncate border-border bg-muted px-2 text-[11px] text-muted-foreground">
              {branchLabel}
            </Badge>
            <Badge className="h-6 max-w-32 truncate px-2 text-[11px]">
              {typeLabel}
            </Badge>
            <Badge className="h-6 border-border bg-muted px-2 text-[11px] text-muted-foreground">
              {paymentMethodLabel}
            </Badge>
            <Badge className="h-6 border-border bg-muted px-2 text-[11px] text-muted-foreground">
              {limitLabel}
            </Badge>
            <Badge className="h-6 border-border bg-muted px-2 text-[11px] text-muted-foreground">
              {filters.orderBy}
            </Badge>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          className="h-9 shrink-0 px-3"
          onClick={onOpen}
        >
          <SlidersHorizontal data-icon="inline-start" />
          {t("report.filters.openFilters")}
        </Button>
      </div>
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
        <FieldLabel className="text-xs font-bold text-muted-foreground">
          {t("report.filters.typePage")}
        </FieldLabel>
        <div className="grid h-9 grid-cols-2 gap-1 rounded-md border border-border bg-background/70 p-1">
          {(["summary", "detail"] as const).map((typePage) => (
            <Button
              key={typePage}
              type="button"
              size="xs"
              variant={draftFilters.typePage === typePage ? "default" : "ghost"}
              className="h-7 min-w-0 px-2 text-xs shadow-none"
              onClick={() => patch({ typePage })}
            >
              <span className="truncate">
                {typePage === "summary"
                  ? t("report.summary")
                  : t("report.detail")}
              </span>
            </Button>
          ))}
        </div>
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
            patch({ paymentMethod: value as ReportPaymentMethodFilter })
          }
        >
          <SelectTrigger id={`${idPrefix}-payment-method`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {paymentMethodOptions.map((method) => (
                <SelectItem key={method} value={method}>
                  {method === "all"
                    ? t("common.all")
                    : t(`report.paymentMethods.${method}`)}
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
      <Field className="min-w-0 gap-1.5">
        <FieldLabel
          htmlFor={`${idPrefix}-order`}
          className="text-xs font-bold text-muted-foreground"
        >
          {t("report.filters.orderBy")}
        </FieldLabel>
        <Select
          value={draftFilters.orderBy}
          onValueChange={(value) =>
            patch({ orderBy: value as DailySalesReportOrder })
          }
        >
          <SelectTrigger id={`${idPrefix}-order`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="DESC">DESC</SelectItem>
              <SelectItem value="ASC">ASC</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
    </>
  );
}
