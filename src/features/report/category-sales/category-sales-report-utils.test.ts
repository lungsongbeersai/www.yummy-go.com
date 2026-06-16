import { describe, expect, it } from "vitest";
import type { CategorySalesRow } from "@/stores/report-store";
import {
  categorySalesFileBaseName,
  categorySalesRowMetricConfigs,
  exportCategorySalesRows,
  exportSummaryRows,
  paymentMethodFallbackOptions
} from "./category-sales-report-utils";
import type { CategorySalesReportFilters } from "./category-sales-report-types";

const labels: Record<string, string> = {
  "common.all": "All",
  "report.paymentMethods.cash": "Cash",
  "report.paymentMethods.debt": "Debt",
  "report.paymentMethods.transfer": "Transfer",
  "report.categorySales.cards.categories": "Categories",
  "report.categorySales.columns.amount": "Amount",
  "report.categorySales.columns.billCount": "Bills",
  "report.categorySales.columns.category": "Category",
  "report.categorySales.columns.discountBill": "Bill discount",
  "report.categorySales.columns.discountTotal": "Discount total",
  "report.categorySales.columns.group": "Group",
  "report.categorySales.columns.itemDiscount": "Item discount",
  "report.categorySales.columns.itemsCount": "Items",
  "report.categorySales.columns.qtyTotal": "Qty",
  "report.categorySales.columns.rank": "Rank",
  "report.categorySales.columns.salePercent": "Sales %",
  "report.categorySales.columns.serviceCharge": "Service charge",
  "report.categorySales.columns.toppingTotal": "Topping total",
  "report.categorySales.columns.total": "Total",
  "report.categorySales.columns.vat": "VAT",
  "report.categorySales.export.metric": "Metric",
  "report.categorySales.export.value": "Value"
};

const t = (key: string) => labels[key] ?? key;

const row: CategorySalesRow = {
  amount: 17430000,
  billCount: 36,
  cateName: "Beer",
  cateUuid: "beer",
  discountBill: 393419.54,
  discountTotal: 575179.54,
  groupName: "Drinks",
  groupUuid: "group-drinks",
  itemDiscount: 181760,
  itemsCount: 135,
  qtyTotal: 287,
  rank: 1,
  salePercent: 87.73,
  serviceCharge: 1176968.08,
  sortOrder: 1,
  toppingTotal: 55000,
  total: 19834968.32,
  vat: 1803179.78
};

describe("category sales report helpers", () => {
  it("builds fallback payment method options", () => {
    expect(paymentMethodFallbackOptions(t).map((option) => [option.value, option.label])).toEqual([
      ["all", "All"],
      ["cash", "Cash"],
      ["transfer", "Transfer"],
      ["debt", "Debt"]
    ]);
  });

  it("uses payment method, order, and date range in the export file name", () => {
    const filters: CategorySalesReportFilters = {
      branchUuid: "branch-1",
      dateFrom: "2026-05-01",
      dateTo: "2026-06-28",
      limit: 10,
      orderBy: "DESC",
      paymentMethod: "all"
    };

    expect(categorySalesFileBaseName(filters)).toBe("category-sales-all-DESC-2026-05-01-to-2026-06-28");
  });

  it("exports all category sales row fields", () => {
    expect(categorySalesRowMetricConfigs(t).map((metric) => metric.key)).toEqual([
      "category_bill_count",
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
      "sale_percent"
    ]);

    expect(exportCategorySalesRows([row], t)[0]).toMatchObject({
      Amount: 17430000,
      Category: "Beer",
      Group: "Drinks",
      "Sales %": 87.73,
      Total: 19834968.32,
      VAT: 1803179.78
    });
  });

  it("exports derived summary rows", () => {
    expect(exportSummaryRows({ categories_count: 2, total: 20941308.5 }, t)).toEqual(
      expect.arrayContaining([
        { Metric: "Categories", Value: 2 },
        { Metric: "Total", Value: 20941308.5 }
      ])
    );
  });
});
