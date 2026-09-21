"use client";

import type { RefObject } from "react";
import { useTranslation } from "react-i18next";
import { money } from "@/lib/format";
import type { EmployeeSalesReportSummary, EmployeeSalesRow } from "@/services/report";
import {
  ReportOfficialHeader,
  ReportSignatures,
} from "@/lib/export/official-layout";

function employeeName(row: EmployeeSalesRow) {
  return row.login_email || "-";
}

// พื้นผิวสำหรับ export PDF (captureElementToPdf จับภาพ element นี้) — โครงเดียวกับ
// CategorySalesExportSurface/DailySalesExportSurface: หัวรายงานทางการ (ReportOfficialHeader) →
// ส่วนสรุป (ถ้าเปิดอยู่) → ตารางหลัก → ลายเซ็น (ReportSignatures)
export function EmployeeSalesExportSurface({
  containerRef,
  dateRange,
  rows,
  showSummary,
  summary,
  title,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  dateRange: string;
  rows: EmployeeSalesRow[];
  showSummary: boolean;
  summary: EmployeeSalesReportSummary;
  title: string;
}) {
  const { t } = useTranslation();
  const reportGrandTotal = summary.grand_total || 0;
  const reportBillCount = summary.bill_count || 0;

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
              <tr>
                <td>{t("employeeSales.employeeCount")}</td>
                <td className="is-right">{summary.employee_count}</td>
              </tr>
              <tr>
                <td>{t("employeeSales.billCount")}</td>
                <td className="is-right">{reportBillCount}</td>
              </tr>
              <tr>
                <td>{t("employeeSales.grandTotal")}</td>
                <td className="is-right">{money(reportGrandTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : null}

      <table className="report-print-table">
        <thead>
          <tr>
            <th>{t("employeeSales.rank")}</th>
            <th>{t("employeeSales.employee")}</th>
            <th className="is-right">{t("employeeSales.billCount")}</th>
            <th className="is-right">{t("employeeSales.grandTotal")}</th>
            <th className="is-right">{t("employeeSales.percentOfTotal")}</th>
            <th className="is-right">{t("employeeSales.averagePerBill")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const grandTotal = row.summary.grand_total;
            const billCount = row.summary.bill_count;
            const percent = reportGrandTotal ? (grandTotal / reportGrandTotal) * 100 : 0;
            const average = billCount ? grandTotal / billCount : 0;

            return (
              <tr key={row.login_uuid}>
                <td>{index + 1}</td>
                <td>{employeeName(row)}</td>
                <td className="is-right">{billCount}</td>
                <td className="is-right">{money(grandTotal)}</td>
                <td className="is-right">{percent.toLocaleString("en-US", { maximumFractionDigits: 1 })}%</td>
                <td className="is-right">{money(average)}</td>
              </tr>
            );
          })}
          <tr className="is-bill">
            <td colSpan={2}>{t("report.summary")}</td>
            <td className="is-right">{reportBillCount}</td>
            <td className="is-right">{money(reportGrandTotal)}</td>
            <td className="is-right">100%</td>
            <td className="is-right">
              {money(reportBillCount ? reportGrandTotal / reportBillCount : 0)}
            </td>
          </tr>
        </tbody>
      </table>
      <ReportSignatures />
    </div>
  );
}
