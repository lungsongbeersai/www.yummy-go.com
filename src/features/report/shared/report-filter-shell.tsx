"use client";

import type { ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DateFilterButton } from "@/components/common/date-filter-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// ปุ่ม "ใช้ตัวกรอง" มาตรฐานของทุกหน้ารายงาน (มี spinner ตอนโหลด)
export function ReportApplyButton({
  canApply,
  className,
  loading,
  onApply,
}: {
  canApply: boolean;
  className?: string;
  loading: boolean;
  onApply: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Button
      type="button"
      className={className}
      disabled={loading || !canApply}
      onClick={onApply}
    >
      {loading ? <Spinner aria-hidden="true" data-icon="inline-start" /> : null}
      {t("report.apply")}
    </Button>
  );
}

// การ์ดแถบตัวกรอง (จอใหญ่): Card + grid ของ fields + ปุ่ม apply
// contentClassName กำหนด layout ของ grid ต่อรายงาน (จำนวนคอลัมน์ต่างกัน)
export function ReportFilterCard({
  canApply,
  children,
  contentClassName,
  loading,
  onApply,
}: {
  canApply: boolean;
  children: ReactNode;
  contentClassName: string;
  loading: boolean;
  onApply: () => void;
}) {
  return (
    <Card className="min-w-0 border-border bg-card shadow-sm">
      <CardContent className={contentClassName}>
        {children}
        <ReportApplyButton
          canApply={canApply}
          className="h-9 min-w-28"
          loading={loading}
          onApply={onApply}
        />
      </CardContent>
    </Card>
  );
}

// Dialog ตัวกรอง (จอเล็ก): header + พื้นที่เลื่อน + footer ปิด/ใช้ตัวกรอง
// gridClassName ต่างกันตามจำนวน field ของแต่ละรายงาน ที่เหลือมาตรฐานเดียวกัน
export function ReportFilterSheet({
  canApply,
  children,
  description,
  gridClassName,
  loading,
  onApply,
  onOpenChange,
  open,
}: {
  canApply: boolean;
  children: ReactNode;
  description: string;
  gridClassName: string;
  loading: boolean;
  onApply: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="shrink-0 border-b border-border px-4 py-3 pr-12 text-left">
          <DialogTitle className="text-base font-black">
            {t("report.filters.currentFilters")}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className={cn("grid gap-3", gridClassName)}>{children}</div>
        </div>
        <DialogFooter className="grid grid-cols-2 gap-2 border-t border-border bg-card/95 px-4 py-3 backdrop-blur sm:flex">
          <DialogClose asChild>
            <Button type="button" variant="outline">
              {t("actions.close")}
            </Button>
          </DialogClose>
          <ReportApplyButton canApply={canApply} loading={loading} onApply={onApply} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// แถบสรุปตัวกรอง (จอเล็ก): ปุ่มช่วงวันที่ + แถว Badge สรุป + ปุ่มเปิดตัวกรอง
// badges = Badge เฉพาะของแต่ละรายงาน
export function ReportMobileFilterSummary({
  badges,
  dateRangeLabel,
  onOpen,
}: {
  badges: ReactNode;
  dateRangeLabel: string;
  onOpen: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="rounded-md border border-border bg-card p-2 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <DateFilterButton
            ariaLabel={`${t("report.filters.openFilters")}: ${dateRangeLabel}`}
            className="h-8 max-w-full rounded-md border-border/70 bg-muted/50 px-2 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
            label={dateRangeLabel}
            onClick={onOpen}
          />
          <div className="mt-1 flex min-w-0 flex-wrap gap-1">{badges}</div>
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
