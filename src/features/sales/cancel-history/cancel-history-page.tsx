"use client";

import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, History, RefreshCcw, SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingState } from "@/components/common/loading-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { dateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CancelHistoryOrder } from "@/services/cancel";
import type { PageLimit } from "@/services/shared/types";
import { useAuthStore } from "@/stores/auth-store";
import { useCancelStore, type CancelHistoryBill } from "@/stores/cancel-store";
import { useToastStore } from "@/stores/toast-store";
import {
  CANCEL_HISTORY_LIMIT_OPTIONS,
  CANCEL_HISTORY_ORDER_OPTIONS,
  cancelHistoryMetricConfigs,
  cancelHistoryMetrics,
  cancelHistoryRange,
  defaultCancelHistoryFilters,
  formatCancelHistoryMetric,
  type CancelHistoryFilters
} from "./cancel-history-utils";

export function CancelHistoryPage() {
  const { t } = useTranslation();
  const filterRef = useRef<HTMLDivElement>(null);
  const [filterHeight, setFilterHeight] = useState(0);
  const user = useAuthStore((state) => state.user);
  const bills = useCancelStore((state) => state.historyBills);
  const error = useCancelStore((state) => state.historyError);
  const loading = useCancelStore((state) => state.historyLoading);
  const responsePage = useCancelStore((state) => state.historyPage);
  const total = useCancelStore((state) => state.historyTotal);
  const totalPages = useCancelStore((state) => state.historyTotalPages);
  const loadHistory = useCancelStore((state) => state.loadHistory);
  const resetHistory = useCancelStore((state) => state.resetHistory);
  const showToast = useToastStore((state) => state.show);
  const branchUuid = user?.branch_uuid ?? "";
  const branchLabel = user?.branch_name || branchUuid || "-";
  const [draftFilters, setDraftFilters] = useState<CancelHistoryFilters>(() => defaultCancelHistoryFilters(branchUuid));
  const [appliedFilters, setAppliedFilters] = useState<CancelHistoryFilters>(() => defaultCancelHistoryFilters(branchUuid));
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const safeTotalPages = Math.max(1, totalPages);
  const range = cancelHistoryRange(responsePage || page, appliedFilters.limit, bills.length, total);
  const rangeLabel = t("cancelHistory.range", { end: range.end, start: range.start, total });
  const canApply = Boolean(branchUuid && draftFilters.startDate && draftFilters.endDate);
  const canGoBack = page > 1 && !loading;
  const canGoNext = page < safeTotalPages && !loading;
  const layoutStyle = {
    "--cancel-history-filter-height": `${filterHeight}px`
  } as CSSProperties;

  useEffect(() => {
    setDraftFilters((current) => (current.branchUuid === branchUuid ? current : { ...current, branchUuid }));
    setAppliedFilters((current) => (current.branchUuid === branchUuid ? current : { ...current, branchUuid }));
    setPage(1);
    if (!branchUuid) resetHistory();
  }, [branchUuid, resetHistory]);

  useEffect(() => {
    const node = filterRef.current;
    if (!node) return;

    let frameId = 0;
    const updateHeight = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        const nextHeight = Math.ceil(node.getBoundingClientRect().height);
        setFilterHeight((currentHeight) => (currentHeight === nextHeight ? currentHeight : nextHeight));
      });
    };

    updateHeight();
    window.addEventListener("resize", updateHeight);

    if (typeof ResizeObserver === "undefined") {
      return () => {
        window.cancelAnimationFrame(frameId);
        window.removeEventListener("resize", updateHeight);
      };
    }

    const observer = new ResizeObserver(updateHeight);
    observer.observe(node);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", updateHeight);
      observer.disconnect();
    };
  }, []);

  const load = useCallback(async () => {
    if (!branchUuid || !appliedFilters.startDate || !appliedFilters.endDate) {
      resetHistory();
      return;
    }

    try {
      await loadHistory({
        branch_uuid_fk: branchUuid,
        end_date: appliedFilters.endDate,
        limit: appliedFilters.limit,
        orderBy: appliedFilters.orderBy,
        page,
        start_date: appliedFilters.startDate
      });
    } catch (loadError) {
      showToast({
        title: t("cancelHistory.loadFailed"),
        description: loadError instanceof Error ? loadError.message : "",
        tone: "error"
      });
    }
  }, [appliedFilters, branchUuid, loadHistory, page, resetHistory, showToast, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!loading && page > safeTotalPages) setPage(safeTotalPages);
  }, [loading, page, safeTotalPages]);

  function patchDraft(patch: Partial<CancelHistoryFilters>) {
    setDraftFilters((current) => ({ ...current, ...patch, branchUuid }));
  }

  function applyFilters() {
    if (!canApply) return;
    setAppliedFilters({ ...draftFilters, branchUuid });
    setPage(1);
  }

  function applyMobileFilters() {
    applyFilters();
    setMobileFilterOpen(false);
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-muted/20" style={layoutStyle}>
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 p-4 lg:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-primary">
              <History className="size-4" />
              {t("nav.sales")}
            </div>
            <h1 className="text-2xl font-black tracking-normal text-foreground">{t("cancelHistory.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("cancelHistory.subtitle")}</p>
          </div>
          <Badge className="w-fit rounded-full px-3 py-1">
            <CalendarDays data-icon="inline-start" />
            {appliedFilters.startDate} - {appliedFilters.endDate}
          </Badge>
        </div>

        <div
          ref={filterRef}
          className="sticky top-0 z-30 -mx-4 bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/85 lg:-mx-6 lg:px-6"
        >
          <div className="sm:hidden">
            <MobileCancelHistoryFilterSummary
              branchLabel={branchLabel}
              filters={appliedFilters}
              onOpen={() => setMobileFilterOpen(true)}
            />
          </div>
          <div className="hidden sm:block">
            <CancelHistoryFilterBar
              branchLabel={branchLabel}
              canApply={canApply}
              draftFilters={draftFilters}
              loading={loading}
              onApply={applyFilters}
              onDraftChange={patchDraft}
            />
          </div>
        </div>

        <CancelHistoryFilterSheet
          branchLabel={branchLabel}
          canApply={canApply}
          draftFilters={draftFilters}
          loading={loading}
          open={mobileFilterOpen}
          onApply={applyMobileFilters}
          onDraftChange={patchDraft}
          onOpenChange={setMobileFilterOpen}
        />

        {!branchUuid ? (
          <CancelHistoryError
            title={t("cancelHistory.branchRequired")}
            description={t("cancelHistory.branchRequiredDescription")}
          />
        ) : null}
        {error ? <CancelHistoryError title={t("cancelHistory.loadFailed")} description={error} /> : null}

        <CancelHistoryTableCard
          footer={
            <CancelHistoryPagination
              canGoBack={canGoBack}
              canGoNext={canGoNext}
              page={page}
              rangeLabel={rangeLabel}
              totalPages={safeTotalPages}
              onBack={() => setPage((current) => Math.max(1, current - 1))}
              onNext={() => setPage((current) => current + 1)}
            />
          }
          loading={loading}
          rangeLabel={rangeLabel}
          rowsLength={bills.length}
          onRefresh={() => void load()}
        >
          <CancelHistoryTable rows={bills} startIndex={range.start} />
          <CancelHistoryMobileList rows={bills} />
        </CancelHistoryTableCard>
      </div>
    </div>
  );
}

function CancelHistoryFilterBar({
  branchLabel,
  canApply,
  draftFilters,
  loading,
  onApply,
  onDraftChange
}: {
  branchLabel: string;
  canApply: boolean;
  draftFilters: CancelHistoryFilters;
  loading: boolean;
  onApply: () => void;
  onDraftChange: (patch: Partial<CancelHistoryFilters>) => void;
}) {
  const { t } = useTranslation();

  return (
    <Card className="border-border bg-card shadow-sm">
      <CardContent className="p-4">
        <FieldGroup className="grid gap-3 lg:grid-cols-4 lg:items-end 2xl:grid-cols-[repeat(5,minmax(0,1fr))_auto]">
          <CancelHistoryFilterFields
            branchLabel={branchLabel}
            draftFilters={draftFilters}
            idPrefix="cancel-history"
            onDraftChange={onDraftChange}
          />
          <Button type="button" className="h-9 min-w-28" disabled={loading || !canApply} onClick={onApply}>
            {loading ? <RefreshCcw className="animate-spin" data-icon="inline-start" /> : null}
            {t("cancelHistory.apply")}
          </Button>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}

function CancelHistoryFilterSheet({
  branchLabel,
  canApply,
  draftFilters,
  loading,
  open,
  onApply,
  onDraftChange,
  onOpenChange
}: {
  branchLabel: string;
  canApply: boolean;
  draftFilters: CancelHistoryFilters;
  loading: boolean;
  open: boolean;
  onApply: () => void;
  onDraftChange: (patch: Partial<CancelHistoryFilters>) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[88dvh] gap-0 overflow-hidden rounded-t-xl p-0 sm:hidden">
        <SheetHeader className="shrink-0 border-b border-border px-4 py-3 pr-12 text-left">
          <SheetTitle className="text-base font-black">{t("cancelHistory.filters")}</SheetTitle>
          <SheetDescription>{t("cancelHistory.title")}</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 overflow-y-auto p-4">
          <FieldGroup className="grid gap-3">
            <CancelHistoryFilterFields
              branchLabel={branchLabel}
              draftFilters={draftFilters}
              idPrefix="cancel-history-mobile"
              onDraftChange={onDraftChange}
            />
          </FieldGroup>
        </div>
        <SheetFooter className="grid-cols-2 gap-2 border-t border-border bg-card/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur [display:grid]">
          <SheetClose asChild>
            <Button type="button" variant="outline">
              {t("actions.close")}
            </Button>
          </SheetClose>
          <Button type="button" disabled={loading || !canApply} onClick={onApply}>
            {loading ? <RefreshCcw className="animate-spin" data-icon="inline-start" /> : null}
            {t("cancelHistory.apply")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function CancelHistoryFilterFields({
  branchLabel,
  draftFilters,
  idPrefix,
  onDraftChange
}: {
  branchLabel: string;
  draftFilters: CancelHistoryFilters;
  idPrefix: string;
  onDraftChange: (patch: Partial<CancelHistoryFilters>) => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      <Field className="gap-1.5">
        <FieldLabel htmlFor={`${idPrefix}-branch`} className="text-xs font-bold text-muted-foreground">
          {t("cancelHistory.columns.branch")}
        </FieldLabel>
        <Input id={`${idPrefix}-branch`} value={branchLabel} readOnly aria-readonly />
      </Field>
      <Field className="gap-1.5">
        <FieldLabel htmlFor={`${idPrefix}-start-date`} className="text-xs font-bold text-muted-foreground">
          {t("cancelHistory.startDate")}
        </FieldLabel>
        <Input
          id={`${idPrefix}-start-date`}
          type="date"
          value={draftFilters.startDate}
          onChange={(event) => onDraftChange({ startDate: event.target.value })}
        />
      </Field>
      <Field className="gap-1.5">
        <FieldLabel htmlFor={`${idPrefix}-end-date`} className="text-xs font-bold text-muted-foreground">
          {t("cancelHistory.endDate")}
        </FieldLabel>
        <Input
          id={`${idPrefix}-end-date`}
          type="date"
          value={draftFilters.endDate}
          onChange={(event) => onDraftChange({ endDate: event.target.value })}
        />
      </Field>
      <Field className="gap-1.5">
        <FieldLabel htmlFor={`${idPrefix}-limit`} className="text-xs font-bold text-muted-foreground">
          {t("common.rowsPerPage")}
        </FieldLabel>
        <Select value={String(draftFilters.limit)} onValueChange={(value) => onDraftChange({ limit: Number(value) as PageLimit })}>
          <SelectTrigger id={`${idPrefix}-limit`} className="w-full">
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
        <FieldLabel htmlFor={`${idPrefix}-order`} className="text-xs font-bold text-muted-foreground">
          {t("cancelHistory.orderBy")}
        </FieldLabel>
        <Select value={draftFilters.orderBy} onValueChange={(value) => onDraftChange({ orderBy: value as CancelHistoryOrder })}>
          <SelectTrigger id={`${idPrefix}-order`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {CANCEL_HISTORY_ORDER_OPTIONS.map((order) => (
                <SelectItem key={order} value={order}>
                  {order}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
    </>
  );
}

function MobileCancelHistoryFilterSummary({
  branchLabel,
  filters,
  onOpen
}: {
  branchLabel: string;
  filters: CancelHistoryFilters;
  onOpen: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="rounded-md border border-border bg-card p-2 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1 text-xs font-bold text-muted-foreground">
            <CalendarDays className="size-3.5 shrink-0" />
            <span className="truncate">
              {filters.startDate} - {filters.endDate}
            </span>
          </div>
          <div className="mt-1 flex min-w-0 flex-wrap gap-1">
            <Badge className="h-6 max-w-[11rem] truncate border-border bg-muted px-2 text-[11px] text-muted-foreground">
              {branchLabel}
            </Badge>
            <Badge className="h-6 border-border bg-muted px-2 text-[11px] text-muted-foreground">
              {filters.limit}
            </Badge>
            <Badge className="h-6 px-2 text-[11px]">{filters.orderBy}</Badge>
          </div>
        </div>
        <Button type="button" size="sm" className="h-9 shrink-0 px-3" onClick={onOpen}>
          <SlidersHorizontal data-icon="inline-start" />
          {t("cancelHistory.filters")}
        </Button>
      </div>
    </div>
  );
}

function CancelHistoryTableCard({
  children,
  footer,
  loading,
  rangeLabel,
  rowsLength,
  onRefresh
}: {
  children: React.ReactNode;
  footer: React.ReactNode;
  loading: boolean;
  rangeLabel: string;
  rowsLength: number;
  onRefresh: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Card className="min-h-0 overflow-hidden border-border bg-card shadow-sm md:sticky md:top-[calc(var(--cancel-history-filter-height)_+_0.75rem)] md:flex md:max-h-[calc(100dvh_-_var(--app-shell-header-height)_-_var(--cancel-history-filter-height)_-_1.5rem)] md:flex-col">
      <CardHeader className="flex shrink-0 flex-col gap-2 border-b border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <CardTitle className="flex min-w-0 items-center gap-2 text-base font-black">
            <History />
            <span className="truncate">{t("cancelHistory.tableTitle")}</span>
          </CardTitle>
          <p className="text-sm text-muted-foreground">{rangeLabel}</p>
        </div>
        <Button type="button" variant="outline" size="sm" className="h-9" disabled={loading} onClick={onRefresh}>
          <RefreshCcw className={loading ? "animate-spin" : undefined} data-icon="inline-start" />
          {t("actions.refresh")}
        </Button>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        {loading ? (
          <div className="p-4 md:min-h-[320px]">
            <LoadingState label={t("cancelHistory.loading")} variant="table" />
          </div>
        ) : rowsLength ? (
          <>
            <div className="min-h-0 md:flex-1 md:overflow-auto md:overscroll-x-contain md:overscroll-y-auto">
              {children}
            </div>
            <div className="shrink-0 bg-card">{footer}</div>
          </>
        ) : (
          <div className="p-4 md:min-h-[320px]">
            <EmptyState title={t("cancelHistory.noData")} description={t("cancelHistory.adjustFilters")} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CancelHistoryTable({ rows, startIndex }: { rows: CancelHistoryBill[]; startIndex: number }) {
  const { t } = useTranslation();
  const metrics = useMemo(
    () => cancelHistoryMetricConfigs.map((metric) => ({ ...metric, label: t(metric.labelKey) })),
    [t]
  );

  return (
    <div className="hidden min-w-0 md:block">
      <Table className="min-w-[1880px] text-[13px]">
        <TableHeader className="sticky top-0 z-20 bg-background/95 shadow-sm backdrop-blur">
          <TableRow>
            <TableHead className="w-[72px] whitespace-nowrap bg-background/95 text-center">{t("cancelHistory.columns.no")}</TableHead>
            <TableHead className="min-w-[130px] whitespace-nowrap bg-background/95">{t("cancelHistory.columns.invoice")}</TableHead>
            <TableHead className="min-w-[170px] whitespace-nowrap bg-background/95">{t("cancelHistory.columns.cancelledAt")}</TableHead>
            <TableHead className="min-w-[240px] bg-background/95">{t("cancelHistory.columns.reason")}</TableHead>
            <TableHead className="min-w-[140px] whitespace-nowrap bg-background/95">{t("cancelHistory.columns.status")}</TableHead>
            <TableHead className="min-w-[110px] whitespace-nowrap bg-background/95">{t("cancelHistory.columns.table")}</TableHead>
            <TableHead className="min-w-[220px] whitespace-nowrap bg-background/95">{t("cancelHistory.columns.branch")}</TableHead>
            <TableHead className="min-w-[120px] whitespace-nowrap bg-background/95">{t("cancelHistory.columns.orderDate")}</TableHead>
            {metrics.map((metric) => (
              <TableHead key={metric.field} className="min-w-[126px] whitespace-nowrap bg-background/95 text-right">
                {metric.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={row.orderUuid || `${row.invoice}-${index}`} className={index % 2 === 1 ? "bg-muted/15" : undefined}>
              <TableCell className="whitespace-nowrap text-center">
                <Badge className="h-7 min-w-10 justify-center px-2 text-xs tabular-nums">#{startIndex + index}</Badge>
              </TableCell>
              <TableCell className="whitespace-nowrap font-black tabular-nums">{row.invoice || "-"}</TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">{dateTime(row.cancelledAt)}</TableCell>
              <TableCell className="max-w-[280px] whitespace-normal font-medium">{row.cancelReason || "-"}</TableCell>
              <TableCell className="whitespace-nowrap">
                <StatusBadge status={row.statusName || row.statusCode} />
              </TableCell>
              <TableCell className="whitespace-nowrap">{row.tableName || "-"}</TableCell>
              <TableCell className="max-w-[260px] truncate">{row.branchName || "-"}</TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">{row.orderDate || "-"}</TableCell>
              {metrics.map((metric) => (
                <TableCell key={metric.field} className="whitespace-nowrap text-right font-black tabular-nums">
                  {formatCancelHistoryMetric(row[metric.field], metric.kind)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function CancelHistoryMobileList({ rows }: { rows: CancelHistoryBill[] }) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-3 p-3 md:hidden">
      {rows.map((row, index) => (
        <section key={row.orderUuid || `${row.invoice}-${index}`} className="rounded-md border border-border bg-background">
          <div className="border-b border-border bg-muted/25 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-black tabular-nums">{row.invoice || "-"}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{dateTime(row.cancelledAt)}</p>
              </div>
              <StatusBadge status={row.statusName || row.statusCode} />
            </div>
            <p className="mt-2 break-words text-sm font-medium">{row.cancelReason || "-"}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              <Badge className="border-border bg-muted px-2 text-[11px] text-muted-foreground">
                {t("cancelHistory.columns.table")}: {row.tableName || "-"}
              </Badge>
              <Badge className="max-w-full truncate border-border bg-muted px-2 text-[11px] text-muted-foreground">
                {row.branchName || "-"}
              </Badge>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 p-3 text-xs">
            {cancelHistoryMetrics(row, t).map((metric) => (
              <MetricPill key={metric.field} kind={metric.kind} label={metric.label} value={metric.value} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function MetricPill({
  kind,
  label,
  value
}: {
  kind: "money" | "number";
  label: string;
  value: unknown;
}) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-muted/20 px-2 py-1">
      <p className="truncate text-[11px] font-bold text-muted-foreground">{label}</p>
      <p className="truncate font-black tabular-nums text-foreground">{formatCancelHistoryMetric(value, kind)}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge className={cn("max-w-36 truncate px-2", "border-destructive/25 bg-destructive/10 text-destructive")}>
      {status || "-"}
    </Badge>
  );
}

function CancelHistoryPagination({
  canGoBack,
  canGoNext,
  onBack,
  onNext,
  page,
  rangeLabel,
  totalPages
}: {
  canGoBack: boolean;
  canGoNext: boolean;
  onBack: () => void;
  onNext: () => void;
  page: number;
  rangeLabel: string;
  totalPages: number;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-2 border-t border-border px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <span>{rangeLabel}</span>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:flex">
        <Button type="button" size="xs" variant="outline" disabled={!canGoBack} onClick={onBack}>
          {t("actions.back")}
        </Button>
        <Badge className="h-7 px-2 text-xs">
          {t("common.page", { current: page, total: totalPages })}
        </Badge>
        <Button type="button" size="xs" variant="outline" disabled={!canGoNext} onClick={onNext}>
          {t("common.nextPage")}
        </Button>
      </div>
    </div>
  );
}

function CancelHistoryError({ description, title }: { description: string; title: string }) {
  return (
    <Alert variant="destructive">
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{description}</AlertDescription>
    </Alert>
  );
}
