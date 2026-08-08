"use client";

import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DailyStoreClosingReport } from "@/stores/report-store";
import { dailyClosingLabel } from "./daily-closing-report-utils";

interface DailyClosingPaymentCardsProps {
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

// การ์ดสรุปยอดปิดร้าน — ยอดขายสุทธิ (grand total) เป็นจุดเน้นเดียว (primary) ตามหลักการ
// เดียวกับใบเสร็จ: มีจุดเน้นสูงสุดจุดเดียว ไม่ใช่ทุกการ์ดแข่งกันเด่น
// "เครดิต" เป็นแค่วิธีชำระเงิน ไม่ใช่ปัญหา จึงไม่ใช้สีแดง (danger) เหมือนเวอร์ชันก่อน —
// ย้ายสีแดงไปที่ "บิลที่ยกเลิก" แทน เพราะเป็นตัวเลขที่ผู้จัดการควรสังเกตตอนปิดยอด
export function DailyClosingPaymentCards({ report }: DailyClosingPaymentCardsProps) {
  const { t } = useTranslation();
  const apiLabels = report.labels;
  const { cancelSummary, paymentSummary, summary } = report;

  const cards: Array<{
    key: string;
    label: string;
    value: string;
    variant: PaymentCardVariant;
  }> = [
    {
      key: "grandTotal",
      label: dailyClosingLabel(apiLabels.grandTotal, t("report.dailyClosing.grandTotal")),
      value: money(summary.grandTotal),
      variant: "primary",
    },
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
      variant: "default",
    },
    {
      key: "paymentTotal",
      label: dailyClosingLabel(apiLabels.paymentTotal, t("report.dailyClosing.paymentTotal")),
      value: money(paymentSummary.paymentTotal),
      variant: "default",
    },
    {
      key: "cancel",
      label: `${dailyClosingLabel(apiLabels.cancelBill, t("report.dailyClosing.cancelBill"))} (${cancelSummary.billCount.toLocaleString("en-US")})`,
      value: money(cancelSummary.totalAmount),
      variant: "danger",
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
