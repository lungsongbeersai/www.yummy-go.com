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
  "report.paymentMethodsReport.columns.avgBill": "Average bill",
  "report.paymentMethodsReport.columns.billTotal": "Bill total",
  "report.paymentMethodsReport.columns.billsCount": "Bills",
  "report.paymentMethodsReport.columns.difference": "Difference",
  "report.paymentMethodsReport.columns.discountBill": "Bill discount",
  "report.paymentMethodsReport.columns.discountTotal": "Discount total",
  "report.paymentMethodsReport.columns.itemDiscount": "Item discount",
  "report.paymentMethodsReport.columns.itemsCount": "Items",
  "report.paymentMethodsReport.columns.paymentAmount": "Payment amount",
  "report.paymentMethodsReport.columns.paymentMethod": "Payment method",
  "report.paymentMethodsReport.columns.paymentMethodCode": "Method code",
  "report.paymentMethodsReport.columns.qtyTotal": "Qty",
  "report.paymentMethodsReport.columns.rowsCount": "Rows",
  "report.paymentMethodsReport.columns.serviceCharge": "Service charge",
  "report.paymentMethodsReport.columns.toppingTotal": "Topping total",
  "report.paymentMethodsReport.columns.total": "Total",
  "report.paymentMethodsReport.columns.vat": "VAT",
  "report.categorySales.columns.afterDiscountBill": "After bill discount",
  "report.categorySales.columns.afterDiscountItem": "After item discount",
  "report.categorySales.columns.grandTotal": "Grand total",
  "report.categorySales.columns.productPriceTotal": "Product price total",
  "report.paymentMethodsReport.export.cards": "Cards",
  "report.paymentMethodsReport.export.metric": "Metric",
  "report.paymentMethodsReport.export.section": "Section",
  "report.paymentMethodsReport.export.total": "Total summary",
  "report.paymentMethodsReport.export.value": "Value"
};

const t = (key: string) => labels[key] ?? key;

const row: PaymentMethodReportRow = {
  afterDiscountBill: 1451282,
  afterDiscountItem: 1501282,
  billCount: 7,
  billTotal: 1551282,
  discountBill: 0,
  discountItemAmount: 0,
  grandTotal: 1551282,
  paymentAmount: 1551282,
  paymentMethodCode: "cash",
  paymentMethodName: "Cash",
  productPriceTotal: 1317996,
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

  it("uses payment method and date range in the export file name", () => {
    const filters: PaymentMethodsReportFilters = {
      branchUuid: "branch-1",
      dateFrom: "2026-06-01",
      dateTo: "2026-06-03",
      limit: 20,
      paymentMethod: "cash"
    };

    expect(paymentMethodsFileBaseName(filters)).toBe("payment-methods-cash-2026-06-01-to-2026-06-03");
  });

  it("exports all financial row fields", () => {
    expect(paymentMethodRowMetricConfigs(t).map((metric) => metric.key)).toEqual([
      "bill_count",
      "product_price_total",
      "topping_total",
      "total",
      "discount_item_amount",
      "after_discount_item",
      "bill_total",
      "discount_bill",
      "after_discount_bill",
      "service_charge",
      "vat",
      "grand_total",
      "payment_amount"
    ]);

    expect(exportPaymentMethodRows([row], t)[0]).toMatchObject({
      "After bill discount": 1451282,
      "After item discount": 1501282,
      "Bill discount": 0,
      "Bill total": 1551282,
      "Grand total": 1551282,
      "Item discount": 0,
      "Payment amount": 1551282,
      "Payment method": "Cash",
      "Product price total": 1317996,
      "Service charge": 92260,
      Total: 1551282,
      VAT: 141026
    });
  });

  it("exports card summary and total summary rows", () => {
    const cards: PaymentMethodSummaryCard[] = [
      { key: "total", label: "Total", sortOrder: 1, value: 2144490, valueType: "money" }
    ];

    expect(exportSummaryRows(cards, { grand_total: 2144490, sum_vate: 194954 }, t)).toEqual(
      expect.arrayContaining([
        { Metric: "Total", Section: "Cards", Value: 2144490 },
        { Metric: "VAT", Section: "Total summary", Value: 194954 }
      ])
    );
  });
});
