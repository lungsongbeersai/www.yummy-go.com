"use client";

import { AlarmClock, Clock, LayoutGrid, RefreshCcw, Rows3, Store } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  formatQueueWait,
  type QueueListView,
  type QueueSummary
} from "@/features/pos/order-queue/order-queue-view";

interface OrderQueueSummaryBarProps {
  summary: QueueSummary;
  /** เวลาที่ข้อมูลชุดนี้มาถึง (ms) — 0 = ยังไม่เคยโหลดสำเร็จ */
  loadedAt: number;
  view: QueueListView;
  /** มือถือบังคับมุมมองตามโต๊ะเสมอ (ดู order-queue-page.tsx) จึงไม่ต้องมีปุ่มสลับ */
  showViewToggle: boolean;
  /** Capacitor มีปุ่มรีเฟรชใน NativeTopBar อยู่แล้ว */
  showRefresh: boolean;
  loading: boolean;
  /** null = แท็บนี้ไม่มีรายการให้เลือก (หรือมุมมองตารางที่มี checkbox ที่หัวตารางแทน) */
  selectAll: { checked: boolean | "indeterminate"; onChange: (checked: boolean) => void } | null;
  onViewChange: (view: QueueListView) => void;
  onRefresh: () => void;
}

function formatLoadedClock(loadedAt: number): string {
  if (!loadedAt) return "";
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(loadedAt));
}

/**
 * แถบสรุปใต้แท็บ — ตอบ 3 คำถามแรกของหน้าจอคิว: มีกี่รายการ/กี่โต๊ะ, ใบไหนรอนานสุด,
 * มีกี่ใบที่ช้าแล้ว เดิมตัวเลขพวกนี้ซ่อนอยู่ท้ายตาราง (และไม่มีเลยในมุมมองการ์ด)
 * ต้องเลื่อนลงไปดูทั้งที่เป็นข้อมูลที่ใช้ตัดสินใจก่อนลงมือ
 */
export function OrderQueueSummaryBar({
  summary,
  loadedAt,
  view,
  showViewToggle,
  showRefresh,
  loading,
  selectAll,
  onViewChange,
  onRefresh
}: OrderQueueSummaryBarProps) {
  const { t } = useTranslation();
  const loadedClock = formatLoadedClock(loadedAt);

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2">
      {selectAll ? (
        <Label className="flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-bold">
          <Checkbox
            checked={selectAll.checked}
            onCheckedChange={(checked) => selectAll.onChange(checked === true)}
          />
          {t("common.selectAll")}
        </Label>
      ) : null}

      <ul className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
        <li className="font-black tabular-nums text-foreground">
          {t("orderQueue.itemCount", { count: summary.items })}
        </li>
        {summary.tables > 0 ? (
          <li className="flex items-center gap-1.5 font-semibold tabular-nums text-muted-foreground">
            <Store aria-hidden="true" className="size-4" />
            {t("orderQueue.tableCount", { count: summary.tables })}
          </li>
        ) : null}
        {summary.oldestWait > 0 ? (
          <li className="flex items-center gap-1.5 font-semibold tabular-nums text-muted-foreground">
            <Clock aria-hidden="true" className="size-4" />
            {t("orderQueue.oldestWait", { wait: formatQueueWait(summary.oldestWait, t) })}
          </li>
        ) : null}
        {summary.late > 0 ? (
          <li className="flex items-center gap-1.5 rounded-md bg-destructive/10 px-2 py-0.5 font-black tabular-nums text-destructive">
            <AlarmClock aria-hidden="true" className="size-4" />
            {t("orderQueue.lateCount", { count: summary.late })}
          </li>
        ) : null}
      </ul>

      <div className="flex shrink-0 items-center gap-2">
        {loadedClock ? (
          <span className="hidden text-xs tabular-nums text-muted-foreground lg:inline">
            {t("orderQueue.updatedAt", { time: loadedClock })}
          </span>
        ) : null}

        {showViewToggle ? (
          <ToggleGroup
            aria-label={t("orderQueue.viewToggleAria")}
            type="single"
            value={view}
            onValueChange={(value) => {
              if (value) onViewChange(value as QueueListView);
            }}
            className="gap-1 rounded-lg border border-border bg-muted p-1"
          >
            <ToggleGroupItem
              value="card"
              aria-label={t("orderQueue.viewCard")}
              className="h-8 gap-1.5 rounded-md px-3 font-bold data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm"
            >
              <LayoutGrid data-icon="inline-start" />
              <span className="hidden sm:inline">{t("orderQueue.viewCard")}</span>
            </ToggleGroupItem>
            <ToggleGroupItem
              value="table"
              aria-label={t("orderQueue.viewTable")}
              className="h-8 gap-1.5 rounded-md px-3 font-bold data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm"
            >
              <Rows3 data-icon="inline-start" />
              <span className="hidden sm:inline">{t("orderQueue.viewTable")}</span>
            </ToggleGroupItem>
          </ToggleGroup>
        ) : null}

        {showRefresh ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon-lg"
                className="rounded-lg"
                aria-label={t("actions.refresh")}
                disabled={loading}
                onClick={onRefresh}
              >
                {loading ? <Spinner /> : <RefreshCcw />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {loadedClock
                ? `${t("actions.refresh")} · ${t("orderQueue.updatedAt", { time: loadedClock })}`
                : t("actions.refresh")}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </div>
  );
}
