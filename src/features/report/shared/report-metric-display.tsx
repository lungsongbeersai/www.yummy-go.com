"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { displayMetric, type ReportMetricKind } from "./report-metrics";

export interface ReportSummaryCard {
  key: string;
  kind: ReportMetricKind;
  label: string;
  value: unknown;
}

export interface ReportSummaryCardsGridProps<TCard extends ReportSummaryCard> {
  cardClassName?: (card: TCard) => string | undefined;
  cards: TCard[];
  gridClassName: string;
  labelClassName?: (card: TCard) => string | undefined;
  valueClassName?: (card: TCard) => string | undefined;
}

// กริดการ์ดสรุปตัวเลขบนหัวรายงาน — โทนสี (border/label/value) ต่างกันจริงต่อรายงาน
// (payment-methods เน้นแดงเมื่อเป็นส่วนลด, best-selling ไล่โทนตามหมวด, category-sales ไม่มีโทนเลย)
// จึงรับ className callback จากผู้เรียกแทนกฎเดียวตายตัว ส่วนโครง Card/CardContent ใช้ร่วมกัน
export function ReportSummaryCardsGrid<TCard extends ReportSummaryCard>({
  cardClassName,
  cards,
  gridClassName,
  labelClassName,
  valueClassName,
}: ReportSummaryCardsGridProps<TCard>) {
  return (
    <section className={cn("grid gap-3", gridClassName)}>
      {cards.map((card) => (
        <Card
          key={card.key}
          className={cn("overflow-hidden border-border bg-card shadow-sm", cardClassName?.(card))}
        >
          <CardContent className="p-4">
            <p className={cn("truncate text-xs font-black uppercase", labelClassName?.(card))}>
              {card.label}
            </p>
            <p className={cn("mt-2 truncate text-xl tabular-nums", valueClassName?.(card))}>
              {displayMetric(card.value, card.kind)}
            </p>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
