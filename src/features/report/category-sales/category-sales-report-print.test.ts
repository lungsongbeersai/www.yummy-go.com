import { describe, expect, it } from "vitest";
import type { AuthUser } from "@/stores/auth-store";
import type { CategorySalesGroup, CategorySalesRow } from "@/stores/report-store";
import {
  buildCategorySalesPrintData,
  buildCategorySalesReportOps,
  renderCategorySalesPrintHtml,
  type CategorySalesPrintLabels,
} from "./category-sales-report-print";

const user: AuthUser = {
  branch_address: "",
  branch_name: "Branch",
  branch_tel: "",
  branch_uuid: "branch-1",
  email: "cashier@example.com",
  profile: "",
  status: 1,
  store_logo: "",
  store_name: "Store",
  store_table_status: 1,
  store_uuid: "store-1",
  uuid: "user-1",
};

const labels: CategorySalesPrintLabels = {
  grandTotal: "Grand total",
  groupLabel: "Group",
  groupTotal: "Total Sales",
  itemsHeaderLeft: "Product",
  itemsHeaderRight: "Total amount",
  period: "Period",
  printedAt: "Printed at",
  printedBy: "Printed by",
  title: "Category sales report",
};

function row(overrides: Partial<CategorySalesRow> = {}): CategorySalesRow {
  return {
    afterDiscountBill: 0,
    afterDiscountItem: 0,
    billCount: 1,
    cateName: "Soft Drink",
    cateUuid: "cate-1",
    discountBill: 0,
    discountItemAmount: 0,
    discountTotal: 0,
    groupName: "Drinks",
    groupUuid: "group-1",
    grandTotal: 10000,
    productName: "Coca Cola",
    productPriceTotal: 10000,
    productUuid: "prod-1",
    rank: 1,
    serviceCharge: 0,
    serviceRate: 0,
    sortOrder: 1,
    toppingTotal: 0,
    total: 10000,
    totalQty: 5,
    vat: 0,
    vatRate: 0,
    ...overrides,
  };
}

function group(overrides: Partial<CategorySalesGroup> = {}, rows: CategorySalesRow[] = [row()]): CategorySalesGroup {
  return {
    categories: [],
    groupName: "Drinks",
    groupUuid: "group-1",
    rows,
    sortOrder: 1,
    summary: { grand_total: rows.reduce((total, current) => total + current.grandTotal, 0), total_qty: rows.reduce((total, current) => total + current.totalQty, 0) },
    ...overrides,
  };
}

function manyRows(count: number) {
  return Array.from({ length: count }, (_, index) =>
    row({ grandTotal: 1000, productName: `Product ${index + 1}`, productUuid: `prod-${index + 1}`, totalQty: 1 }),
  );
}

function printData(groups: CategorySalesGroup[] = [group()], summary: Record<string, number> = { grand_total: 10000 }) {
  return buildCategorySalesPrintData({
    dateFrom: "2026-07-13",
    dateTo: "2026-07-13",
    groups,
    labels,
    summary,
    user,
  });
}

describe("buildCategorySalesPrintData", () => {
  it("keeps only rank, name, qty, category, and grand total per product, dropping the per-metric financial breakdown", () => {
    const data = printData();

    expect(data.groups).toEqual([
      {
        items: [{ categoryName: "Soft Drink", grandTotal: 10000, name: "Coca Cola", qty: 5, rank: 1 }],
        name: "Drinks",
        total: 10000,
      },
    ]);
    expect(data.grandTotal).toBe(10000);
  });

  it("does not cap the items printed per group, unlike a top-N design", () => {
    const data = printData([group({}, manyRows(13))]);

    expect(data.groups[0].items).toHaveLength(13);
  });

  it("renumbers items starting at 1 within each group", () => {
    const rows = [
      row({ productName: "A", productUuid: "a" }),
      row({ productName: "B", productUuid: "b" }),
    ];
    const data = printData([group({}, rows)]);

    expect(data.groups[0].items.map((entry) => entry.rank)).toEqual([1, 2]);
  });

  it("keeps groups in the order given, each carrying its own total", () => {
    const drinks = group({ groupName: "Drinks", groupUuid: "g1", summary: { grand_total: 10000, total_qty: 5 } });
    const food = group(
      { groupName: "Food", groupUuid: "g2", summary: { grand_total: 20000, total_qty: 2 } },
      [row({ cateName: "Rice", grandTotal: 20000, productName: "Fried Rice", productUuid: "food-1", totalQty: 2 })],
    );
    const data = printData([drinks, food], { grand_total: 30000 });

    expect(data.groups.map((entry) => entry.name)).toEqual(["Drinks", "Food"]);
    expect(data.groups.map((entry) => entry.total)).toEqual([10000, 20000]);
    expect(data.grandTotal).toBe(30000);
  });
});

