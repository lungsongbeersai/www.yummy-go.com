"use client";

import type { RefObject } from "react";
import { useTranslation } from "react-i18next";
import { formatShortDate, money } from "@/lib/format";
import type { VatReportRow, VatReportSummary } from "@/services/report";
import {
  ReportOfficialHeader,
  ReportSignatures,
} from "@/lib/export/official-layout";
import { vatSummaryMetricConfigs } from "./vat-report-utils";

// พื้นผิวสำหรับ export PDF (captureElementToPdf จับภาพ element นี้) — โครงเดียวกับ
// EmployeeSalesExportSurface/CategorySalesExportSurface: หัวรายงานทางการ → ส่วนสรุป (ถ้าเปิดอยู่) →
// ตารางหลัก (ครบทุกแถวตามหน้าจอ ไม่ตัดทอน เพราะเป็นหลักฐานยื่นภาษี) → ลายเซ็น
export function VatExportSurface({
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
  rows: VatReportRow[];
  showSummary: boolean;
  summary: VatReportSummary;
  title: string;
}) {
  const { t } = useTranslation();
  const summaryMetrics = vatSummaryMetricConfigs(t);

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
                  <td className="is-right">{money(summary[metric.key as keyof VatReportSummary])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <table className="report-print-table">
        <thead>
          <tr>
            <th>{t("report.vat.columns.saleDate")}</th>
            <th>{t("report.vat.columns.invoice")}</th>
            <th>{t("report.vat.columns.customer")}</th>
            <th className="is-right">{t("report.vat.columns.discount")}</th>
            <th className="is-right">{t("report.vat.columns.netSale")}</th>
            <th className="is-right">{t("report.vat.columns.serviceCharge")}</th>
            <th className="is-right">{t("report.vat.columns.vatRate")}</th>
            <th className="is-right">{t("report.vat.columns.vat")}</th>
            <th className="is-right">{t("report.vat.columns.grandTotal")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.order_uuid}>
              <td>{formatShortDate(row.sale_date, language)}</td>
              <td>{row.order_invoice}</td>
              <td>{row.customer_name || "-"}</td>
              <td className="is-right">{money(row.discount_amount)}</td>
              <td className="is-right">{money(row.net_sale)}</td>
              <td className="is-right">{money(row.service_charge)}</td>
              <td className="is-right">{row.vat_rate}%</td>
              <td className="is-right">{money(row.vat)}</td>
              <td className="is-right">{money(row.grand_total)}</td>
            </tr>
          ))}
          <tr className="is-bill">
            <td colSpan={3}>{t("report.summary")}</td>
            <td className="is-right">{money(summary.discount_amount)}</td>
            <td className="is-right">{money(summary.net_sale)}</td>
            <td className="is-right">{money(summary.service_charge)}</td>
            <td />
            <td className="is-right">{money(summary.vat)}</td>
            <td className="is-right">{money(summary.grand_total)}</td>
          </tr>
        </tbody>
      </table>
      <ReportSignatures />
    </div>
  );
}
