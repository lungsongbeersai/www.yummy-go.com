import { describe, expect, it } from "vitest";
import {
  WINDOW_OPEN_FONT_CLASS_NAME,
  WINDOW_OPEN_FONT_STYLESHEET_HREF,
} from "@/lib/window-open-fonts";
import type { AuthUser } from "@/stores/auth-store";
import type { DailySaleItemsBillGroup } from "@/stores/report-store";
import {
  buildDailySalesPrintData,
  buildDailySalesReportOps,
  renderDailySalesPrintHtml,
} from "./daily-sales-report-print";

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

const labels = new Proxy({}, { get: (_, key) => String(key) }) as never;

function bill(overrides: Partial<DailySaleItemsBillGroup> = {}): DailySaleItemsBillGroup {
  return {
    amountTotal: 100,
    branchName: "Branch",
    cancelled: false,
    changeAmount: 5,
    debtAmount: 6,
    discountTotal: 10,
    id: "bill-1",
    invoiceNumber: "INV-1",
    itemCount: 1,
    items: [{ group_name: "Food", product_name: "Rice", qty: 2, total: 100 }],
    lineTotal: 112,
    paymentMethodCode: "cash",
    paymentMethodName: "Cash",
    qtyTotal: 2,
    raw: {},
    receiveCashAmount: 80,
    receiveTransferAmount: 32,
    saleDate: "2026-07-13",
    serviceChargeAmount: 7,
    status: "paid",
    tableName: "A1",
    toppingTotal: 0,
    vatAmount: 15,
    ...overrides,
  };
}

describe("buildDailySalesPrintData", () => {
  it("groups matching products by category and aggregates receipt totals", () => {
    const data = buildDailySalesPrintData({
      bills: [
        bill(),
        bill({
          id: "bill-2",
          items: [
            { group_name: "Food", product_name: "Rice", qty: 1, total: 50 },
            { group_name: "Drink", product_name: "Water", qty: 1, sale_price: 20 },
          ],
        }),
      ],
      dateFrom: "2026-07-13",
      dateTo: "2026-07-13",
      labels,
      user,
    });

    expect(data.categories).toEqual([
      { amount: 150, name: "Food", products: [{ amount: 150, name: "Rice", quantity: 3 }], quantity: 3 },
      { amount: 20, name: "Drink", products: [{ amount: 20, name: "Water", quantity: 1 }], quantity: 1 },
    ]);
    expect(data.summary).toMatchObject({
      activeBillCount: 2,
      cashReceived: 160,
      discount: 20,
      grandTotal: 224,
      totalQuantity: 4,
      transferReceived: 64,
    });
  });

  it("excludes cancelled bills from sales and reports them separately", () => {
    const data = buildDailySalesPrintData({
      bills: [bill(), bill({ cancelled: true, id: "cancelled", lineTotal: 99 })],
      dateFrom: "2026-07-13",
      dateTo: "2026-07-13",
      labels,
      user,
    });

    expect(data.summary.activeBillCount).toBe(1);
    expect(data.summary.cancelledBillCount).toBe(1);
    expect(data.summary.cancelledAmount).toBe(99);
    expect(data.summary.grandTotal).toBe(112);
    expect(data.categories[0]?.quantity).toBe(2);
  });

  it("uses product groups from the category-sales API when available", () => {
    const data = buildDailySalesPrintData({
      bills: [bill()],
      dateFrom: "2026-07-13",
      dateTo: "2026-07-13",
      labels,
      salesGroups: [{
        categories: [],
        groupName: "Beverage",
        groupUuid: "group-1",
        rows: [{
          afterDiscountBill: 0,
          afterDiscountItem: 0,
          billCount: 1,
          cateName: "Water",
          cateUuid: "cate-1",
          discountBill: 0,
          discountItemAmount: 0,
          discountTotal: 0,
          grandTotal: 22000,
          groupName: "Beverage",
          groupUuid: "group-1",
          productName: "Drinking water",
          productPriceTotal: 20000,
          productUuid: "product-1",
          rank: 1,
          serviceCharge: 0,
          serviceRate: 0,
          sortOrder: 1,
          toppingTotal: 0,
          total: 20000,
          totalQty: 2,
          vat: 2000,
          vatRate: 10,
        }],
        sortOrder: 1,
        summary: {},
      }],
      user,
    });

    expect(data.categories).toEqual([{
      amount: 20000,
      name: "Beverage",
      products: [{ amount: 20000, name: "Drinking water", quantity: 2 }],
      quantity: 2,
    }]);
  });

  it("renders an escaped 80 x 297 mm receipt with category and summary sections", () => {
    const data = buildDailySalesPrintData({
      bills: [bill({ items: [{ group_name: "Food & Drink", product_name: "Rice <Large>", qty: 2, total: 100 }] })],
      dateFrom: "2026-07-13",
      dateTo: "2026-07-13",
      labels,
      user,
    });
    const html = renderDailySalesPrintHtml(data);

    expect(html).toContain("@page { size: 80mm 297mm");
    expect(html).toContain("html, body { width: 74mm");
    expect(html).toContain("group: Food &amp; Drink");
    expect(html).toContain("Rice &lt;Large&gt;");
    expect(html).toContain('class="total-row grand-total"');
    expect(html).toContain(`href="${WINDOW_OPEN_FONT_STYLESHEET_HREF}"`);
    expect(html).toContain(`body class="${WINDOW_OPEN_FONT_CLASS_NAME}"`);
    expect(html).toContain("document.fonts?.ready");
    expect(html.indexOf("grand-total")).toBeLessThan(html.indexOf("revenueSummary"));
  });
});

