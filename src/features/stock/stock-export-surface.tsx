"use client";

import type { RefObject } from "react";
import { useTranslation } from "react-i18next";
import {
  ReportOfficialHeader,
  ReportSignatures
} from "@/lib/export/official-layout";
import type { StockExportRow } from "./stock-export-utils";

interface StockExportSurfaceProps {
  branchLabel: string;
  categoryLabel: string;
  containerRef: RefObject<HTMLDivElement | null>;
  dateLabel: string;
  rows: StockExportRow[];
  statusLabel: string;
  title: string;
}

// ตารางสำหรับ html2canvas → PDF เท่านั้น (ตำแหน่ง/สไตล์คุมด้วยคลาส report-print-* ใน globals.css)
export function StockExportSurface({
  branchLabel,
  categoryLabel,
  containerRef,
  dateLabel,
  rows,
  statusLabel,
  title
}: StockExportSurfaceProps) {
  const { t } = useTranslation();

  return (
    <div ref={containerRef} className="report-print-surface">
      <ReportOfficialHeader />
      <div className="report-print-header">
        <div>
          <p className="report-print-kicker">{branchLabel}</p>
          <h1>{title}</h1>
        </div>
        <div className="report-print-meta">
          <span>{dateLabel}</span>
          <span>
            {t("stock.filters.category")}: {categoryLabel}
          </span>
          <span>
            {t("stock.filters.status")}: {statusLabel}
          </span>
        </div>
      </div>

      <table className="report-print-table">
        <thead>
          <tr>
            <th>{t("fields.no")}</th>
            <th>{t("stock.columns.product")}</th>
            <th>{t("stock.columns.code")}</th>
            <th>{t("stock.columns.category")}</th>
            <th>{t("stock.columns.variant")}</th>
            <th className="is-right">{t("stock.columns.quantity")}</th>
            <th>{t("stock.columns.unit")}</th>
            <th className="is-right">{t("stock.columns.reorderPoint")}</th>
            <th>{t("stock.columns.status")}</th>
            <th>{t("stock.columns.enabled")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.no}>
              <td>{row.no}</td>
              <td>{row.productName}</td>
              <td>{row.prodCode}</td>
              <td>{row.categoryName}</td>
              <td>{row.variantLabel}</td>
              <td className="is-right">{row.quantity}</td>
              <td>{row.unitName}</td>
              <td className="is-right">{row.orderPoint}</td>
              <td>{row.statusLabel}</td>
              <td>{row.enabledLabel}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ReportSignatures />
    </div>
  );
}
