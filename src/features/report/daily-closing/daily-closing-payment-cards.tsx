"use client";

import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DailyStoreClosingReport } from "@/stores/report-store";
import { dailyClosingLabel } from "./daily-closing-report-utils";

interface DailyClosingPaymentCardsProps {
  // balanced: boolean;
  // paymentDifference: number;
  report: DailyStoreClosingReport;
}

type PaymentCardVariant = "default" | "primary" | "danger";

const CARD_STYLES: Record<PaymentCardVariant, { card: string; label: string; value: string }> = {
  default: {
    card: "border-border bg-card",
    label: "text-muted-foreground",
    value: "text-foreground",
  },
  primary: {
    card: "border-border border-l-4 border-l-primary bg-card",
    label: "text-primary",
    value: "text-primary",
  },
  danger: {
    card: "border-border border-l-4 border-l-destructive bg-card",
    label: "text-destructive",
    value: "text-destructive",
  },
};

// การ์ดสรุปการรับเงิน — ใช้ข้อมูลและ label ชุดเดียวกับส่วน "สະຫຼຸບລາຍຮັບ" ในใบเสร็จ
// เพื่อให้ผู้ใช้เห็นยอดสำคัญด้านบนโดยไม่ต้องเลื่อนใบเสร็จ
export function DailyClosingPaymentCards({
  // balanced,
  // paymentDifference,
  report,
}: DailyClosingPaymentCardsProps) {
  const { t } = useTranslation();
  const apiLabels = report.labels;
  const { cancelSummary, paymentSummary } = report;

  const cards: Array<{
    key: string;
    label: string;
    value: string;
    variant: PaymentCardVariant;
  }> = [
    {
      key: "cash",
      label: dailyClosingLabel(apiLabels.cash, t("report.dailyClosing.cash")),
      value: money(paymentSummary.cash),
      variant: "default",
    },
    {
      key: "transfer",
      label: dailyClosingLabel(apiLabels.transfer, t("report.dailyClosing.transfer")),
      value: money(paymentSummary.transfer),
      variant: "default",
    },
    {
      key: "credit",
      label: dailyClosingLabel(apiLabels.credit, t("report.dailyClosing.credit")),
      value: money(paymentSummary.credit),
      variant: "danger",
    },
    {
      key: "paymentTotal",
      label: dailyClosingLabel(apiLabels.paymentTotal, t("report.dailyClosing.paymentTotal")),
      value: money(paymentSummary.paymentTotal),
      variant: "primary",
    },
    // {
    //   key: "difference",
    //   label: t("report.dailyClosing.difference"),
    //   value: money(paymentDifference),
    //   variant: balanced ? "default" : "danger",
    // },
    {
      key: "cancel",
      label: `${dailyClosingLabel(apiLabels.cancelBill, t("report.dailyClosing.cancelBill"))} (${cancelSummary.billCount.toLocaleString("en-US")})`,
      value: money(cancelSummary.totalAmount),
      variant: "default",
    },
  ];

  return (
    <section className="flex flex-col gap-3" aria-label={t("report.dailyClosing.salesSummary")}>
      <h2 className="text-sm font-bold text-muted-foreground">
        {t("report.dailyClosing.salesSummary")}
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {cards.map((card) => {
          const styles = CARD_STYLES[card.variant];
          return (
            <Card
              key={card.key}
              className={cn("overflow-hidden shadow-sm", styles.card)}
            >
              <CardContent className="p-4">
                <p className={cn("truncate text-xs font-semibold", styles.label)}>
                  {card.label}
                </p>
                <p className={cn("mt-1 text-lg font-black tabular-nums", styles.value)}>
                  {card.value}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
