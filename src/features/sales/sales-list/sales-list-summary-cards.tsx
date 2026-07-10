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
    { key: "amount", kind: "money", label: t("salesList.summary.amount"), tone: "primary" },
    { key: "discount_item", kind: "money", label: t("salesList.summary.itemDiscount"), tone: "danger" },
    { key: "discount_bill", kind: "money", label: t("salesList.summary.billDiscount"), tone: "danger" },
    { key: "sum_discount", kind: "money", label: t("salesList.summary.discount"), tone: "danger" },
    { key: "sum_servicecharge", kind: "money", label: t("salesList.summary.serviceCharge"), tone: "neutral" },
    { key: "sum_vate", kind: "money", label: t("salesList.summary.vat"), tone: "neutral" },
    { key: "sum_total", kind: "money", label: t("salesList.summary.total"), tone: "primary" }
  ];

  return (
    <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
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
    <Card
      className={cn(
        "overflow-hidden rounded-md border shadow-sm",
        card.tone === "primary" && "border-primary/20 bg-primary/5 shadow-primary/5",
        card.tone === "danger" && "border-destructive/20 bg-destructive/5 shadow-destructive/5",
        card.tone === "neutral" && "border-border bg-muted/20"
      )}
    >
      <CardContent className="p-2.5">
        <p
          className={cn(
            "truncate text-[11px] font-black leading-4",
            card.tone === "primary" && "text-primary",
            card.tone === "danger" && "text-destructive",
            card.tone === "neutral" && "text-muted-foreground"
          )}
        >
          {card.label}
        </p>
        <p className="mt-1 truncate text-base font-black tabular-nums text-foreground sm:text-lg">
          {card.kind === "money" ? money(value) : value.toLocaleString("en-US")}
        </p>
      </CardContent>
    </Card>
  );
}