describe("renderCategorySalesPrintHtml", () => {
  it("renders the shared 80mm receipt base with a group heading, rank/name/qty inline, and category subline", () => {
    const html = renderCategorySalesPrintHtml(printData());

    expect(html).toContain("@page { size: 80mm auto");
    expect(html).toContain("Group: Drinks");
    expect(html).toContain("1. Coca Cola (5)");
    expect(html).toContain('class="product-category">Soft Drink');
  });

  it("renders a total row per group and a headline grand total block for the whole report", () => {
    const drinks = group({ groupName: "Drinks", groupUuid: "g1", summary: { grand_total: 10000, total_qty: 5 } });
    const food = group(
      { groupName: "Food", groupUuid: "g2", summary: { grand_total: 20000, total_qty: 2 } },
      [row({ grandTotal: 20000, productName: "Fried Rice", productUuid: "food-1", totalQty: 2 })],
    );
    const html = renderCategorySalesPrintHtml(printData([drinks, food], { grand_total: 30000 }));

    expect(html).toContain("Total Sales");
    expect(html).toContain('class="total-row grand-total"');
  });

  it("does not print the subtotal/discount/service/vat breakdown, since that is the daily-closing/daily-sales report's job", () => {
    const html = renderCategorySalesPrintHtml(printData());

    expect(html).not.toContain("Subtotal");
    expect(html).not.toContain("Discount");
    expect(html).not.toContain("VAT");
  });
});

describe("buildCategorySalesReportOps", () => {
  it("gives every lr op an explicit bold flag so the printer agent never receives an inconsistent op shape", () => {
    const ops = buildCategorySalesReportOps(printData());
    const lrOps = ops.filter((op) => op.type === "lr");

    expect(lrOps.length).toBeGreaterThan(0);
    lrOps.forEach((op) => {
      expect(typeof op.bold).toBe("boolean");
    });
  });

  it("orders the header like receiptHeaderHtml: store name, then branch, then title", () => {
    const ops = buildCategorySalesReportOps(printData());
    const storeIndex = ops.findIndex((op) => op.text === "Store");
    const branchIndex = ops.findIndex((op) => op.text === "Branch");
    const titleIndex = ops.findIndex((op) => op.text === "Category sales report");

    expect(storeIndex).toBeGreaterThanOrEqual(0);
    expect(branchIndex).toBeGreaterThan(storeIndex);
    expect(titleIndex).toBeGreaterThan(branchIndex);
  });

  it("prints every product row for a group without capping at 10", () => {
    const ops = buildCategorySalesReportOps(printData([group({}, manyRows(13))]));
    const productRows = ops.filter((op) => op.type === "lr" && /^\d+\. Product \d+/.test(op.left ?? ""));

    expect(productRows).toHaveLength(13);
  });

  it("prints a group heading and a group total row for each group", () => {
    const drinks = group({ groupName: "Drinks", groupUuid: "g1", summary: { grand_total: 10000, total_qty: 5 } });
    const food = group(
      { groupName: "Food", groupUuid: "g2", summary: { grand_total: 20000, total_qty: 2 } },
      [row({ grandTotal: 20000, productName: "Fried Rice", productUuid: "food-1", totalQty: 2 })],
    );
    const ops = buildCategorySalesReportOps(printData([drinks, food], { grand_total: 30000 }));

    expect(ops.some((op) => op.text === "Group: Drinks")).toBe(true);
    expect(ops.some((op) => op.text === "Group: Food")).toBe(true);
    expect(ops.filter((op) => op.left === "Total Sales")).toHaveLength(2);
  });

  it("prints the grand total as a single bold lr row at size 34, matching daily-sales exactly", () => {
    const ops = buildCategorySalesReportOps(printData());
    const grandTotalOp = ops.find((op) => op.left === "Grand total");

    expect(grandTotalOp?.type).toBe("lr");
    expect(grandTotalOp?.bold).toBe(true);
    expect(grandTotalOp?.size).toBe(34);
  });

  it("does not print the subtotal/discount/service/vat breakdown, since that is the daily-closing/daily-sales report's job", () => {
    const ops = buildCategorySalesReportOps(printData());

    expect(ops.some((op) => op.text === "Subtotal" || op.left === "Subtotal")).toBe(false);
    expect(ops.some((op) => op.text === "VAT" || op.left === "VAT")).toBe(false);
  });
});
