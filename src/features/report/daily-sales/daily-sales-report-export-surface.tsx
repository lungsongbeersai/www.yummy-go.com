"use client";

import { Fragment, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { money } from "@/lib/format";
import type { DailySalesReportType } from "@/services/report";
import type { ApiEntity } from "@/services/shared/types";
import type { DailySalesBillGroup } from "@/stores/report-store";
import type {
  ReportColumn,
  SummaryCardConfig,
  SummaryCards,
} from "./daily-sales-report-types";
import { renderPrintCell } from "./daily-sales-report-tables";
import {
  firstNumber,
  formatDate,
  isCancelledRow,
  readValue,
  rowKey,
  summaryCardValue,
  textValue,
} from "./daily-sales-report-utils";

export function ReportExportSurface({
  billGroups,
  cards,
  columns,
  containerRef,
  dateRange,
  dateTotals,
  itemColumns,
  noLabel,
  reportTotal,
  rows,
  rowsLabel,
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
  dateTotals: ApiEntity[];
  itemColumns: ReportColumn[];
  noLabel: string;
  reportTotal: ApiEntity;
  rows: ApiEntity[];
  rowsLabel: string;
  summaryCards: SummaryCards;
  title: string;
  typePage: DailySalesReportType;
  typeLabel: string;
}) {
  return (
    <div ref={containerRef} className="report-print-surface">
      <div className="report-print-header">
        <div>
          <p className="report-print-kicker">{typeLabel}</p>
          <h1>{title}</h1>
        </div>
        <div className="report-print-meta">
          <span>{dateRange}</span>
          <span>{rowsLabel}</span>
        </div>
      </div>
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
      {typePage === "detail" && dateTotals.length ? (
        <DateTotalsTable rows={dateTotals} />
      ) : null}
      {typePage === "detail" ? (
        <DetailPrintTable
          billGroups={billGroups}
          itemColumns={itemColumns}
          noLabel={noLabel}
        />
      ) : (
        <SummaryPrintTable columns={columns} noLabel={noLabel} rows={rows} />
      )}
    </div>
  );
}

function DateTotalsTable({ rows }: { rows: ApiEntity[] }) {
  const { t } = useTranslation();

  return (
    <div className="report-print-section">
      <h2>{t("report.dateTotals")}</h2>
      <table className="report-print-table">
        <thead>
          <tr>
            <th>{t("report.columns.saleDate")}</th>
            <th className="is-right">{t("report.cards.billsCount")}</th>
            <th className="is-right">{t("report.cards.orderTotal")}</th>
            <th className="is-right">{t("report.cards.toppingTotal")}</th>
            <th className="is-right">{t("report.cards.discountAmount")}</th>
            <th className="is-right">{t("report.cards.itemDiscountAmount")}</th>
            <th className="is-right">{t("report.cards.serviceCharge")}</th>
            <th className="is-right">{t("report.cards.vatAmount")}</th>
            <th className="is-right">{t("report.cards.netTotal")}</th>
            <th className="is-right">{t("report.cards.receiveCash")}</th>
            <th className="is-right">{t("report.cards.receiveTransfer")}</th>
            <th className="is-right">{t("report.cards.debtAmount")}</th>
            <th className="is-right">{t("report.cards.changeAmount")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={`${textValue(readValue(row, ["date", "sale_date"]), String(index))}-${index}`}
            >
              <td>{formatDate(readValue(row, ["date", "sale_date"]))}</td>
              <td className="is-right">
                {firstNumber(
                  readValue(row, ["bills_count", "bill_count"]),
                ).toLocaleString("en-US")}
              </td>
              <td className="is-right">
                {money(
                  firstNumber(
                    readValue(row, ["amount", "order_total", "total_order"]),
                  ),
                )}
              </td>
              <td className="is-right">
                {money(
                  firstNumber(
                    readValue(row, ["topping_total", "topping_line_total"]),
                  ),
                )}
              </td>
              <td className="is-right">
                {money(
                  firstNumber(
                    readValue(row, [
                      "discount_bill",
                      "discount_amount",
                      "discount_total",
                    ]),
                  ),
                )}
              </td>
              <td className="is-right">
                {money(
                  firstNumber(
                    readValue(row, ["item_discount", "item_discount_amount"]),
                  ),
                )}
              </td>
              <td className="is-right">
                {money(
                  firstNumber(
                    readValue(row, ["service_charge", "service_charge_amount"]),
                  ),
                )}
              </td>
              <td className="is-right">
                {money(firstNumber(readValue(row, ["vat", "vat_amount"])))}
              </td>
              <td className="is-right">
                {money(
                  firstNumber(
                    readValue(row, ["total", "net_total", "grand_total"]),
                  ),
                )}
              </td>
              <td className="is-right">
                {money(
                  firstNumber(
                    readValue(row, ["receive_cash", "cash_received"]),
                  ),
                )}
              </td>
              <td className="is-right">
                {money(
                  firstNumber(
                    readValue(row, ["receive_transfer", "transfer_received"]),
                  ),
                )}
              </td>
              <td className="is-right">
                {money(
                  firstNumber(readValue(row, ["debt_amount", "debt_total"])),
                )}
              </td>
              <td className="is-right">
                {money(
                  firstNumber(
                    readValue(row, ["change_amount", "change_total"]),
                  ),
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DetailPrintTable({
  billGroups,
  itemColumns,
  noLabel,
}: {
  billGroups: DailySalesBillGroup[];
  itemColumns: ReportColumn[];
  noLabel: string;
}) {
  const { t } = useTranslation();

  return (
    <table className="report-print-table">
      <thead>
        <tr>
          <th>{noLabel}</th>
          <th>{t("report.columns.invoiceNumber")}</th>
          <th>{t("report.columns.saleDate")}</th>
          <th>{t("report.columns.tableName")}</th>
          <th>{t("report.columns.paymentType")}</th>
          <th className="is-right">{t("report.billItems")}</th>
          <th className="is-right">{t("report.cards.orderTotal")}</th>
          <th className="is-right">{t("report.cards.toppingTotal")}</th>
          <th className="is-right">{t("report.cards.discountAmount")}</th>
          <th className="is-right">{t("report.cards.itemDiscountAmount")}</th>
          <th className="is-right">{t("report.cards.serviceCharge")}</th>
          <th className="is-right">{t("report.cards.vatAmount")}</th>
          <th className="is-right">{t("report.cards.netTotal")}</th>
          <th className="is-right">{t("report.cards.receiveCash")}</th>
          <th className="is-right">{t("report.cards.receiveTransfer")}</th>
          <th className="is-right">{t("report.cards.debtAmount")}</th>
          <th className="is-right">{t("report.cards.changeAmount")}</th>
          <th>{t("report.columns.cashierName")}</th>
          <th>{t("report.columns.status")}</th>
        </tr>
      </thead>
      <tbody>
        {billGroups.map((group, index) => (
          <Fragment key={group.id}>
            <tr
              className={group.cancelled ? "is-cancelled is-bill" : "is-bill"}
            >
              <td className="is-center">{index + 1}</td>
              <td>{group.invoiceNumber}</td>
              <td>{formatDate(group.saleDate)}</td>
              <td>{group.tableName}</td>
              <td>{group.paymentType}</td>
              <td className="is-right">
                {group.itemCount.toLocaleString("en-US")}
              </td>
              <td className="is-right">{money(group.amountTotal)}</td>
              <td className="is-right">{money(group.toppingTotal)}</td>
              <td className="is-right">{money(group.discountBillAmount)}</td>
              <td className="is-right">{money(group.itemDiscountAmount)}</td>
              <td className="is-right">{money(group.serviceChargeAmount)}</td>
              <td className="is-right">{money(group.vatAmount)}</td>
              <td className="is-right">{money(group.lineTotal)}</td>
              <td className="is-right">{money(group.receiveCashAmount)}</td>
              <td className="is-right">{money(group.receiveTransferAmount)}</td>
              <td className="is-right">{money(group.debtAmount)}</td>
              <td className="is-right">{money(group.changeAmount)}</td>
              <td>{group.cashierName}</td>
              <td>{group.status}</td>
            </tr>
            <tr>
              <td colSpan={19} className="report-print-nested-cell">
                <table className="report-print-table report-print-item-table">
                  <thead>
                    <tr>
                      {itemColumns.map((column) => (
                        <th
                          key={column.header}
                          className={
                            column.align === "right" ? "is-right" : undefined
                          }
                        >
                          {column.header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((item, itemIndex) => (
                      <tr
                        key={`${rowKey(item, itemIndex)}-${itemIndex}`}
                        className={
                          isCancelledRow(item) ? "is-cancelled" : undefined
                        }
                      >
                        {itemColumns.map((column) => (
                          <td
                            key={column.header}
                            className={
                              column.align === "right" ? "is-right" : undefined
                            }
                          >
                            {renderPrintCell(item, column)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </td>
            </tr>
          </Fragment>
        ))}
      </tbody>
    </table>
  );
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
