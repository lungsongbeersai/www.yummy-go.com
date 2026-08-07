import { describe, expect, it } from "vitest";
import type { AuthUser } from "@/stores/auth-store";
import type { BestSellingProductItem } from "@/stores/report-store";
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
  period: "Period",
  printedAt: "Printed at",
  printedBy: "Printed by",
  title: "Best selling products",
};

function item(overrides: Partial<BestSellingProductItem> = {}): BestSellingProductItem {
  return {
    billDiscountShare: 0,
    categoryName: "Food",
    charge: 0,
    finalTotal: 10000,
    groupId: "group-1",
    groupName: "Food",
    id: "item-1",
    itemDiscount: 0,
    productCode: "P1",
    productName: "Rice",
    qty: 5,
    rank: 1,
    salePrice: 2000,
    subtotal: 10000,
    vat: 0,
    ...overrides,
  };
}

function rowsOf(count: number) {
  return Array.from({ length: count }, (_, index) =>
    item({ finalTotal: 1000, id: `item-${index + 1}`, productName: `Product ${index + 1}`, qty: 1, rank: index + 1 }),
  );
}

const othersLabel = (count: number) => `Others (${count} products)`;

describe("buildBestSellingPrintData", () => {
  it("keeps only rank, name, qty, and revenue per product, dropping the per-metric financial breakdown", () => {
    const data = buildBestSellingPrintData({
      dateFrom: "2026-07-13",
      dateTo: "2026-07-13",
      labels,
      othersLabel,
      rows: [item()],
      summary: { final_total: 10000 },
      user,
    });

    expect(data.rows).toEqual([{ finalTotal: 10000, name: "Rice", qty: 5, rank: 1 }]);
    expect(data.grandTotal).toBe(10000);
    expect(data.others).toBeNull();
  });

  it("caps the printed list at the top 10 and combines the rest into a single others row", () => {
    const rows = rowsOf(13);
    const data = buildBestSellingPrintData({
      dateFrom: "2026-07-13",
      dateTo: "2026-07-13",
      labels,
      othersLabel,
      rows,
      summary: { final_total: 13000 },
      user,
    });

    expect(data.rows).toHaveLength(10);
    expect(data.rows[0]).toEqual({ finalTotal: 1000, name: "Product 1", qty: 1, rank: 1 });
    expect(data.others).toEqual({ label: "Others (3 products)", total: 3000 });
  });

  it("does not show an others row when there are 10 or fewer products", () => {
    const data = buildBestSellingPrintData({
      dateFrom: "2026-07-13",
      dateTo: "2026-07-13",
      labels,
      othersLabel,
      rows: rowsOf(10),
      summary: { final_total: 10000 },
      user,
    });

    expect(data.others).toBeNull();
  });
});

describe("renderBestSellingPrintHtml", () => {
  it("renders the shared 80mm receipt base with rank/name/qty inline and a headline grand total block", () => {
    const html = renderBestSellingPrintHtml(
      buildBestSellingPrintData({
        dateFrom: "2026-07-13",
        dateTo: "2026-07-13",
        labels,
        othersLabel,
        rows: [item()],
        summary: { final_total: 10000 },
        user,
      }),
    );

    expect(html).toContain("@page { size: 80mm 297mm");
    expect(html).toContain("1. Rice (5)");
    expect(html).toContain('class="headline-total"');
    expect(html).not.toContain('class="total-row grand-total"');
  });

  it("renders the others row when the product list overflows the top 10", () => {
    const html = renderBestSellingPrintHtml(
      buildBestSellingPrintData({
        dateFrom: "2026-07-13",
        dateTo: "2026-07-13",
        labels,
        othersLabel,
        rows: rowsOf(13),
        summary: { final_total: 13000 },
        user,
      }),
    );

    expect(html).toContain("Others (3 products)");
  });

  it("does not print the subtotal/discount/service/vat breakdown, since that is the daily-closing/daily-sales report's job", () => {
    const html = renderBestSellingPrintHtml(
      buildBestSellingPrintData({
        dateFrom: "2026-07-13",
        dateTo: "2026-07-13",
        labels,
        othersLabel,
        rows: [item()],
        summary: { final_total: 10000 },
        user,
      }),
    );

    expect(html).not.toContain("Subtotal");
    expect(html).not.toContain("Discount");
    expect(html).not.toContain("VAT");
  });
});

describe("buildBestSellingReportOps", () => {
  function printData() {
    return buildBestSellingPrintData({
      dateFrom: "2026-07-13",
      dateTo: "2026-07-13",
      labels,
      othersLabel,
      rows: rowsOf(13),
      summary: { final_total: 13000 },
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

  it("prints exactly 10 ranked product rows plus one others row when the list overflows", () => {
    const ops = buildBestSellingReportOps(printData());

    const productRows = ops.filter((op) => op.type === "lr" && /^\d+\. Product \d+/.test(op.left ?? ""));
    const othersRow = ops.find((op) => op.left === "Others (3 products)");

    expect(productRows).toHaveLength(10);
    expect(othersRow?.type).toBe("lr");
    expect(othersRow?.bold).toBe(false);
  });

  it("prints the grand total as two bold text ops instead of an lr row, matching the daily-sales/daily-closing pattern since bold/size on lr does nothing physically", () => {
    const ops = buildBestSellingReportOps(printData());
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
    const ops = buildBestSellingReportOps(printData());

    expect(ops.some((op) => op.text === "Subtotal" || op.left === "Subtotal")).toBe(false);
    expect(ops.some((op) => op.text === "VAT" || op.left === "VAT")).toBe(false);
  });
});