describe("buildDailySalesReportOps", () => {
  it("gives every lr op an explicit bold flag so the printer agent never receives an inconsistent op shape", () => {
    const data = buildDailySalesPrintData({
      bills: [bill(), bill({ cancelled: true, id: "cancelled", lineTotal: 99 })],
      dateFrom: "2026-07-13",
      dateTo: "2026-07-13",
      labels,
      user,
    });

    const ops = buildDailySalesReportOps(data);
    const lrOps = ops.filter((op) => op.type === "lr");

    expect(lrOps.length).toBeGreaterThan(0);
    lrOps.forEach((op) => {
      expect(typeof op.bold).toBe("boolean");
    });
  });

  it("orders the header like receiptHeaderHtml: store name, then branch, then title", () => {
    const data = buildDailySalesPrintData({
      bills: [bill()],
      dateFrom: "2026-07-13",
      dateTo: "2026-07-13",
      labels,
      user,
    });

    const ops = buildDailySalesReportOps(data);
    const storeIndex = ops.findIndex((op) => op.text === user.store_name);
    const branchIndex = ops.findIndex((op) => op.text === user.branch_name);
    const titleIndex = ops.findIndex((op) => op.text === "title");

    expect(storeIndex).toBeGreaterThanOrEqual(0);
    expect(branchIndex).toBeGreaterThan(storeIndex);
    expect(titleIndex).toBeGreaterThan(branchIndex);
  });

  it("prints bill count and total quantity as plain numbers, not money-formatted", () => {
    const data = buildDailySalesPrintData({
      bills: [bill()],
      dateFrom: "2026-07-13",
      dateTo: "2026-07-13",
      labels,
      user,
    });

    const ops = buildDailySalesReportOps(data);
    const billCountOp = ops.find((op) => op.left === "billCount");
    const totalQuantityOp = ops.find((op) => op.left === "totalQuantity");

    expect(billCountOp?.right).toBe(String(data.summary.activeBillCount));
    expect(totalQuantityOp?.right).not.toContain("₭");
  });

  it("omits the per-category product breakdown from the condensed summary", () => {
    const data = buildDailySalesPrintData({
      bills: [bill({ items: [{ group_name: "Food", product_name: "Rice", qty: 2, total: 100 }] })],
      dateFrom: "2026-07-13",
      dateTo: "2026-07-13",
      labels,
      user,
    });

    const ops = buildDailySalesReportOps(data);
    expect(ops.some((op) => op.text === "Rice")).toBe(false);
  });
});
