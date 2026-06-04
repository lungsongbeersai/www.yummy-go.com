import { describe, expect, it } from "vitest";
import type { PaymentMethodReportRow, PaymentMethodSummaryCard } from "@/stores/report-store";
import {
  exportPaymentMethodRows,
  exportSummaryRows,
  paymentMethodFallbackOptions,
  paymentMethodsFileBaseName,
  paymentMethodRowMetricConfigs
} from "./payment-methods-report-utils";
import type { PaymentMethodsReportFilters } from "./payment-methods-report-types";

const labels: Record<string, string> = {
  "common.all": "All",
  "report.paymentMethods.cash": "Cash",
  "report.paymentMethods.debt": "Debt",
  "report.paymentMethods.transfer": "Transfer",
  "report.paymentMethodsReport.columns.activeCount": "Active",
  "report.paymentMethodsReport.columns.amount": "Amount",
  "report.paymentMethodsReport.columns.avgBill": "Average bill",
  "report.paymentMethodsReport.columns.billsCount": "Bills",
  "report.paymentMethodsReport.columns.cancelledCount": "Cancelled",
  "report.paymentMethodsReport.columns.cancelledTotal": "Cancelled total",
  "report.paymentMethodsReport.columns.changeAmount": "Change",
  "report.paymentMethodsReport.columns.debtAmount": "Debt",
  "report.paymentMethodsReport.columns.discountBill": "Bill discount",
  "report.paymentMethodsReport.columns.discountTotal": "Discount total",
  "report.paymentMethodsReport.columns.itemDiscount": "Item discount",
  "report.paymentMethodsReport.columns.itemsCount": "Items",
  "report.paymentMethodsReport.columns.paymentMethod": "Payment method",
  "report.paymentMethodsReport.columns.paymentMethodCode": "Method code",
  "report.paymentMethodsReport.columns.qtyTotal": "Qty",
  "report.paymentMethodsReport.columns.rank": "Rank",
  "report.paymentMethodsReport.columns.receiveCash": "Cash",
  "report.paymentMethodsReport.columns.receiveTransfer": "Transfer",
  "report.paymentMethodsReport.columns.rowsCount": "Rows",
  "report.paymentMethodsReport.columns.serviceCharge": "Service charge",
  "report.paymentMethodsReport.columns.toppingTotal": "Topping total",
  "report.paymentMethodsReport.columns.total": "Total",
  "report.paymentMethodsReport.columns.vat": "VAT",
  "report.paymentMethodsReport.export.cards": "Cards",
  "report.paymentMethodsReport.export.metric": "Metric",
  "report.paymentMethodsReport.export.section": "Section",
  "report.paymentMethodsReport.export.total": "Total summary",
  "report.paymentMethodsReport.export.value": "Value"
};

const t = (key: string) => labels[key] ?? key;

const row: PaymentMethodReportRow = {
  activeCount: 7,
  amount: 1317996,
  billsCount: 7,
  cancelledCount: 0,
  cancelledTotal: 0,
  changeAmount: 4,
  debtAmount: 0,
  discountBill: 0,
  discountTotal: 0,
  itemDiscount: 0,
  itemsCount: 17,
  paymentMethodCode: "cash",
  paymentMethodName: "Cash",
  qtyTotal: 27,
  rank: 1,
  receiveCash: 1551286,
  receiveTransfer: 0,
  serviceCharge: 92260,
  sortOrder: 1,
  toppingTotal: 15000,
  total: 1551282,
  vat: 141026
};

describe("payment method report helpers", () => {
  it("builds fallback payment method options", () => {
    expect(paymentMethodFallbackOptions(t).map((option) => [option.value, option.label])).toEqual([
      ["all", "All"],
      ["cash", "Cash"],
      ["transfer", "Transfer"],
      ["debt", "Debt"]
    ]);
  });

  it("uses payment method, order, and date range in the export file name", () => {
    const filters: PaymentMethodsReportFilters = {
      branchUuid: "branch-1",
      dateFrom: "2026-06-01",
      dateTo: "2026-06-03",
      limit: 20,
      orderBy: "DESC",
      paymentMethod: "cash"
    };

    expect(paymentMethodsFileBaseName(filters)).toBe("payment-methods-cash-DESC-2026-06-01-to-2026-06-03");
  });

  it("exports all financial row fields", () => {
    expect(paymentMethodRowMetricConfigs(t).map((metric) => metric.key)).toEqual([
      "bills_count",
      "active_count",
      "cancelled_count",
      "items_count",
      "qty_total",
      "amount",
      "topping_total",
      "item_discount",
      "discount_bill",
      "discount_total",
      "service_charge",
      "vat",
      "total",
      "receive_cash",
      "receive_transfer",
      "debt_amount",
      "change_amount",
      "cancelled_total"
    ]);

    expect(exportPaymentMethodRows([row], t)[0]).toMatchObject({
      "Bill discount": 0,
      Cash: 1551286,
      Debt: 0,
      "Item discount": 0,
      "Payment method": "Cash",
      "Service charge": 92260,
      Total: 1551282,
      Transfer: 0,
      VAT: 141026
    });
  });

  it("exports card summary and total summary rows", () => {
    const cards: PaymentMethodSummaryCard[] = [
      { key: "total", label: "Total", sortOrder: 1, value: 2144490, valueType: "money" }
    ];

    expect(exportSummaryRows(cards, { total: 2144490, vat: 194954 }, t)).toEqual(
      expect.arrayContaining([
        { Metric: "Total", Section: "Cards", Value: 2144490 },
        { Metric: "VAT", Section: "Total summary", Value: 194954 }
      ])
    );
  });
});
