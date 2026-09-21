"use client";

import type { RefObject } from "react";
import { useTranslation } from "react-i18next";
import { money } from "@/lib/format";
import type { CustomerSalesReportSummary, CustomerSalesRow } from "@/services/report";
import {
  ReportOfficialHeader,
  ReportSignatures,
} from "@/lib/export/official-layout";
import { customerSalesSummaryMetricConfigs } from "./customer-sales-utils";

// พื้นผิวสำหรับ export PDF (captureElementToPdf จับภาพ element นี้) — โครงเดียวกับ
// EmployeeSalesExportSurface: หัวรายงานทางการ → ส่วนสรุป (ถ้าเปิดอยู่) → ตารางหลัก → ลายเซ็น
export function CustomerSalesExportSurface({
  containerRef,
  dateRange,
  rows,
  showSummary,
  summary,
  title,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  dateRange: string;
  rows: CustomerSalesRow[];
  showSummary: boolean;
  summary: CustomerSalesReportSummary;
  title: string;
}) {
  const { t } = useTranslation();
  const summaryMetrics = customerSalesSummaryMetricConfigs(t);

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
                  <td className="is-right">{money(summary[metric.key as keyof CustomerSalesReportSummary])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <table className="report-print-table">
        <thead>
          <tr>
            <th>{t("report.customerSales.columns.rank")}</th>
            <th>{t("report.customerSales.customer")}</th>
            <th className="is-right">{t("report.customerSales.columns.billCount")}</th>
            <th className="is-right">{t("report.customerSales.columns.netSale")}</th>
            <th className="is-right">{t("report.customerSales.columns.serviceCharge")}</th>
            <th className="is-right">{t("report.customerSales.columns.vat")}</th>
            <th className="is-right">{t("report.customerSales.columns.grandTotal")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.customer_uuid}>
              <td>{index + 1}</td>
              <td>{row.customer_name || "-"}</td>
              <td className="is-right">{row.summary.bill_count}</td>
              <td className="is-right">{money(row.summary.net_sale)}</td>
              <td className="is-right">{money(row.summary.service_charge)}</td>
              <td className="is-right">{money(row.summary.vat)}</td>
              <td className="is-right">{money(row.summary.grand_total)}</td>
            </tr>
          ))}
          <tr className="is-bill">
            <td colSpan={2}>{t("report.summary")}</td>
            <td className="is-right">{summary.bill_count}</td>
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
