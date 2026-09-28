"use client";

import { Ban, History, Package, Table2, UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppPagination } from "@/components/common/app-pagination";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingState } from "@/components/common/loading-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CancelHistoryBill } from "@/stores/cancel-store";
import {
  cancelHistoryClock,
  groupCancelHistoryByDate,
  type CancelHistorySummary
} from "./cancel-history-utils";

/**
 * แถบสรุปใบเดียวแบบ sales-list — มูลค่าที่ถูกยกเลิกเป็นช่องเด่น (ตัวเลขที่เจ้าของร้านเปิดหน้านี้มาดู)
 * API ไม่ส่งยอดรวมของทั้งช่วงมา ยอดเงิน/จำนวนจึงรวมจากแถวที่โหลดอยู่ — ถ้ามีหลายหน้าต้องบอกว่า
 * "เฉพาะหน้านี้" ไม่งั้นตัวเลขดูเหมือนยอดของทั้งช่วงวันที่ที่เลือก
 */
export function CancelHistorySummaryStrip({
  pageOnly,
  summary,
  total
}: {
  pageOnly: boolean;
  summary: CancelHistorySummary;
  total: number;
}) {
  const { t } = useTranslation();
  const note = pageOnly ? t("cancelHistory.summaryPageOnly") : undefined;

  return (
    <Card className="gap-0 overflow-hidden rounded-lg border border-border py-0 shadow-none">
      <dl className="grid grid-cols-2 gap-px bg-border sm:grid-cols-[minmax(0,1.6fr)_repeat(2,minmax(0,1fr))]">
        <div className="col-span-2 flex items-center justify-between gap-3 bg-destructive/5 px-3 py-2.5 sm:col-span-1 sm:flex-col sm:items-start sm:justify-center sm:gap-0.5 sm:px-4">
          <dt className="flex items-center gap-1.5 text-xs font-medium text-destructive">
            <Ban aria-hidden="true" className="size-3.5" />
            {t("cancelHistory.summaryValue")}
          </dt>
          <dd className="flex flex-col items-end sm:items-start">
            <span className="text-xl leading-7 font-bold tabular-nums text-destructive">{money(summary.grandTotal)}</span>
            {note ? <span className="text-2xs leading-4 text-muted-foreground">{note}</span> : null}
          </dd>
        </div>
        <SummaryStat icon={<History />} label={t("cancelHistory.summaryBills")} value={total.toLocaleString("en-US")} />
        <SummaryStat icon={<Package />} label={t("cancelHistory.summaryQty")} note={note} value={summary.qty.toLocaleString("en-US")} />
      </dl>
    </Card>
  );
}

function SummaryStat({ icon, label, note, value }: { icon: React.ReactNode; label: string; note?: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col justify-center gap-0.5 bg-card px-3 py-2 sm:py-2.5 xl:px-4">
      <dt className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground [&_svg]:size-3.5 [&_svg]:shrink-0">
        {icon}
        <span className="truncate">{label}</span>
      </dt>
      <dd className="truncate text-base leading-6 font-semibold tabular-nums text-foreground">{value}</dd>
      {note ? <dd className="truncate text-2xs leading-4 text-muted-foreground">{note}</dd> : null}
    </div>
  );
}

