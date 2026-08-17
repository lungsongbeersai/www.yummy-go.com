import { describe, expect, it } from "vitest";
import type { AuthUser } from "@/stores/auth-store";
import type { BestSellingProductGroup, BestSellingProductItem } from "@/stores/report-store";
import {
  buildBestSellingPrintData,
  buildBestSellingReportOps,
  renderBestSellingPrintHtml,
  type BestSellingPrintLabels,
} from "./best-selling-products-report-print";

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

const labels: BestSellingPrintLabels = {
  grandTotal: "Grand total",
  groupLabel: "Group",
  groupTotal: "Total Sales",
  itemsHeaderLeft: "Product",
  itemsHeaderRight: "Total amount",
  period: "Period",
  printedAt: "Printed at",
  printedBy: "Printed by",
  title: "Best selling products",
};

function item(overrides: Partial<BestSellingProductItem> = {}): BestSellingProductItem {
  return {
    billDiscountShare: 0,
    categoryName: "Soft Drink",
    charge: 0,
    finalTotal: 10000,
    groupId: "group-1",
    groupName: "Drinks",
    id: "item-1",
    itemDiscount: 0,
    productCode: "P1",
    productName: "Coca Cola",
    qty: 5,
    rank: 1,
    salePrice: 2000,
    subtotal: 10000,
    vat: 0,
    ...overrides,
  };
}

function group(overrides: Partial<BestSellingProductGroup> = {}, items: BestSellingProductItem[] = [item()]): BestSellingProductGroup {
  return {
    billDiscountShare: 0,
    charge: 0,
    finalTotal: items.reduce((total, current) => total + current.finalTotal, 0),
    id: "group-1",
    itemDiscount: 0,
    items,
    name: "Drinks",
    productCount: items.length,
    qtyTotal: items.reduce((total, current) => total + current.qty, 0),
    subtotal: items.reduce((total, current) => total + current.subtotal, 0),
    vat: 0,
    ...overrides,
  };
}

function manyItems(count: number) {
  return Array.from({ length: count }, (_, index) =>
    item({ finalTotal: 1000, id: `item-${index + 1}`, productName: `Product ${index + 1}`, qty: 1 }),
  );
}

describe("buildBestSellingPrintData", () => {
  it("keeps only rank, name, qty, category, and revenue per product, dropping the per-metric financial breakdown", () => {
    const data = buildBestSellingPrintData({
      dateFrom: "2026-07-13",
      dateTo: "2026-07-13",
      groups: [group()],
      labels,
      summary: { final_total: 10000 },
      user,
    });

    expect(data.groups).toEqual([
      {
        items: [{ categoryName: "Soft Drink", finalTotal: 10000, name: "Coca Cola", qty: 5, rank: 1 }],
        name: "Drinks",
        total: 10000,
      },
    ]);
    expect(data.grandTotal).toBe(10000);
  });

  it("does not cap the items printed per group, unlike the old top-10 design", () => {
    const items = manyItems(13);
    const data = buildBestSellingPrintData({
      dateFrom: "2026-07-13",
      dateTo: "2026-07-13",
      groups: [group({}, items)],
      labels,
      summary: { final_total: 13000 },
      user,
    });

    expect(data.groups[0].items).toHaveLength(13);
  });

  it("renumbers items starting at 1 within each group, ignoring the report-wide rank field", () => {
    const items = [
      item({ id: "a", productName: "A", rank: 7 }),
      item({ id: "b", productName: "B", rank: 9 }),
    ];
    const data = buildBestSellingPrintData({
      dateFrom: "2026-07-13",
      dateTo: "2026-07-13",
      groups: [group({}, items)],
      labels,
      summary: {},
      user,
    });

    expect(data.groups[0].items.map((entry) => entry.rank)).toEqual([1, 2]);
  });

  it("keeps groups in the order given, each carrying its own total", () => {
    const drinks = group({ finalTotal: 10000, id: "g1", name: "Drinks" });
    const food = group({ finalTotal: 20000, id: "g2", name: "Food" }, [item({ finalTotal: 20000, id: "food-1" })]);
    const data = buildBestSellingPrintData({
      dateFrom: "2026-07-13",
      dateTo: "2026-07-13",
      groups: [drinks, food],
      labels,
      summary: { final_total: 30000 },
      user,
    });

    expect(data.groups.map((entry) => entry.name)).toEqual(["Drinks", "Food"]);
    expect(data.groups.map((entry) => entry.total)).toEqual([10000, 20000]);
    expect(data.grandTotal).toBe(30000);
  });
});

