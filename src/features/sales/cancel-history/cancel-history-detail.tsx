"use client";

import type { ReactNode } from "react";
import { CalendarDays, Package, Quote, UserRound, Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/common/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CancelHistoryBill } from "@/stores/cancel-store";
import { cancelHistoryClock, cancelHistoryDay } from "./cancel-history-utils";

export function CancelHistoryDetailPanel({
  className,
  row,
  variant = "panel"
}: {
  className?: string;
  row: CancelHistoryBill | null;
  variant?: "panel" | "drawer";
}) {
  const { t } = useTranslation();
  // py-0/gap-0 กัน py และ gap ฐานของ Card บวกซ้อนกับระยะของ CardHeader/CardContent — ดู sales-list-filters.tsx
  const cardClass = cn(
    "min-h-0 gap-0 overflow-hidden rounded-none border-x-0 border-b-0 border-border bg-card py-0 shadow-none xl:flex xl:min-h-0 xl:flex-col",
    className
  );

  if (!row) {
    return (
      <Card className={cardClass}>
        <div className="flex min-h-96 flex-1 items-center justify-center p-4">
          <EmptyState title={t("cancelHistory.noSelection")} description={t("cancelHistory.selectHint")} />
        </div>
      </Card>
    );
  }

  const body = (
    <div className="flex flex-col gap-4 p-3 sm:p-4">
      <CancellationCard row={row} />
      <BillInfoGrid row={row} />
    </div>
  );

  if (variant === "drawer") {
    return (
      <Card className={cardClass}>
        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          <div className="min-h-0 flex-1 overflow-auto pb-[var(--pos-system-bottom-safe-area,0px)]">
            <div className="border-b border-border px-4 pt-1 pb-3">
              <DetailHeading row={row} />
            </div>
            {body}
            <BillSummary row={row} />
          </div>
        </CardContent>
      </Card>
    );
  }

  // จอกว้างมาก (2xl) สรุปยอดย้ายไปคอลัมน์ขวา แบบเดียวกับ sales-list / cancel-sale
  return (
    <Card className={cardClass}>
      <CardHeader className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3 [.border-b]:pb-3">
        <DetailHeading row={row} />
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col p-0 2xl:flex-row">
        <div className="min-h-0 flex-1 overflow-auto">{body}</div>
        <BillSummary row={row} className="2xl:w-88 2xl:border-t-0 2xl:border-l" />
      </CardContent>
    </Card>
  );
}

export function CancelHistoryDetailDrawer({
  open,
  row,
  onOpenChange
}: {
  open: boolean;
  row: CancelHistoryBill | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92dvh] gap-0 overflow-hidden rounded-t-xl xl:hidden">
        <DrawerHeader className="sr-only">
          <DrawerTitle>{row?.invoice || t("cancelHistory.billDetail")}</DrawerTitle>
          <DrawerDescription>{t("cancelHistory.selectHint")}</DrawerDescription>
        </DrawerHeader>
        <div className="min-h-0 flex-1 overflow-hidden">
          <CancelHistoryDetailPanel row={row} className="flex h-full flex-col rounded-none border-0 shadow-none" variant="drawer" />
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function DetailHeading({ row }: { row: CancelHistoryBill }) {
  const { t } = useTranslation();
  const meta = [row.tableName ? `${t("cancelHistory.columns.table")} ${row.tableName}` : "", row.branchName]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <p className="text-xs leading-5 text-muted-foreground">{t("cancelHistory.billDetail")}</p>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <CardTitle className="truncate text-xl leading-7 font-bold tabular-nums">{row.invoice || "-"}</CardTitle>
        {/* status_name จาก API ("ຍົກເລີກບິນ") — ทุกแถวในหน้านี้เป็นบิลที่ยกเลิกแล้วอยู่ดี จึงเหลือไว้แค่ที่หัวแผง */}
        <Badge className="shrink-0 border-destructive/25 bg-destructive/10 px-1.5 py-0 text-2xs leading-4 text-destructive">
          {row.statusName || t("cancelHistory.columns.status")}
        </Badge>
      </div>
      {meta ? <p className="truncate text-sm leading-5 text-muted-foreground">{meta}</p> : null}
    </div>
  );
}

