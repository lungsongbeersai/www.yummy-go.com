"use client";

import type { ComponentType } from "react";
import { BadgePercent, Landmark, Package, ReceiptText, UtensilsCrossed, Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ApiEntity } from "@/services/shared/types";
import { firstNumber } from "./sales-list-utils";

type SalesListSummaryCardTone = "danger" | "neutral";

interface SalesListSummaryCardConfig {
  icon: ComponentType<{ className?: string }>;
  key: string;
  kind: "count" | "money";
  label: string;
  tone: SalesListSummaryCardTone;
}

export function SalesListSummaryCards({ reportTotal }: { reportTotal: ApiEntity }) {
  const { t } = useTranslation();
  const itemDiscount = firstNumber(reportTotal, ["discount_item"]);
  const billDiscount = firstNumber(reportTotal, ["discount_bill"]);
  // การ์ดนี้เดิมแยก "ส่วนลดรายการ" กับ "ส่วนลดบิล" เป็น 2 ใบ + "ส่วนลดรวม" อีก 1 ใบ
  // ทั้งที่ใบที่ 3 คือผลรวมของ 2 ใบแรก — รวมเหลือใบเดียว แจกแจงเป็น subtext แทน ลดการซ้ำซ้อน
  const discountBreakdown =
    itemDiscount > 0 && billDiscount > 0
      ? t("salesList.summary.discountBreakdown", { item: money(itemDiscount), bill: money(billDiscount) })
      : undefined;

  const cards: SalesListSummaryCardConfig[] = [
    { icon: ReceiptText, key: "bill_count", kind: "count", label: t("salesList.summary.bills"), tone: "neutral" },
    { icon: Package, key: "total_qty", kind: "count", label: t("salesList.summary.qty"), tone: "neutral" },
    { icon: Wallet, key: "amount", kind: "money", label: t("salesList.summary.amount"), tone: "neutral" },
    { icon: BadgePercent, key: "sum_discount", kind: "money", label: t("salesList.summary.discount"), tone: "danger" },
    { icon: UtensilsCrossed, key: "sum_servicecharge", kind: "money", label: t("salesList.summary.serviceCharge"), tone: "neutral" },
    { icon: Landmark, key: "sum_vate", kind: "money", label: t("salesList.summary.vat"), tone: "neutral" }
  ];

  return (
    <section className="flex flex-col gap-2">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <SalesListSummaryCard
            key={card.key}
            card={card}
            subtext={card.key === "sum_discount" ? discountBreakdown : undefined}
            value={firstNumber(reportTotal, [card.key])}
          />
        ))}
      </div>
      {/* ยอดรวมสุทธิเป็นจุดโฟกัสเดียว แยกออกจากกริดเพื่อไม่ให้ปนกับตัวเลขอื่นที่มีน้ำหนักสายตาเท่ากัน */}
      <SalesListTotalCard value={firstNumber(reportTotal, ["sum_total"])} />
    </section>
  );
}

function SalesListSummaryCard({
  card,
  subtext,
  value
}: {
  card: SalesListSummaryCardConfig;
  subtext?: string;
  value: number;
}) {
  const Icon = card.icon;

  return (
    <Card className="overflow-hidden rounded-md border border-border bg-card py-0 shadow-none">
      <CardContent className="flex items-start gap-2.5 p-2.5">
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-md",
            card.tone === "danger" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
          )}
        >
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs leading-5 text-muted-foreground">{card.label}</p>
          <p
            className={cn(
              "truncate text-lg leading-7 font-medium tabular-nums text-foreground",
              card.tone === "danger" && value > 0 && "text-destructive"
            )}
          >
            {card.kind === "money" ? money(value) : value.toLocaleString("en-US")}
          </p>
          {subtext ? <p className="truncate text-2xs leading-4 text-muted-foreground">{subtext}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function SalesListTotalCard({ value }: { value: number }) {
  const { t } = useTranslation();

  return (
    <Card className="overflow-hidden rounded-md border border-primary/25 bg-primary/5 py-0 shadow-none">
      <CardContent className="flex items-center justify-between gap-3 p-3">
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
            <Wallet className="size-4.5" />
          </span>
          <span className="truncate text-sm font-medium text-foreground">{t("salesList.summary.total")}</span>
        </span>
        <span className="shrink-0 text-2xl leading-8 font-bold tabular-nums text-primary">{money(value)}</span>
      </CardContent>
    </Card>
  );
}
