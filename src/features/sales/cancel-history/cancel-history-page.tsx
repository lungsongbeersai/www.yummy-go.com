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
      ) : (
        // ไม่มี padding และไม่มี gap — สองแผงชนขอบจอและชนกันเอง ใช้เส้น 1px คั่นแทนช่องว่าง
        <div className="grid min-h-0 min-w-0 flex-1 overflow-hidden xl:grid-cols-[minmax(20rem,27rem)_minmax(0,1fr)]">
          <CancelHistoryListPanel
            loading={loading}
            page={page}
            rangeLabel={rangeLabel}
            rows={bills}
            autoSelectedUuid={selectedRow?.orderUuid ?? ""}
            selectedUuid={selectedUuid}
            total={total}
            totalPages={safeTotalPages}
            onPageChange={(nextPage) => {
              setSelectedUuid("");
              goToPage(nextPage);
            }}
            onSelect={selectRow}
          />
          <CancelHistoryDetailPanel row={selectedRow} className="hidden xl:flex" />
        </div>
      )}

      <CancelHistoryDetailDrawer open={mobileDetailOpen} row={selectedRow} onOpenChange={setMobileDetailOpen} />
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