// เหตุผล + ใครยกเลิก + เมื่อไร — คำถามหลักของหน้าประวัติ จึงอยู่บนสุดของแผงในกล่องสีเตือน
function CancellationCard({ row }: { row: CancelHistoryBill }) {
  const { t } = useTranslation();
  const cancelDay = cancelHistoryDay(row.cancelledAt);
  const cancelClock = cancelHistoryClock(row.cancelledAt);
  const cancelledAt = row.cancelledAt ? [cancelDay.label, cancelClock].filter(Boolean).join(" ") : "-";

  return (
    <section
      aria-label={t("cancelHistory.cancellation")}
      className="flex flex-col gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3 sm:p-4"
    >
      <div className="flex items-start gap-2.5">
        <Quote aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="text-xs font-medium text-destructive">{t("cancelHistory.columns.reason")}</h3>
          <p className={cn("text-base leading-6 font-semibold wrap-break-word", row.cancelReason ? "text-foreground" : "text-muted-foreground italic")}>
            {row.cancelReason || t("cancelHistory.noReason")}
          </p>
        </div>
      </div>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-2 border-t border-destructive/15 pt-3 sm:grid-cols-2">
        <InfoItem icon={<UserRound />} label={t("cancelHistory.cancelledBy")} value={row.cancelledByName || "-"} />
        <InfoItem icon={<CalendarDays />} label={t("cancelHistory.columns.cancelledAt")} value={cancelledAt} />
      </dl>
    </section>
  );
}

function BillInfoGrid({ row }: { row: CancelHistoryBill }) {
  const { t } = useTranslation();

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg bg-muted/50 p-3 md:grid-cols-4">
      <InfoItem icon={<CalendarDays />} label={t("cancelHistory.columns.orderDate")} value={row.orderDate ? cancelHistoryDay(row.orderDate).label : "-"} />
      <InfoItem icon={<Package />} label={t("cancelHistory.columns.qty")} value={row.orderQty.toLocaleString("en-US")} />
      <InfoItem icon={<Wallet />} label={t("cancelHistory.columns.paidTotal")} value={money(row.paidTotal)} />
      <InfoItem
        icon={<Wallet />}
        label={t("cancelHistory.columns.balance")}
        tone={row.balance > 0 ? "warning" : undefined}
        value={money(row.balance)}
      />
    </dl>
  );
}

function InfoItem({ icon, label, tone, value }: { icon: ReactNode; label: string; tone?: "warning"; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground [&_svg]:size-3.5 [&_svg]:shrink-0">
        {icon}
        <span className="truncate">{label}</span>
      </dt>
      <dd className={cn("text-sm leading-5 font-medium wrap-break-word tabular-nums", tone === "warning" ? "text-warning-text" : "text-foreground")}>
        {value}
      </dd>
    </div>
  );
}

// สรุปยอดแบบท้ายใบเสร็จ — แถวที่เป็น 0 (ส่วนลด/ค่าบริการ/VAT) ซ่อนไว้ ยอดสุทธิขีดฆ่าเพราะไม่นับเป็นยอดขายแล้ว
function BillSummary({ row, className }: { row: CancelHistoryBill; className?: string }) {
  const { t } = useTranslation();
  const lines = [
    { key: "orderTotal", label: t("cancelHistory.columns.orderTotal"), value: row.orderTotal, always: true },
    { key: "discount", label: t("cancelHistory.columns.discount"), value: row.discountAmount, discount: true },
    { key: "subtotal", label: t("cancelHistory.columns.subtotal"), value: row.subtotal, hidden: row.subtotal === row.orderTotal },
    { key: "service", label: t("cancelHistory.columns.serviceCharge"), value: row.serviceAmount },
    { key: "vat", label: t("cancelHistory.columns.vat"), value: row.vatAmount }
  ].filter((line) => !line.hidden && (line.always || line.value > 0));

  return (
    <section aria-label={t("cancelHistory.billSummary")} className={cn("shrink-0 border-t border-border bg-muted/30 px-4 py-3", className)}>
      <h3 className="text-xs font-medium text-muted-foreground">{t("cancelHistory.billSummary")}</h3>
      <dl className="mt-2 flex flex-col gap-1.5">
        {lines.map((line) => (
          <div key={line.key} className="flex min-w-0 items-baseline justify-between gap-3 text-sm leading-5">
            <dt className="min-w-0 wrap-break-word text-muted-foreground">{line.label}</dt>
            <dd className={cn("shrink-0 tabular-nums", line.discount ? "text-destructive" : "text-foreground")}>
              {line.discount ? `-${money(line.value)}` : money(line.value)}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 flex min-w-0 items-baseline justify-between gap-3 border-t border-dashed border-border pt-3">
        <span className="truncate text-sm font-semibold text-foreground">{t("cancelHistory.columns.grandTotal")}</span>
        <span className="shrink-0 text-2xl leading-8 font-bold tabular-nums text-muted-foreground line-through decoration-destructive/60">
          {money(row.grandTotal)}
        </span>
      </div>
    </section>
  );
}
