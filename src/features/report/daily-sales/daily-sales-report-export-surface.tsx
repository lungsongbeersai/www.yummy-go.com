"use client";

import { Fragment, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { money } from "@/lib/format";
import type { ApiEntity } from "@/services/shared/types";
import type { DailySalesBillGroup } from "@/stores/report-store";
import type {
  ReportColumn,
  ReportTab,
  SummaryCardConfig,
  SummaryCards,
} from "./daily-sales-report-types";
import {
  buildDailySalesDetailReportModel,
  type DailySalesDetailAdjustmentKey,
  type DailySalesDetailMetrics,
  type DailySalesDetailTotals,
} from "./daily-sales-detail-model";
import {
  ReportOfficialHeader,
  ReportSignatures,
} from "@/lib/export/official-layout";
import { renderPrintCell } from "./daily-sales-report-tables";
import {
  firstNumber,
  formatDate,
  isCancelledRow,
  rowKey,
  summaryCardValue,
} from "./daily-sales-report-utils";

export function DailySalesExportSurface({
  billGroups,
  cards,
  columns,
  containerRef,
  dateRange,
  itemColumns,
  noLabel,
  reportTotal,
  rows,
  showSummary,
  summaryCards,
  title,
  typePage,
  typeLabel,
}: {
  billGroups: DailySalesBillGroup[];
  cards: SummaryCardConfig[];
  columns: ReportColumn[];
  containerRef: RefObject<HTMLDivElement | null>;
  dateRange: string;
  itemColumns: ReportColumn[];
  noLabel: string;
  reportTotal: ApiEntity;
  rows: ApiEntity[];
  showSummary: boolean;
  summaryCards: SummaryCards;
  title: string;
  typePage: ReportTab;
  typeLabel: string;
}) {
  return (
    <div ref={containerRef} className="report-print-surface">
      <ReportOfficialHeader />
      <div className="report-print-header">
        <p className="report-print-kicker">{typeLabel}</p>
        <h1>{title}</h1>
        <div className="report-print-meta">
          <span>{dateRange}</span>
        </div>
      </div>
      {showSummary ? (
        <div className="report-print-cards">
          {cards.map((card) => {
            const value = summaryCardValue(summaryCards, reportTotal, card.keys);
            return (
              <div key={card.label} className="report-print-card">
                <p>{card.label}</p>
                <strong>
                  {card.kind === "money"
                    ? money(firstNumber(value))
                    : firstNumber(value).toLocaleString("en-US")}
                </strong>
              </div>
            );
          })}
        </div>
      ) : null}
      {typePage === "detail" ? (
        <DetailPrintTable
          billGroups={billGroups}
          itemColumns={itemColumns}
          noLabel={noLabel}
          reportTotal={reportTotal}
          summaryCards={summaryCards}
        />
      ) : (
        <SummaryPrintTable columns={columns} noLabel={noLabel} rows={rows} />
      )}
      <ReportSignatures />
    </div>
  );
}

function DetailPrintTable({
  billGroups,
  itemColumns,
  noLabel,
  reportTotal,
  summaryCards,
}: {
  billGroups: DailySalesBillGroup[];
  itemColumns: ReportColumn[];
  noLabel: string;
  reportTotal: ApiEntity;
  summaryCards: SummaryCards;
}) {
  const { t } = useTranslation();
  const model = buildDailySalesDetailReportModel(
    billGroups,
    summaryCards,
    reportTotal,
  );
  const imageColumn = itemColumns.find((column) => column.kind === "image");

  return (
    <table className="report-print-table report-print-detail-table">
      <thead>
        <tr>
          <th>{noLabel}</th>
          <th>{t("report.columns.invoiceNumber")}</th>
          <th>{t("report.columns.saleDate")}</th>
          <th>{t("report.columns.tableName")}</th>
          <th>{t("report.columns.paymentType")}</th>
          <th className="is-right">{t("report.columns.salePrice")}</th>
          <th className="is-right">{t("report.columns.quantity")}</th>
          <th className="is-right">{t("report.columns.toppingTotal")}</th>
          <th className="is-right">{t("report.columns.amount")}</th>
          <th className="is-right">{t("report.columns.discount")}</th>
          <th className="is-right">{t("common.total")}</th>
          {model.hasStatus ? <th>{t("report.columns.status")}</th> : null}
        </tr>
      </thead>
      <tbody>
        {model.bills.map((bill, index) => (
          <Fragment key={bill.id}>
            <tr
              className={bill.cancelled ? "is-cancelled is-bill" : "is-bill"}
            >
              <td className="is-center">{index + 1}</td>
              <td>{bill.invoiceNumber}</td>
              <td>{formatDate(bill.saleDate)}</td>
              <td>{bill.tableName}</td>
              <td>{bill.paymentType}</td>
              {Array.from({ length: 6 }, (_, cellIndex) => (
                <td key={cellIndex} className="is-right" />
              ))}
              {model.hasStatus ? <td>{bill.status}</td> : null}
            </tr>
            {bill.items.map((item, itemIndex) => (
              <tr
                key={`${bill.id}-item-${itemIndex}`}
                className={item.cancelled ? "is-cancelled" : undefined}
              >
                <td />
                <td colSpan={4}>
                  <div className="report-print-detail-product">
                    {imageColumn
                      ? renderPrintCell(item.source, imageColumn)
                      : null}
                    <span>{item.productLabel}</span>
                  </div>
                </td>
                <DetailPrintMetricCells metrics={item.metrics} />
                {model.hasStatus ? <td /> : null}
              </tr>
            ))}
            <tr className="report-print-detail-summary">
              <td />
              <td colSpan={4}>{t("report.summary")}</td>
              <DetailPrintMetricCells metrics={bill.itemSubtotal} />
              {model.hasStatus ? <td /> : null}
            </tr>
            {bill.adjustments.map((adjustment) => (
              <tr
                key={`${bill.id}-${adjustment.key}`}
                className={
                  adjustment.key === "total"
                    ? "report-print-detail-adjustment is-total"
                    : "report-print-detail-adjustment"
                }
              >
                <td colSpan={9} />
                <td className="is-right">
                  {detailAdjustmentLabel(adjustment.key, t)}
                </td>
                <td className="is-right">{money(adjustment.value)}</td>
                {model.hasStatus ? <td /> : null}
              </tr>
            ))}
          </Fragment>
        ))}
        <tr className="report-print-detail-total">
          <td />
          <td colSpan={4}>
            {t("report.summary")}
            {model.totals.billCount === null
              ? null
              : ` - ${t("report.cards.billsCount")}: ${model.totals.billCount.toLocaleString("en-US")}`}
          </td>
          <DetailPrintTotalCells totals={model.totals} />
          {model.hasStatus ? <td /> : null}
        </tr>
      </tbody>
    </table>
  );
}

function detailAdjustmentLabel(
  key: DailySalesDetailAdjustmentKey,
  t: (key: string) => string,
) {
  const labels: Record<DailySalesDetailAdjustmentKey, string> = {
    "bill-discount": t("report.columns.billDiscount"),
    "service-charge": t("dashboard.serviceCharge"),
    total: t("common.total"),
    vat: t("dashboard.vat"),
  };
  return labels[key];
}

function DetailPrintMetricCells({
  metrics,
}: {
  metrics: DailySalesDetailMetrics;
}) {
  return (
    <>
      <DetailPrintMoneyCell value={metrics.sellingPrice} />
      <td className="is-right">{metrics.quantity.toLocaleString("en-US")}</td>
      <DetailPrintMoneyCell value={metrics.topping} />
      <DetailPrintMoneyCell value={metrics.amount} />
      <DetailPrintMoneyCell value={metrics.discount} />
      <DetailPrintMoneyCell value={metrics.total} />
    </>
  );
}

function DetailPrintTotalCells({ totals }: { totals: DailySalesDetailTotals }) {
  return (
    <>
      <DetailPrintMoneyCell value={totals.sellingPrice} />
      <td className="is-right">
        {totals.quantity?.toLocaleString("en-US") ?? ""}
      </td>
      <DetailPrintMoneyCell value={totals.topping} />
      <DetailPrintMoneyCell value={totals.amount} />
      <DetailPrintMoneyCell value={totals.discount} />
      <DetailPrintMoneyCell value={totals.total} />
    </>
  );
}

function DetailPrintMoneyCell({ value }: { value: number | null }) {
  return <td className="is-right">{value === null ? "" : money(value)}</td>;
}

function SummaryPrintTable({
  columns,
  noLabel,
  rows,
}: {
  columns: ReportColumn[];
  noLabel: string;
  rows: ApiEntity[];
}) {
  return (
    <table className="report-print-table">
      <thead>
        <tr>
          <th>{noLabel}</th>
          {columns.map((column) => (
            <th
              key={column.header}
              className={column.align === "right" ? "is-right" : undefined}
            >
              {column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr
            key={`${rowKey(row, index)}-${index}`}
            className={isCancelledRow(row) ? "is-cancelled" : undefined}
          >
            <td className="is-center">{index + 1}</td>
            {columns.map((column) => (
              <td
                key={column.header}
                className={column.align === "right" ? "is-right" : undefined}
              >
                {renderPrintCell(row, column)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
