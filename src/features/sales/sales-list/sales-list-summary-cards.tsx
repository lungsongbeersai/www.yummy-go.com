"use client";

import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ApiEntity } from "@/services/shared/types";
import { firstNumber } from "./sales-list-utils";

type SalesListSummaryCardTone = "danger" | "neutral" | "primary";

interface SalesListSummaryCardConfig {
  key: string;
  kind: "count" | "money";
  label: string;
  tone: SalesListSummaryCardTone;
}

export function SalesListSummaryCards({ reportTotal }: { reportTotal: ApiEntity }) {
  const { t } = useTranslation();
  const cards: SalesListSummaryCardConfig[] = [
    { key: "bill_count", kind: "count", label: t("salesList.summary.bills"), tone: "neutral" },
    { key: "total_qty", kind: "count", label: t("salesList.summary.qty"), tone: "neutral" },
    { key: "amount", kind: "money", label: t("salesList.summary.amount"), tone: "neutral" },
    { key: "discount_item", kind: "money", label: t("salesList.summary.itemDiscount"), tone: "danger" },
    { key: "discount_bill", kind: "money", label: t("salesList.summary.billDiscount"), tone: "danger" },
    { key: "sum_discount", kind: "money", label: t("salesList.summary.discount"), tone: "danger" },
    { key: "sum_servicecharge", kind: "money", label: t("salesList.summary.serviceCharge"), tone: "neutral" },
    { key: "sum_vate", kind: "money", label: t("salesList.summary.vat"), tone: "neutral" },
    { key: "sum_total", kind: "money", label: t("salesList.summary.total"), tone: "primary" }
  ];

  // 9 การ์ด → 3 คอลัมน์ลงตัวพอดี 3 แถว (เดิม 6 คอลัมน์ทำให้แถวสุดท้ายเหลือ 3 ใบ)
  return (
    <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <SalesListSummaryCard key={card.key} card={card} value={firstNumber(reportTotal, [card.key])} />
      ))}
    </section>
  );
}

function SalesListSummaryCard({
  card,
  value
}: {
  card: SalesListSummaryCardConfig;
  value: number;
}) {
  return (
    // เหลือการ์ดเดียวที่มีสีพื้น (ยอดรวมสุทธิ) ที่เหลือเรียบ เพื่อให้สายตาจับตัวเลขสำคัญได้ทันที
    <Card
      className={cn(
        "overflow-hidden rounded-md border shadow-none",
        card.tone === "primary" ? "border-primary/25 bg-primary/5" : "border-border bg-card"
      )}
    >
      <CardContent className="p-2.5">
        <p className="truncate text-xs leading-5 text-muted-foreground">{card.label}</p>
        <p
          className={cn(
            "mt-0.5 truncate text-lg leading-7 tabular-nums",
            card.tone === "primary" && "font-bold text-primary",
            card.tone === "danger" && "font-medium text-destructive",
            card.tone === "neutral" && "font-medium text-foreground"
          )}
        >
          {card.kind === "money" ? money(value) : value.toLocaleString("en-US")}
        </p>
      </CardContent>
    </Card>
  );
}
