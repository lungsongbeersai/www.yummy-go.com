import { describe, expect, it } from "vitest";
import type { AuthUser } from "@/stores/auth-store";
import type { CategorySalesGroup } from "@/stores/report-store";
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
  period: "Period",
  printedAt: "Printed at",
  printedBy: "Printed by",
  title: "Category sales report",
};

function group(overrides: Partial<CategorySalesGroup> = {}): CategorySalesGroup {
  return {
    categories: [],
    groupName: "Food",
    groupUuid: "group-1",
    rows: [],
    sortOrder: 1,
    summary: { grand_total: 110000, total_qty: 8 },
    ...overrides,
  };
}

function printData() {
  return buildCategorySalesPrintData({
    dateFrom: "2026-07-13",
    dateTo: "2026-07-13",
    groups: [
      group(),
      group({ groupName: "Drink", groupUuid: "group-2", summary: { grand_total: 30000, total_qty: 4 }, sortOrder: 2 }),
    ],
    labels,
    summary: { grand_total: 140000 },
    user,
  });
}

describe("buildCategorySalesPrintData", () => {
  it("keeps only name, quantity, and grand total per group, dropping category/product detail and the financial breakdown", () => {
    const data = printData();

    expect(data.groups).toEqual([
      { grandTotal: 110000, name: "Food", totalQty: 8 },
      { grandTotal: 30000, name: "Drink", totalQty: 4 },
    ]);
    expect(data.grandTotal).toBe(140000);
  });
});

describe("renderCategorySalesPrintHtml", () => {
  it("renders the shared 80mm receipt base with quantity inline and a headline grand total block", () => {
    const html = renderCategorySalesPrintHtml(printData());

    expect(html).toContain("@page { size: 80mm 297mm");
    expect(html).toContain("Food (8)");
    expect(html).toContain("Drink (4)");
    expect(html).toContain('class="headline-total"');
    expect(html).not.toContain('class="total-row grand-total"');
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

  it("prints one plain lr row per group with its quantity inline", () => {
    const ops = buildCategorySalesReportOps(printData());

    const foodRow = ops.find((op) => op.left === "Food (8)");
    const drinkRow = ops.find((op) => op.left === "Drink (4)");

    expect(foodRow?.type).toBe("lr");
    expect(foodRow?.bold).toBe(false);
    expect(drinkRow?.type).toBe("lr");
    expect(drinkRow?.bold).toBe(false);
  });

  it("prints the grand total as two bold text ops instead of an lr row, matching the daily-sales/daily-closing/payment-methods pattern since bold/size on lr does nothing physically", () => {
    const ops = buildCategorySalesReportOps(printData());
    const labelOp = ops.find((op) => op.text === "Grand total");
    const amountOp = ops[ops.indexOf(labelOp!) + 1];

    expect(labelOp?.type).toBe("text");
    expect(labelOp?.bold).toBe(true);
    expect(amountOp?.type).toBe("text");
    expect(amountOp?.align).toBe("right");
    expect(amountOp?.bold).toBe(true);
    expect(ops.some((op) => op.type === "lr" && op.left === "Grand total")).toBe(false);
  });

  it("does not print the subtotal/discount/service/vat breakdown, since that is the daily-closing/daily-sales report's job", () => {
    const ops = buildCategorySalesReportOps(printData());

    expect(ops.some((op) => op.text === "Subtotal" || op.left === "Subtotal")).toBe(false);
    expect(ops.some((op) => op.text === "VAT" || op.left === "VAT")).toBe(false);
  });
});