describe("renderBestSellingPrintHtml", () => {
  function html(groups: BestSellingProductGroup[], summary: Record<string, number> = { final_total: 10000 }) {
    return renderBestSellingPrintHtml(
      buildBestSellingPrintData({
        dateFrom: "2026-07-13",
        dateTo: "2026-07-13",
        groups,
        labels,
        summary,
        user,
      }),
    );
  }

  it("renders the shared 80mm receipt base with a group heading, rank/name/qty inline, and category subline", () => {
    const output = html([group()]);

    expect(output).toContain("@page { size: 80mm auto");
    expect(output).toContain("Group: Drinks");
    expect(output).toContain("1. Coca Cola (5)");
    expect(output).toContain('class="product-category">Soft Drink');
  });

  it("renders a total row per group and a headline grand total block for the whole report", () => {
    const drinks = group({ finalTotal: 10000, id: "g1", name: "Drinks" });
    const food = group({ finalTotal: 20000, id: "g2", name: "Food" }, [item({ finalTotal: 20000, id: "food-1" })]);
    const output = html([drinks, food], { final_total: 30000 });

    expect(output).toContain("Total Sales");
    expect(output).toContain('class="total-row grand-total"');
  });

  it("does not print the subtotal/discount/service/vat breakdown, since that is the daily-closing/daily-sales report's job", () => {
    const output = html([group()]);

    expect(output).not.toContain("Subtotal");
    expect(output).not.toContain("Discount");
    expect(output).not.toContain("VAT");
  });
});

describe("buildBestSellingReportOps", () => {
  function printData(groups: BestSellingProductGroup[] = [group()]) {
    return buildBestSellingPrintData({
      dateFrom: "2026-07-13",
      dateTo: "2026-07-13",
      groups,
      labels,
      summary: { final_total: 10000 },
      user,
    });
  }

  it("gives every lr op an explicit bold flag so the printer agent never receives an inconsistent op shape", () => {
    const ops = buildBestSellingReportOps(printData());
    const lrOps = ops.filter((op) => op.type === "lr");

    expect(lrOps.length).toBeGreaterThan(0);
    lrOps.forEach((op) => {
      expect(typeof op.bold).toBe("boolean");
    });
  });

  it("orders the header like receiptHeaderHtml: store name, then branch, then title", () => {
    const ops = buildBestSellingReportOps(printData());
    const storeIndex = ops.findIndex((op) => op.text === "Store");
    const branchIndex = ops.findIndex((op) => op.text === "Branch");
    const titleIndex = ops.findIndex((op) => op.text === "Best selling products");

    expect(storeIndex).toBeGreaterThanOrEqual(0);
    expect(branchIndex).toBeGreaterThan(storeIndex);
    expect(titleIndex).toBeGreaterThan(branchIndex);
  });

  it("prints every product row for a group without capping at 10", () => {
    const ops = buildBestSellingReportOps(printData([group({}, manyItems(13))]));
    const productRows = ops.filter((op) => op.type === "lr" && /^\d+\. Product \d+/.test(op.left ?? ""));

    expect(productRows).toHaveLength(13);
  });

  it("prints a group heading and a group total row for each group", () => {
    const drinks = group({ finalTotal: 10000, id: "g1", name: "Drinks" });
    const food = group({ finalTotal: 20000, id: "g2", name: "Food" }, [item({ finalTotal: 20000, id: "food-1" })]);
    const ops = buildBestSellingReportOps(printData([drinks, food]));

    expect(ops.some((op) => op.text === "Group: Drinks")).toBe(true);
    expect(ops.some((op) => op.text === "Group: Food")).toBe(true);
    expect(ops.filter((op) => op.left === "Total Sales")).toHaveLength(2);
  });

  it("prints the grand total as a single bold lr row at size 34, matching daily-sales exactly", () => {
    const ops = buildBestSellingReportOps(printData());
    const grandTotalOp = ops.find((op) => op.left === "Grand total");

    expect(grandTotalOp?.type).toBe("lr");
    expect(grandTotalOp?.bold).toBe(true);
    expect(grandTotalOp?.size).toBe(34);
  });

  it("does not print the subtotal/discount/service/vat breakdown, since that is the daily-closing/daily-sales report's job", () => {
    const ops = buildBestSellingReportOps(printData());

    expect(ops.some((op) => op.text === "Subtotal" || op.left === "Subtotal")).toBe(false);
    expect(ops.some((op) => op.text === "VAT" || op.left === "VAT")).toBe(false);
  });
});
