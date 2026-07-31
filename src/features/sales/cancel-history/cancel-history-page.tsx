"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useResetOnChange } from "@/hooks/use-reset-on-change";
import { History, RefreshCcw, SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppPagination } from "@/components/common/app-pagination";
import { EmptyState } from "@/components/common/empty-state";
import { FilterHeaderToolbar } from "@/components/common/filter-header-toolbar";
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
import { useUrlPagination } from "@/hooks/use-url-pagination";
import { dateTime } from "@/lib/format";
import type { UrlPaginationState } from "@/lib/url-pagination";
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

export function CancelHistoryPage({ initialPagination }: { initialPagination: UrlPaginationState }) {
  const { t } = useTranslation();
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
  const [draftFilters, setDraftFilters] = useState<CancelHistoryFilters>(() => ({
    ...defaultCancelHistoryFilters(branchUuid),
    limit: initialPagination.limit
  }));
  const [appliedFilters, setAppliedFilters] = useState<CancelHistoryFilters>(() => ({
    ...defaultCancelHistoryFilters(branchUuid),
    limit: initialPagination.limit
  }));
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const { changeLimit, goToPage, page, resetPage } = useUrlPagination({
    initialPagination,
    limitOptions: CANCEL_HISTORY_LIMIT_OPTIONS
  });
  const safeTotalPages = Math.max(1, totalPages);
  const range = cancelHistoryRange(responsePage || page, appliedFilters.limit, bills.length, total);
  const rangeLabel = t("cancelHistory.range", { end: range.end, start: range.start, total });
  const canApply = Boolean(branchUuid && draftFilters.startDate && draftFilters.endDate);
  const dateRangeLabel = `${appliedFilters.startDate} - ${appliedFilters.endDate}`;
  const orderLabel = t(appliedFilters.orderBy === "ASC" ? "common.oldestFirst" : "common.newestFirst");

  // สลับสาขา = อัปเดต filter, กลับหน้าแรก และล้างประวัติถ้าไม่มีสาขา
  useResetOnChange(branchUuid, () => {
    setDraftFilters((current) => (current.branchUuid === branchUuid ? current : { ...current, branchUuid }));
    setAppliedFilters((current) => (current.branchUuid === branchUuid ? current : { ...current, branchUuid }));
    resetPage();
    if (!branchUuid) resetHistory();
  });

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
    if (!loading && page > safeTotalPages) goToPage(safeTotalPages);
  }, [goToPage, loading, page, safeTotalPages]);

  function patchDraft(patch: Partial<CancelHistoryFilters>) {
    setDraftFilters((current) => ({ ...current, ...patch, branchUuid }));
  }

  function applyFilters() {
    if (!canApply) return;
    setAppliedFilters({ ...draftFilters, branchUuid });
    changeLimit(draftFilters.limit);
  }

  function applyMobileFilters() {
    applyFilters();
    setMobileFilterOpen(false);
  }

  return (
    // เต็มหน้าจอแบบ /settings/store: ไม่มี padding รอบนอก ตารางกินความสูงที่เหลือทั้งหมด
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-muted/20">
      <div className="flex shrink-0 flex-col gap-2 border-b border-border bg-card px-2 py-2 sm:px-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-primary">
              <History className="size-4" />
              {t("nav.sales")}
            </div>
            <h1 className="text-2xl font-bold tracking-normal text-foreground">{t("cancelHistory.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("cancelHistory.subtitle")}</p>
          </div>
        </div>

        <FilterHeaderToolbar
          dateRange={{
            ariaLabel: `${t("cancelHistory.filters")}: ${dateRangeLabel}`,
            label: dateRangeLabel,
            onClick: () => setMobileFilterOpen(true)
          }}
          extraChips={
            <>
              <Badge className="h-7 max-w-48 truncate border-border bg-muted px-2 text-xs text-muted-foreground">
                {branchLabel}
              </Badge>
              <Badge className="h-7 border-border bg-muted px-2 text-xs text-muted-foreground">
                {appliedFilters.limit}
              </Badge>
              <Badge className="h-7 max-w-36 truncate px-2 text-xs">
                {orderLabel}
              </Badge>
            </>
          }
          filterControl={
            // จอ lg ขึ้นไปมีแถบตัวกรองอยู่บนหน้าแล้ว ปุ่มนี้จึงเหลือไว้ให้จอเล็กที่ยังใช้ sheet
            <Button
              type="button"
              variant="outline"
              size="iconSm"
              className="h-9 w-9 shrink-0 lg:hidden"
              aria-label={t("cancelHistory.filters")}
              onClick={() => setMobileFilterOpen(true)}
            >
              <SlidersHorizontal data-icon="inline-start" />
              <span className="sr-only">{t("cancelHistory.filters")}</span>
            </Button>
          }
          refreshControl={
            <Button
              type="button"
              variant="outline"
              size="iconSm"
              className="h-9 w-9 shrink-0"
              aria-label={t("actions.refresh")}
              disabled={loading || !canApply}
              onClick={() => void load()}
            >
              <RefreshCcw className={loading ? "animate-spin" : undefined} data-icon="inline-start" />
              <span className="sr-only">{t("actions.refresh")}</span>
            </Button>
          }
        />

        <CancelHistoryFilterBar
          branchLabel={branchLabel}
          canApply={canApply}
          draftFilters={draftFilters}
          loading={loading}
          onApply={applyFilters}
          onDraftChange={patchDraft}
        />

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

      </div>

      {!branchUuid || error ? (
        <div className="flex shrink-0 flex-col gap-2 px-2 py-2 sm:px-3">
          {!branchUuid ? (
            <CancelHistoryError
              title={t("cancelHistory.branchRequired")}
              description={t("cancelHistory.branchRequiredDescription")}
            />
          ) : null}
          {error ? <CancelHistoryError title={t("cancelHistory.loadFailed")} description={error} /> : null}
        </div>
      ) : null}

      <CancelHistoryTableCard
          footer={
            <CancelHistoryPagination
              page={page}
              rangeLabel={rangeLabel}
              totalPages={safeTotalPages}
              onPageChange={goToPage}
            />
          }
          loading={loading}
          rowsLength={bills.length}
        >
        <CancelHistoryTable rows={bills} startIndex={range.start} />
        <CancelHistoryMobileList rows={bills} />
      </CancelHistoryTableCard>
    </div>
  );
}

// จอ lg ขึ้นไปกรองได้จากหน้าเลย โครงเดียวกับ /settings/store — เดิมเป็น Popover ที่ต้องกดเปิดก่อน
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
    <Card className="hidden min-w-0 shrink-0 rounded-none border-x-0 border-t-0 border-border bg-card shadow-none lg:block">
      <CardContent className="grid min-w-0 items-end gap-3 px-3 py-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[repeat(5,minmax(0,1fr))_auto]">
        <CancelHistoryFilterFields
          branchLabel={branchLabel}
          draftFilters={draftFilters}
          idPrefix="cancel-history"
          onDraftChange={onDraftChange}
        />
        <Button type="button" className="h-9 min-w-24" disabled={loading || !canApply} onClick={onApply}>
          {loading ? <RefreshCcw className="animate-spin" data-icon="inline-start" /> : null}
          {t("cancelHistory.apply")}
        </Button>
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
        <SheetFooter className="grid-cols-2 gap-2 border-t border-border bg-card/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur grid">
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

function CancelHistoryTableCard({
  children,
  footer,
  loading,
  rowsLength
}: {
  children: React.ReactNode;
  footer: React.ReactNode;
  loading: boolean;
  rowsLength: number;
}) {
  const { t } = useTranslation();

  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border-x-0 border-b-0 border-border bg-card shadow-none">
      <CardHeader className="flex shrink-0 flex-col gap-2 border-b border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <CardTitle className="flex min-w-0 items-center gap-2 text-base font-semibold">
            <History />
            <span className="truncate">{t("cancelHistory.tableTitle")}</span>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        {loading ? (
          <div className="p-4 md:min-h-80">
            <LoadingState label={t("cancelHistory.loading")} variant="reportTable" />
          </div>
        ) : rowsLength ? (
          <>
            <div className="min-h-0 flex-1 overflow-auto overscroll-x-contain overscroll-y-auto">
              {children}
            </div>
            <div className="shrink-0 border-t border-border bg-card">{footer}</div>
          </>
        ) : (
          <div className="p-4 md:min-h-80">
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
      <Table className="min-w-470 text-[13px]">
        <TableHeader className="sticky top-0 z-20 bg-background/95 shadow-sm backdrop-blur">
          <TableRow>
            <TableHead className="w-18 whitespace-nowrap bg-background/95 text-center">{t("cancelHistory.columns.no")}</TableHead>
            <TableHead className="min-w-32.5 whitespace-nowrap bg-background/95">{t("cancelHistory.columns.invoice")}</TableHead>
            <TableHead className="min-w-42.5 whitespace-nowrap bg-background/95">{t("cancelHistory.columns.cancelledAt")}</TableHead>
            <TableHead className="min-w-60 bg-background/95">{t("cancelHistory.columns.reason")}</TableHead>
            <TableHead className="min-w-35 whitespace-nowrap bg-background/95">{t("cancelHistory.columns.status")}</TableHead>
            <TableHead className="min-w-27.5 whitespace-nowrap bg-background/95">{t("cancelHistory.columns.table")}</TableHead>
            <TableHead className="min-w-55 whitespace-nowrap bg-background/95">{t("cancelHistory.columns.branch")}</TableHead>
            <TableHead className="min-w-30 whitespace-nowrap bg-background/95">{t("cancelHistory.columns.orderDate")}</TableHead>
            {metrics.map((metric) => (
              <TableHead key={metric.field} className="min-w-31.5 whitespace-nowrap bg-background/95 text-right">
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
              <TableCell className="max-w-70 whitespace-normal font-medium">{row.cancelReason || "-"}</TableCell>
              <TableCell className="whitespace-nowrap">
                <StatusBadge status={row.statusName || row.statusCode} />
              </TableCell>
              <TableCell className="whitespace-nowrap">{row.tableName || "-"}</TableCell>
              <TableCell className="max-w-65 truncate">{row.branchName || "-"}</TableCell>
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
            <p className="mt-2 wrap-break-word text-sm font-medium">{row.cancelReason || "-"}</p>
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
  onPageChange,
  page,
  rangeLabel,
  totalPages
}: {
  onPageChange: (page: number) => void;
  page: number;
  rangeLabel: string;
  totalPages: number;
}) {
  return (
    <div className="border-t border-border px-4 py-3 text-sm text-muted-foreground">
      <AppPagination
        page={page}
        rangeLabel={rangeLabel}
        totalPages={totalPages}
        onPageChange={onPageChange}
      />
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
