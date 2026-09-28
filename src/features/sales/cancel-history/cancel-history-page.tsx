"use client";

import { useCallback, useEffect, useState } from "react";
import { useResetOnChange } from "@/hooks/use-reset-on-change";
import { useTranslation } from "react-i18next";
import { LoadingState } from "@/components/common/loading-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useUrlPagination } from "@/hooks/use-url-pagination";
import type { UrlPaginationState } from "@/lib/url-pagination";
import { useAuthStore } from "@/stores/auth-store";
import { useCancelStore, type CancelHistoryBill } from "@/stores/cancel-store";
import { useToastStore } from "@/stores/toast-store";
import { CancelHistoryDetailDrawer, CancelHistoryDetailPanel } from "./cancel-history-detail";
import { CancelHistoryFilterBar, CancelHistoryFilterSheet, CancelHistoryMobileHeader } from "./cancel-history-filters";
import { CancelHistoryListPanel, CancelHistorySummaryStrip } from "./cancel-history-list";
import {
  CANCEL_HISTORY_LIMIT_OPTIONS,
  activeCancelHistoryPreset,
  cancelHistoryPresetRange,
  cancelHistoryRange,
  defaultCancelHistoryFilters,
  summarizeCancelHistory,
  type CancelHistoryFilters,
  type CancelHistoryPreset
} from "./cancel-history-utils";

// จอ xl ขึ้นไปมีแผงรายละเอียดข้างลิสต์ — จอเล็กกว่านั้นเปิดเป็น drawer แทน (เกณฑ์เดียวกับ sales-list/cancel-sale)
function shouldOpenDetailDrawer() {
  if (typeof window === "undefined") return false;
  return !window.matchMedia("(min-width: 1280px)").matches;
}

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
  const [draftFilters, setDraftFilters] = useState<CancelHistoryFilters>(() => ({
    ...defaultCancelHistoryFilters(branchUuid),
    limit: initialPagination.limit
  }));
  const [appliedFilters, setAppliedFilters] = useState<CancelHistoryFilters>(() => ({
    ...defaultCancelHistoryFilters(branchUuid),
    limit: initialPagination.limit
  }));
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [selectedUuid, setSelectedUuid] = useState("");
  const { changeLimit, goToPage, page, resetPage } = useUrlPagination({
    initialPagination,
    limitOptions: CANCEL_HISTORY_LIMIT_OPTIONS
  });
  const safeTotalPages = Math.max(1, totalPages);
  const range = cancelHistoryRange(responsePage || page, appliedFilters.limit, bills.length, total);
  const rangeLabel = t("cancelHistory.range", { end: range.end, start: range.start, total });
  const canApply = Boolean(branchUuid && draftFilters.startDate && draftFilters.endDate);
  const activePreset = activeCancelHistoryPreset(draftFilters);
  const summary = summarizeCancelHistory(bills);
  // เลือกแถวแรกให้แผงขวาบนจอกว้างเองเมื่อยังไม่ได้เลือก/แถวที่เลือกหลุดจากหน้านี้ — ไม่มีแผงว่างค้างตอนเปิดหน้า
  const selectedRow: CancelHistoryBill | null = bills.find((row) => row.orderUuid === selectedUuid) ?? bills[0] ?? null;

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

  function applyFilters(next: CancelHistoryFilters = draftFilters) {
    if (!branchUuid || !next.startDate || !next.endDate) return;
    setDraftFilters({ ...next, branchUuid });
    setAppliedFilters({ ...next, branchUuid });
    setSelectedUuid("");
    changeLimit(next.limit);
    resetPage();
  }

  // ปุ่มช่วงด่วนค้นหาทันที — ไม่ต้องกด "ค้นหา" ซ้ำอีกรอบหลังเลือก (บนมือถือยังเปิด sheet ค้างไว้ให้ปรับต่อได้)
  function applyPreset(preset: CancelHistoryPreset) {
    applyFilters({ ...draftFilters, ...cancelHistoryPresetRange(preset) });
  }

  function selectRow(row: CancelHistoryBill) {
    setSelectedUuid(row.orderUuid);
    setMobileDetailOpen(shouldOpenDetailDrawer());
  }

  const filterProps = {
    activePreset,
    canApply,
    draftFilters,
    loading,
    onApply: () => applyFilters(),
    onDraftChange: patchDraft,
    onPreset: applyPreset,
    onRefresh: () => void load()
  };

  return (
    // เต็มหน้าจอแบบ /sales/sales-list: ไม่มี padding รอบนอก แถบกรอง → แถบสรุป → ลิสต์+รายละเอียดสองแผง
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-muted/20">
      <CancelHistoryMobileHeader
        appliedFilters={appliedFilters}
        loading={loading}
        onOpenFilters={() => setMobileFilterOpen(true)}
        onRefresh={() => void load()}
      />
      <CancelHistoryFilterBar {...filterProps} />
      <CancelHistoryFilterSheet
        {...filterProps}
        open={mobileFilterOpen}
        onApply={() => {
          applyFilters();
          setMobileFilterOpen(false);
        }}
        onOpenChange={setMobileFilterOpen}
      />

      {!branchUuid || error ? (
        <div className="flex shrink-0 flex-col gap-2 px-2 py-2 sm:px-3">
          {!branchUuid ? (
            <CancelHistoryError title={t("cancelHistory.branchRequired")} description={t("cancelHistory.branchRequiredDescription")} />
          ) : null}
          {error ? <CancelHistoryError title={t("cancelHistory.loadFailed")} description={error} /> : null}
        </div>
      ) : null}

      {bills.length ? (
        <div className="shrink-0 px-2 py-2 sm:px-3">
          <CancelHistorySummaryStrip pageOnly={total > bills.length} summary={summary} total={total} />
        </div>
      ) : null}

      {loading && !bills.length ? (
        <div className="min-w-0 flex-1 p-3">
          <LoadingState label={t("cancelHistory.loading")} variant="splitPanel" />
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
      <Table className="min-w-470 text-sm">
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
              <Badge className="border-border bg-muted px-2 text-2xs text-muted-foreground">
                {t("cancelHistory.columns.table")}: {row.tableName || "-"}
              </Badge>
              <Badge className="max-w-full truncate border-border bg-muted px-2 text-2xs text-muted-foreground">
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
      <p className="truncate text-2xs font-bold text-muted-foreground">{label}</p>
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