export function CancelHistoryListPanel({
  loading,
  page,
  rangeLabel,
  rows,
  autoSelectedUuid,
  selectedUuid,
  total,
  totalPages,
  onPageChange,
  onSelect
}: {
  loading: boolean;
  page: number;
  rangeLabel: string;
  rows: CancelHistoryBill[];
  /** แถวที่แผงขวาแสดงเองโดยยังไม่ได้แตะ — ไฮไลต์เฉพาะจอ xl ที่มีแผงขวาจริง (จอเล็กไม่มีแผงให้เห็นคู่กัน) */
  autoSelectedUuid: string;
  selectedUuid: string;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onSelect: (row: CancelHistoryBill) => void;
}) {
  const { t } = useTranslation();
  const groups = groupCancelHistoryByDate(rows);

  // py-0 กัน py ฐานของ Card (16px) บวกซ้อนกับ py ของ CardHeader — ดู sales-list-filters.tsx
  return (
    <Card className="flex min-h-0 flex-col gap-0 overflow-hidden rounded-none border-x-0 border-b-0 border-border bg-card py-0 shadow-none xl:min-h-0 xl:border-r">
      <CardHeader className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-3 py-2.5 [.border-b]:pb-2.5">
        <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
          <History className="size-4 shrink-0 text-primary-text" />
          <span className="truncate">{t("cancelHistory.tableTitle")}</span>
          {total > 0 ? (
            <Badge variant="secondary" className="shrink-0 rounded-full px-2 tabular-nums">
              {total.toLocaleString("en-US")}
            </Badge>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        {loading && !rows.length ? (
          <div className="p-4">
            <LoadingState label={t("cancelHistory.loading")} variant="table" />
          </div>
        ) : rows.length ? (
          <>
            <div aria-busy={loading} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {groups.map((group) => (
                <section key={group.key} aria-label={group.label}>
                  {/* หัววันที่ยกเลิกปักติดขอบบน — ช่วงหลายวันจะรู้ตลอดว่ากำลังดูของวันไหน */}
                  <h3 className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border bg-muted/80 px-3 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur-sm">
                    <span className="tabular-nums">{group.label}</span>
                    <span className="tabular-nums">{t("cancelHistory.billsCount", { count: group.rows.length })}</span>
                  </h3>
                  <ul className="divide-y divide-border">
                    {group.rows.map((row, index) => (
                      <li key={row.orderUuid || `${row.invoice}-${index}`}>
                        <HistoryListItem
                          row={row}
                          autoSelected={row.orderUuid === autoSelectedUuid}
                          selected={row.orderUuid === selectedUuid}
                          onSelect={() => onSelect(row)}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
            <div className="shrink-0 border-t border-border bg-muted/20 px-3 py-2.5 pb-[calc(0.625rem+max(var(--pos-system-bottom-safe-area,0px),var(--app-shell-bottom-nav-height,0px)))] text-sm text-muted-foreground sm:px-4 sm:py-3">
              <AppPagination disabled={loading} page={page} rangeLabel={rangeLabel} totalPages={totalPages} onPageChange={onPageChange} />
            </div>
          </>
        ) : (
          <div className="flex min-h-80 flex-1 items-center justify-center p-4">
            <EmptyState title={t("cancelHistory.noData")} description={t("cancelHistory.adjustFilters")} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function HistoryListItem({
  autoSelected,
  onSelect,
  row,
  selected
}: {
  autoSelected: boolean;
  onSelect: () => void;
  row: CancelHistoryBill;
  selected: boolean;
}) {
  const { t } = useTranslation();
  const clock = cancelHistoryClock(row.cancelledAt);

  // เหตุผลการยกเลิกคือสิ่งที่คนเปิดหน้านี้มาหา — เดิมอยู่คอลัมน์ที่ 4 ของตาราง 17 คอลัมน์ที่ต้องเลื่อนขวา
  // ตอนนี้เป็นบรรทัดรองของทุกแถว มองเห็นได้โดยไม่ต้องเปิดรายละเอียด
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "relative grid w-full touch-manipulation grid-cols-[2.75rem_minmax(0,1fr)_auto] items-start gap-x-3 px-3 py-3 text-left transition-colors outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        selected ? "bg-primary/10" : "hover:bg-muted/60",
        !selected && autoSelected && "xl:bg-primary/10 xl:hover:bg-primary/10"
      )}
      onClick={onSelect}
    >
      {selected || autoSelected ? (
        <span
          aria-hidden="true"
          className={cn("absolute inset-y-0 left-0 w-1 rounded-r-full bg-primary", !selected && "hidden xl:block")}
        />
      ) : null}

      <span
        className={cn(
          "flex size-11 items-center justify-center rounded-lg border text-sm font-bold tabular-nums",
          selected ? "border-primary/30 bg-card text-primary-text" : "border-border bg-muted/60 text-foreground",
          !selected && autoSelected && "xl:border-primary/30 xl:bg-card xl:text-primary-text"
        )}
      >
        {row.tableName ? <span className="truncate px-1">{row.tableName}</span> : <Table2 aria-hidden="true" className="size-4" />}
      </span>

      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm leading-6 font-semibold tabular-nums text-foreground">{row.invoice || "-"}</span>
          {clock ? <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{clock}</span> : null}
        </span>
        <span className={cn("line-clamp-2 text-xs leading-5 wrap-break-word", row.cancelReason ? "text-foreground/80" : "text-muted-foreground italic")}>
          {row.cancelReason || t("cancelHistory.noReason")}
        </span>
        {row.cancelledByName ? (
          <span className="flex min-w-0 items-center gap-1 text-xs leading-5 text-muted-foreground">
            <UserRound aria-hidden="true" className="size-3 shrink-0" />
            <span className="truncate">{row.cancelledByName}</span>
          </span>
        ) : null}
      </span>

      {/* ขีดฆ่า = ยอดนี้ไม่นับเป็นยอดขายแล้ว */}
      <span className="text-right text-sm leading-6 font-semibold tabular-nums text-muted-foreground line-through decoration-destructive/60">
        {money(row.grandTotal)}
      </span>
    </button>
  );
}
