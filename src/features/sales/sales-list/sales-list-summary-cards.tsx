"use client";

import type { ComponentType } from "react";
import { BadgePercent, Landmark, Package, ReceiptText, UtensilsCrossed, Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ApiEntity } from "@/services/shared/types";
import { firstNumber } from "./sales-list-utils";

interface SalesListSummaryStatConfig {
  icon: ComponentType<{ className?: string }>;
  key: string;
  kind: "count" | "money";
  label: string;
  tone?: "danger";
}

// แถบสรุปยอดแบบใบเดียว (เดิมเป็นการ์ดแยก 6 ใบ + การ์ดยอดรวมอีกแถว กินความสูงจอ ~180px)
// ยอดรวมสุทธิเป็นช่องเด่นช่องแรก ตัวเลขอื่นเป็นช่องเล็กเรียงต่อกันคั่นด้วยเส้น 1px
export function SalesListSummaryCards({ reportTotal }: { reportTotal: ApiEntity }) {
  const { t } = useTranslation();
  const itemDiscount = firstNumber(reportTotal, ["discount_item"]);
  const billDiscount = firstNumber(reportTotal, ["discount_bill"]);
  // "ส่วนลดรวม" = ส่วนลดรายการ + ส่วนลดบิล — โชว์ช่องเดียวแล้วแจกแจงเป็น subtext แทนการแยก 3 ช่อง
  const discountBreakdown =
    itemDiscount > 0 && billDiscount > 0
      ? t("salesList.summary.discountBreakdown", { item: money(itemDiscount), bill: money(billDiscount) })
      : undefined;

  const stats: SalesListSummaryStatConfig[] = [
    { icon: ReceiptText, key: "bill_count", kind: "count", label: t("salesList.summary.bills") },
    { icon: Package, key: "total_qty", kind: "count", label: t("salesList.summary.qty") },
    { icon: Wallet, key: "amount", kind: "money", label: t("salesList.summary.amount") },
    { icon: BadgePercent, key: "sum_discount", kind: "money", label: t("salesList.summary.discount"), tone: "danger" },
    { icon: UtensilsCrossed, key: "sum_servicecharge", kind: "money", label: t("salesList.summary.serviceCharge") },
    { icon: Landmark, key: "sum_vate", kind: "money", label: t("salesList.summary.vat") }
  ];

  // gap-px บนพื้น bg-border = เส้นคั่น 1px ระหว่างช่องโดยไม่ต้องคุม border ทีละขอบ
  // ทุก breakpoint ช่องเต็มแถวพอดี (ยอดรวมกินเต็มแถว + 6 ช่อง = 3x2, xl = 7 ช่องแถวเดียว) จึงไม่มีช่องโหว่สีเส้น
  return (
    <Card className="gap-0 overflow-hidden rounded-lg border border-border py-0 shadow-none">
      <dl className="grid grid-cols-3 gap-px bg-border xl:grid-cols-[minmax(13rem,1.5fr)_repeat(6,minmax(0,1fr))]">
        <div className="col-span-3 flex items-center justify-between gap-3 bg-primary/5 px-3 py-2.5 sm:px-4 sm:py-3 xl:col-span-1 xl:flex-col xl:items-start xl:justify-center xl:gap-0.5">
          <dt className="flex items-center gap-1.5 text-xs font-medium text-primary-text">
            <Wallet aria-hidden="true" className="size-3.5" />
            {t("salesList.summary.total")}
          </dt>
          <dd className="text-xl leading-7 font-bold tabular-nums text-primary-text xl:text-2xl xl:leading-8">
            {money(firstNumber(reportTotal, ["sum_total"]))}
          </dd>
        </div>
        {stats.map((stat) => (
          <SalesListSummaryStat
            key={stat.key}
            stat={stat}
            subtext={stat.key === "sum_discount" ? discountBreakdown : undefined}
            value={firstNumber(reportTotal, [stat.key])}
          />
        ))}
      </dl>
    </Card>
  );
}

function SalesListSummaryStat({
  stat,
  subtext,
  value
}: {
  stat: SalesListSummaryStatConfig;
  subtext?: string;
  value: number;
}) {
  const Icon = stat.icon;
  // ส่วนลดเป็น 0 ไม่ใช่เรื่องต้องระวัง — แดงเฉพาะตอนมีส่วนลดจริง
  const danger = stat.tone === "danger" && value > 0;

  return (
    <div className="flex min-w-0 flex-col justify-center gap-0.5 bg-card px-2.5 py-2 sm:px-3 sm:py-2.5 xl:px-4">
      <dt className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className={cn("size-3.5 shrink-0", danger && "text-destructive")} />
        <span className="truncate">{stat.label}</span>
      </dt>
      <dd
        className={cn(
          "truncate text-sm leading-5 font-semibold sm:text-base sm:leading-6 tabular-nums text-foreground",
          danger && "text-destructive"
        )}
      >
        {stat.kind === "money" ? money(value) : value.toLocaleString("en-US")}
      </dd>
      {subtext ? <dd className="truncate text-2xs leading-4 text-muted-foreground">{subtext}</dd> : null}
    </div>
  );
}
