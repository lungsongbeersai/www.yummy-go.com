import { describe, expect, it } from "vitest";
import type { CategorySalesRow } from "@/stores/report-store";
import {
  categorySalesFileBaseName,
  categorySalesRowMetricConfigs,
  categorySalesSummaryMetricConfigs,
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
  "report.categorySales.cards.products": "Products",
  "report.categorySales.columns.afterDiscountBill": "After bill discount",
  "report.categorySales.columns.afterDiscountItem": "After item discount",
  "report.categorySales.columns.billCount": "Bills",
  "report.categorySales.columns.category": "Category",
  "report.categorySales.columns.discountBill": "Bill discount",
  "report.categorySales.columns.discountTotal": "Discount total",
  "report.categorySales.columns.grandTotal": "Grand total",
  "report.categorySales.columns.group": "Group",
  "report.categorySales.columns.itemDiscount": "Item discount",
  "report.categorySales.columns.product": "Product",
  "report.categorySales.columns.productPriceTotal": "Product price total",
  "report.categorySales.columns.qtyTotal": "Qty",
  "report.categorySales.columns.serviceCharge": "Service charge",
  "report.categorySales.columns.toppingTotal": "Topping total",
  "report.categorySales.columns.total": "Total",
  "report.categorySales.columns.vat": "VAT",
  "report.categorySales.export.metric": "Metric",
  "report.categorySales.export.value": "Value"
};

const t = (key: string) => labels[key] ?? key;

const row: CategorySalesRow = {
  afterDiscountBill: 95000,
  afterDiscountItem: 95000,
  billCount: 2,
  cateName: "Beer",
  cateUuid: "beer",
  discountBill: 0,
  discountItemAmount: 5000,
  discountTotal: 5000,
  groupName: "Drinks",
  groupUuid: "group-drinks",
  grandTotal: 111815,
  productName: "Tiger Beer",
  productPriceTotal: 90000,
  productUuid: "prod-1",
  rank: 1,
  serviceCharge: 6650,
  serviceRate: 7,
  sortOrder: 1,
  toppingTotal: 10000,
  total: 100000,
  totalQty: 3,
  vat: 10165,
  vatRate: 10
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

  it("uses payment method and date range in the export file name", () => {
    const filters: CategorySalesReportFilters = {
      branchUuid: "branch-1",
      dateFrom: "2026-05-01",
      dateTo: "2026-06-28",
      limit: 10,
      orderBy: "ASC",
      paymentMethod: "all"
    };

    expect(categorySalesFileBaseName(filters)).toBe("category-sales-all-ASC-2026-05-01-to-2026-06-28");
  });

  it("exports product sales row fields", () => {
    expect(categorySalesRowMetricConfigs(t).map((metric) => metric.key)).toEqual([
      "bill_count",
      "total_qty",
      "product_price_total",
      "topping_total",
      "total",
      "discount_total",
      "sum_servicecharge",
      "sum_vate",
      "grand_total"
    ]);

    expect(exportCategorySalesRows([row], t)[0]).toMatchObject({
      Category: "Beer",
      Group: "Drinks",
      "Grand total": 111815,
      Product: "Tiger Beer",
      "Product price total": 90000,
      Total: 100000,
      VAT: 10165
    });
  });

  it("exports backend summary rows", () => {
    expect(categorySalesSummaryMetricConfigs(t).map((metric) => metric.key)).toEqual([
      "product_count",
      "bill_count",
      "total_qty",
      "product_price_total",
      "topping_total",
      "total",
      "discount_item_amount",
      "after_discount_item",
      "discount_bill",
      "after_discount_bill",
      "sum_servicecharge",
      "sum_vate",
      "grand_total"
    ]);
    expect(exportSummaryRows({ product_count: 3, grand_total: 20941308.5 }, t)).toEqual(
      expect.arrayContaining([
        { Metric: "Products", Value: 3 },
        { Metric: "Grand total", Value: 20941308.5 }
      ])
    );
  });
});
