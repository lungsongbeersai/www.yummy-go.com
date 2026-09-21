"use client";

import type { RefObject } from "react";
import { useTranslation } from "react-i18next";
import { money } from "@/lib/format";
import type { ZoneSalesRow, ZoneSalesSummary } from "@/services/report";
import {
  ReportOfficialHeader,
  ReportSignatures,
} from "@/lib/export/official-layout";
import { zoneOptionLabel, zoneSalesSummaryMetricConfigs } from "./zone-sales-utils";

// พื้นผิวสำหรับ export PDF (captureElementToPdf จับภาพ element นี้) — โครงเดียวกับ
// EmployeeSalesExportSurface: หัวรายงานทางการ → ส่วนสรุป (ถ้าเปิดอยู่) → ตารางหลัก → ลายเซ็น
export function ZoneSalesExportSurface({
  containerRef,
  dateRange,
  language,
  rows,
  showSummary,
  summary,
  title,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  dateRange: string;
  language: string;
  rows: ZoneSalesRow[];
  showSummary: boolean;
  summary: ZoneSalesSummary;
  title: string;
}) {
  const { t } = useTranslation();
  const summaryMetrics = zoneSalesSummaryMetricConfigs(t);

  return (
    <div ref={containerRef} className="report-print-surface">
      <ReportOfficialHeader />
      <div className="report-print-header">
        <div>
          <h1>{title}</h1>
        </div>
        <div className="report-print-meta">
          <span>{dateRange}</span>
        </div>
      </div>

      {showSummary ? (
        <div className="report-print-section">
          <h2>{t("report.summary")}</h2>
          <table className="report-print-table">
            <tbody>
              {summaryMetrics.map((metric) => (
                <tr key={metric.key}>
                  <td>{metric.label}</td>
                  <td className="is-right">{money(summary[metric.key as keyof ZoneSalesSummary])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <table className="report-print-table">
        <thead>
          <tr>
            <th>{t("report.zoneSales.columns.rank")}</th>
            <th>{t("report.zoneSales.zone")}</th>
            <th className="is-right">{t("report.zoneSales.columns.billCount")}</th>
            <th className="is-right">{t("report.zoneSales.columns.customerCount")}</th>
            <th className="is-right">{t("report.zoneSales.columns.discount")}</th>
            <th className="is-right">{t("report.zoneSales.columns.netSale")}</th>
            <th className="is-right">{t("report.zoneSales.columns.serviceCharge")}</th>
            <th className="is-right">{t("report.zoneSales.columns.vat")}</th>
            <th className="is-right">{t("report.zoneSales.columns.grandTotal")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.zone_uuid}>
              <td>{index + 1}</td>
              <td>{zoneOptionLabel(row, language)}</td>
              <td className="is-right">{row.bill_count}</td>
              <td className="is-right">{row.customer_count}</td>
              <td className="is-right">{money(row.discount_amount)}</td>
              <td className="is-right">{money(row.net_sale)}</td>
              <td className="is-right">{money(row.service_charge)}</td>
              <td className="is-right">{money(row.vat)}</td>
              <td className="is-right">{money(row.grand_total)}</td>
            </tr>
          ))}
          <tr className="is-bill">
            <td colSpan={2}>{t("report.summary")}</td>
            <td className="is-right">{summary.bill_count}</td>
            <td className="is-right">{summary.customer_count}</td>
            <td className="is-right">{money(summary.discount_amount)}</td>
            <td className="is-right">{money(summary.net_sale)}</td>
            <td className="is-right">{money(summary.service_charge)}</td>
            <td className="is-right">{money(summary.vat)}</td>
            <td className="is-right">{money(summary.grand_total)}</td>
          </tr>
        </tbody>
      </table>
      <ReportSignatures />
    </div>
  );
}
