"use client";

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
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
// actions = ปุ่มไอคอนท้ายแถว (รีเฟรช/สลับการ์ดสรุป) วางไว้ที่นี่เพื่อไม่ให้ซ้ำกับแถบเครื่องมือของจอเล็ก
export function ReportFilterCard({
  actions,
  actionsClassName,
  canApply,
  children,
  className,
  contentClassName,
  loading,
  onApply,
}: {
  actions?: ReactNode;
  // ช่องของปุ่ม "ใช้" ในกริด — รายงานที่ field มี col-span ของตัวเองต้องกำหนดช่องนี้ให้ตรงกันด้วย
  actionsClassName?: string;
  canApply: boolean;
  children: ReactNode;
  className?: string;
  contentClassName: string;
  loading: boolean;
  onApply: () => void;
}) {
  // py-0 กัน py ฐานของ Card (16px) บวกซ้อนกับ py ที่ contentClassName ของแต่ละหน้ารายงานกำหนดเอง
  // (เช่น py-3) — component นี้ใช้ร่วมกันทุกหน้ารายงาน แก้จุดเดียวที่นี่ครอบคลุมทั้งหมด
  return (
    <Card className={cn("min-w-0 border-border bg-card py-0 shadow-sm", className)}>
      <CardContent className={contentClassName}>
        {children}
        {/* flex-wrap เป็นตัวกันพลาด: ถ้าช่องในกริดแคบกว่าปุ่ม+ไอคอนรวมกัน ให้ตกบรรทัดแทนที่จะถูกตัดหาย */}
        <div className={cn("flex min-w-0 flex-wrap items-center gap-2", actionsClassName)}>
          <ReportApplyButton
            canApply={canApply}
            className="h-9 min-w-20 flex-1"
            loading={loading}
            onApply={onApply}
          />
          {actions}
        </div>
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
          <DialogTitle className="text-base font-semibold">
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
