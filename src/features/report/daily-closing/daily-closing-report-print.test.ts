import { describe, expect, it } from "vitest";
import {
  WINDOW_OPEN_FONT_CLASS_NAME,
  WINDOW_OPEN_FONT_STYLESHEET_HREF,
} from "@/lib/window-open-fonts";
import type { DailyStoreClosingReport } from "@/stores/report-store";
import {
  type DailyClosingPrintData,
  renderDailyClosingPrintHtml,
} from "./daily-closing-report-print";

function printData(): DailyClosingPrintData {
  const report: DailyStoreClosingReport = {
    cancelSummary: { billCount: 1, totalAmount: 25000 },
    filters: { branchUuid: "branch-1", date: "2026-07-10", lang: "la" },
    groups: [
      {
        discountAmount: 1000,
        items: [
          {
            discountAmount: 1000,
            key: "item-1",
            productName: "Rice <Large>",
            toppings: [{ key: "topping-1", name: "Egg & meat", qty: 2 }],
            totalAmount: 59000,
            totalQty: 1,
            unitPrice: 60000,
          },
        ],
        key: "group-1",
        name: "Food & Drink",
        totalAmount: 59000,
        totalQty: 0,
      },
    ],
    labels: {
      cancelAmount: "",
      cancelBill: "",
      cash: "",
      credit: "",
      discountAmount: "",
      grandTotal: "",
      groupTotal: "",
      noGroup: "",
      paymentTotal: "",
      reportName: "",
      serviceCharge: "",
      totalAmount: "",
      totalQty: "",
      transfer: "",
      vat: "",
    },
    paymentSummary: { cash: 63000, credit: 0, paymentTotal: 64000, transfer: 1000 },
    summary: {
      discountAmount: 1000,
      grandTotal: 64000,
      serviceCharge: 3000,
      totalAmount: 59000,
      totalQty: 2,
      vat: 2000,
    },
  };

  return {
    branchName: "Central",
    businessDate: "2026-07-10",
    cashier: "cashier",
    labels: {
      businessDate: "Business date",
      cancelledBills: "Cancelled bills",
      cash: "Cash",
      cashier: "Cashier",
      credit: "Credit",
      difference: "Difference",
      discount: "Discount",
      employeeSignature: "Employee signature",
      grandTotal: "Grand total",
      group: "Group",
      groupTotal: "Group total",
      noData: "No data",
      paymentTotal: "Payments received",
      product: "Product",
      quantity: "Quantity",
      revenueSummary: "Revenue summary",
      serviceCharge: "Service charge",
      storeManagerSignature: "Store manager signature",
      title: "Daily store closing report",
      totalAmount: "Total amount",
      totalQuantity: "Total quantity",
      transfer: "Transfer",
      vat: "VAT",
    },
    report,
    storeName: "Store",
  };
}

describe("daily closing report print", () => {
  it("renders the same 80 x 297 mm receipt format as daily sales", () => {
    const html = renderDailyClosingPrintHtml(printData());

    expect(html).toContain("@page { size: 80mm 297mm; margin: 3mm; }");
    expect(html).toContain("html, body { width: 74mm");
    expect(html).toContain("grid-template-columns: minmax(0, 1fr) 11mm 23mm");
    expect(html).toContain('class="total-row grand-total"');
    expect(html).toContain(`href="${WINDOW_OPEN_FONT_STYLESHEET_HREF}"`);
    expect(html).toContain(`body class="${WINDOW_OPEN_FONT_CLASS_NAME}"`);
    expect(html).toContain("document.fonts?.ready");
  });

  it("escapes group, product, and topping content", () => {
    const html = renderDailyClosingPrintHtml(printData());

    expect(html).toContain("Food &amp; Drink");
    expect(html).toContain("Rice &lt;Large&gt;");
    expect(html).not.toContain("Rice <Large>");
    expect(html).toContain('+ Egg &amp; meat × 2');
    expect(html).not.toContain("Egg & meat");
  });

  it("shows API item quantities without showing unit prices", () => {
    const html = renderDailyClosingPrintHtml(printData());

    expect(html).toContain("Total quantity</span><span>2</span>");
    expect(html).toContain("Quantity");
    expect(html).toMatch(/Rice &lt;Large&gt;[\s\S]*<span>1<\/span>/);
    expect(html).not.toContain("Unit price");
    expect(html).not.toContain("60,000 ₭");
    expect(html).toContain("Cancelled bills (1)");
  });

  it("shows discounts only in the report summary", () => {
    const html = renderDailyClosingPrintHtml(printData());

    expect(html.match(/>Discount</g)).toHaveLength(1);
    expect(html).not.toContain('class="product-note"');
    expect(html).not.toContain('class="category-discount"');
  });

  it("prints zero discounts without a negative zero sign", () => {
    const data = printData();
    data.report.summary.discountAmount = 0;

    expect(renderDailyClosingPrintHtml(data)).not.toContain("-0 ₭");
  });

  it("numbers payment methods and places manager and employee signatures left to right", () => {
    const html = renderDailyClosingPrintHtml(printData());

    expect(html).toContain("1. Cash");
    expect(html).toContain("2. Transfer");
    expect(html).toContain("3. Credit");
    expect(html).toContain("4. Payments received");
    expect(html).toContain("5. Difference");
    expect(html).toContain("6. Cancelled bills (1)");
    expect(html.indexOf("store-manager-signature")).toBeLessThan(html.indexOf("employee-signature"));
    expect(html).toContain("Store manager signature");
    expect(html).toContain("Employee signature");
  });
});
