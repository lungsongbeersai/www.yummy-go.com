"use client";

import { ArrowLeftRight, Banknote, CircleX, HandCoins, TrendingUp, Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";
import { money } from "@/lib/format";
import type { DailyStoreClosingReport } from "@/stores/report-store";
import { ReportStatCards, type ReportStat } from "../shared/report-stat-cards";
import { dailyClosingLabel } from "./daily-closing-report-utils";

// การ์ดสรุปยอดปิดร้าน — ยอดขายสุทธิเป็นใบ highlight ใบเดียว (จุดเน้นสูงสุดจุดเดียวเหมือนใบเสร็จ)
// สีวิธีชำระตรงกับรายงานวิธีชำระ: เงินสด=เขียว, โอน=ฟ้า, ติดหนี้=ส้ม (ค้างรับ ไม่ใช่ข้อผิดพลาด จึงไม่ใช่แดง)
// สีแดงสงวนไว้ให้ "บิลที่ยกเลิก" — ตัวเลขที่ผู้จัดการควรสังเกตตอนปิดยอด
export function DailyClosingPaymentCards({
  className,
  report,
}: {
  className?: string;
  report: DailyStoreClosingReport;
}) {
  const { t } = useTranslation();
  const apiLabels = report.labels;
  const { cancelSummary, paymentSummary, summary } = report;

  const stats: ReportStat[] = [
    {
      icon: TrendingUp,
      key: "grandTotal",
      label: dailyClosingLabel(apiLabels.grandTotal, t("report.dailyClosing.grandTotal")),
      tone: "highlight",
      value: money(summary.grandTotal),
    },
    {
      icon: Banknote,
      key: "cash",
      label: dailyClosingLabel(apiLabels.cash, t("report.dailyClosing.cash")),
      tone: "success",
      value: money(paymentSummary.cash),
    },
    {
      icon: ArrowLeftRight,
      key: "transfer",
      label: dailyClosingLabel(apiLabels.transfer, t("report.dailyClosing.transfer")),
      tone: "info",
      value: money(paymentSummary.transfer),
    },
    {
      icon: HandCoins,
      key: "credit",
      label: dailyClosingLabel(apiLabels.credit, t("report.dailyClosing.credit")),
      tone: "warning",
      value: money(paymentSummary.credit),
    },
    {
      icon: Wallet,
      key: "paymentTotal",
      label: dailyClosingLabel(apiLabels.paymentTotal, t("report.dailyClosing.paymentTotal")),
      tone: "primary",
      value: money(paymentSummary.paymentTotal),
    },
    {
      icon: CircleX,
      key: "cancel",
      label: `${dailyClosingLabel(apiLabels.cancelBill, t("report.dailyClosing.cancelBill"))} (${cancelSummary.billCount.toLocaleString("en-US")})`,
      negative: cancelSummary.totalAmount > 0,
      tone: "danger",
      value: money(cancelSummary.totalAmount),
    },
  ];

  return <ReportStatCards className={className} stats={stats} />;
}
