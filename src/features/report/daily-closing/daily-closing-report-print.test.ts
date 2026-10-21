import { describe, expect, it } from "vitest";
import {
  WINDOW_OPEN_FONT_CLASS_NAME,
  WINDOW_OPEN_FONT_STYLESHEET_HREF,
} from "@/lib/window-open-fonts";
import { money } from "@/lib/format";
import { RECEIPT_80MM_BASE_STYLES } from "@/features/report/shared/report-receipt-print";
import type { DailyStoreClosingReport } from "@/stores/report-store";
import {
  type DailyClosingPrintData,
  buildDailyClosingReportOps,
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
            toppings: [
              {
                key: "topping-1",
                name: "Egg & meat",
                price: 5000,
                qty: 2,
              },
            ],
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
    orderChannels: [
      { billCount: 9, channel: 1, grandTotal: 9572453, key: "order-channel-1", name: "Dine-in" },
      { billCount: 0, channel: 2, grandTotal: 0, key: "order-channel-2", name: "Takeaway" },
      { billCount: 0, channel: 3, grandTotal: 0, key: "order-channel-3", name: "Delivery" },
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
    paymentSummary: {
      cash: 63000,
      credit: 0,
      paymentTotal: 64000,
      transfer: 1000,
    },
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
      currencyUnit: "kip",
      discount: "Discount",
      employeeSignature: "Employee signature",
      grandTotal: "Grand total",
      group: "Group",
      groupTotal: "Group total",
      items: "items",
      noData: "No data",
      orderChannelSummary: "Sales summary by order channel",
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
  it("renders on the shared 80 x 297 mm receipt base used by daily sales", () => {
    const html = renderDailyClosingPrintHtml(printData());

    expect(html).toContain(RECEIPT_80MM_BASE_STYLES);
    expect(html).toContain("@page { size: 80mm auto; margin: 3mm; }");
    expect(html).toContain("html, body { width: 74mm");
    expect(html).toContain("grid-template-columns: minmax(0, 1fr) 23mm");
    expect(html).toContain('class="headline-total"');
    expect(html).toContain('class="headline-total-label"');
    expect(html).toContain('class="headline-total-value"');
    expect(html).not.toContain('class="total-row grand-total"');
    expect(html).toContain(`href="${WINDOW_OPEN_FONT_STYLESHEET_HREF}"`);
    expect(html).toContain(`body class="${WINDOW_OPEN_FONT_CLASS_NAME}"`);
    expect(html).toContain("document.fonts?.ready");
  });

  it("escapes group, product, and topping content", () => {
    const html = renderDailyClosingPrintHtml(printData());

    expect(html).toContain("Food &amp; Drink");
    expect(html).toContain("Rice &lt;Large&gt;");
    expect(html).not.toContain("Rice <Large>");
    expect(html).toContain(`+ Egg &amp; meat × 2 · ${money(5000, "")}`);
    expect(html).not.toContain("Egg & meat");
  });

  it("shows base price × quantity under each product", () => {
    const html = renderDailyClosingPrintHtml(printData());

    expect(html).toMatch(/Total quantity\s*<\/span>\s*<span>\s*2\s*items\s*<\/span>/);
    expect(html).toContain(`${money(60000, "")} × 1`);
    expect(html).not.toContain("Unit price");
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

    // Checks the rendered value itself (">-0<"), not a bare "-0" substring — the business date
    // "2026-07-10" already contains "-0" (from "-07-") and would false-positive a looser check.
    expect(renderDailyClosingPrintHtml(data)).not.toContain(">-0<");
    expect(buildDailyClosingReportOps(data).find((op) => op.left === "Discount")?.right).toBe("0");
  });

  it("omits the difference row and places employee and manager signatures left to right", () => {
    const html = renderDailyClosingPrintHtml(printData());

    expect(html).toContain("1. Cash");
    expect(html).toContain("2. Transfer");
    expect(html).toContain("3. Credit");
    expect(html).toContain("4. Payments received");
    expect(html).not.toContain("Difference");
    expect(html).toContain("5. Cancelled bills (1)");
    expect(html.indexOf("employee-signature")).toBeLessThan(html.indexOf("store-manager-signature"));
    expect(html).toContain("Store manager signature");
    expect(html).toContain("Employee signature");
  });

  it("renders the product/total-amount column header as a single row", () => {
    const html = renderDailyClosingPrintHtml(printData());

    expect(html).toContain('class="row"');
    expect(html).toContain("<span>Product</span>");
    expect(html).not.toContain('class="column-total-label"');
  });

  it("keeps only the Lao half of the bilingual backend label on the column header, dropping the English suffix that previously overflowed and broke a physical print", () => {
    const data = printData();
    data.report.labels.totalAmount = "ລວມເປັນເງິນ / Total Amount";

    const html = renderDailyClosingPrintHtml(data);

    expect(html).toContain("<span>ລວມເປັນເງິນ</span>");
    // The dedicated Total Amount summary row further down still gets the full bilingual label.
    expect(html).toContain("ລວມເປັນເງິນ / Total Amount");
  });

  it("de-emphasizes group total, total quantity, and payment total rows to match the plain lr rows the printer actually renders", () => {
    const html = renderDailyClosingPrintHtml(printData());

    expect(html).not.toContain('class="category-total row strong"');
    expect(html).toContain('class="category-total row"');
    expect(html).not.toContain('class="total-row strong"');
  });

  it("renders a numbered sales-by-order-channel section after the revenue summary", () => {
    const html = renderDailyClosingPrintHtml(printData());

    expect(html).toContain("Sales summary by order channel");
    expect(html.indexOf("Sales summary by order channel")).toBeGreaterThan(
      html.indexOf("Revenue summary"),
    );
    expect(html).toContain("<span>1. Dine-in (9)</span>");
    expect(html).toContain(`<span>${money(9572453, "")}</span>`);
    expect(html).toContain("<span>2. Takeaway (0)</span>");
    expect(html).toContain("<span>3. Delivery (0)</span>");
  });

  it("omits the order-channel section entirely when the API returns no channels", () => {
    const data = printData();
    data.report.orderChannels = [];

    const html = renderDailyClosingPrintHtml(data);

    expect(html).not.toContain("Sales summary by order channel");
  });
});

describe("buildDailyClosingReportOps", () => {
  it("gives every lr op an explicit bold flag so the printer agent never receives an inconsistent op shape", () => {
    const ops = buildDailyClosingReportOps(printData());
    const lrOps = ops.filter((op) => op.type === "lr");

    expect(lrOps.length).toBeGreaterThan(0);
    lrOps.forEach((op) => {
      expect(typeof op.bold).toBe("boolean");
    });
  });

  it("matches the browser receipt's full detail: per-product breakdown, total quantity with unit, and revenue summary", () => {
    const ops = buildDailyClosingReportOps(printData());

    expect(ops.some((op) => op.left === "Rice <Large>")).toBe(true);
    expect(ops.some((op) => op.text?.includes("Egg & meat"))).toBe(true);

    const totalQtyOp = ops.find((op) => op.left === "Total quantity");
    expect(totalQtyOp?.right).toBe("2 items");
    expect(totalQtyOp?.bold).toBe(false);
    expect(totalQtyOp?.size).toBe(24);

    expect(ops.some((op) => op.left === "1. Cash")).toBe(true);
    expect(ops.some((op) => op.left === "5. Cancelled bills (1)")).toBe(true);
  });

  it("prints the column header as a single lr row using only the Lao half of the bilingual backend label, now short enough to safely share one line", () => {
    const data = printData();
    data.report.labels.totalAmount = "ລວມເປັນເງິນ / Total Amount";

    const ops = buildDailyClosingReportOps(data);
    const headerOp = ops.find((op) => op.left === "Product");

    expect(headerOp?.type).toBe("lr");
    expect(headerOp?.right).toBe("ລວມເປັນເງິນ");
    expect(headerOp?.bold).toBe(false);

    // The dedicated Total Amount summary row further down still gets the full bilingual label,
    // plus the "(kip)" currency-unit suffix the daily-closing report adds now that ₭ is stripped from every amount.
    const summaryOp = ops.find((op) => op.left === "ລວມເປັນເງິນ / Total Amount (kip)");
    expect(summaryOp).toBeTruthy();
  });

  it("orders the header like receiptHeaderHtml: store name, then branch, then title", () => {
    const ops = buildDailyClosingReportOps(printData());
    const storeIndex = ops.findIndex((op) => op.text === "Store");
    const branchIndex = ops.findIndex((op) => op.text === "Central");
    const titleIndex = ops.findIndex((op) => op.text === "Daily store closing report");

    expect(storeIndex).toBeGreaterThanOrEqual(0);
    expect(branchIndex).toBeGreaterThan(storeIndex);
    expect(titleIndex).toBeGreaterThan(branchIndex);
  });

  it("closes each group with a dashed rule resolved against the printer's width", () => {
    const ops = buildDailyClosingReportOps(printData());
    const groupTotalIndex = ops.findIndex((op) => op.left === "Group total Food & Drink");

    expect(groupTotalIndex).toBeGreaterThanOrEqual(0);
    expect(ops[groupTotalIndex + 1]).toEqual({ type: "line", style: "dashed" });
    expect(ops[groupTotalIndex]?.bold).toBe(false);
    expect(ops[groupTotalIndex]?.size).toBe(24);
  });

  it("requests full-width dashed separators instead of fixed-length text", () => {
    const ops = buildDailyClosingReportOps(printData());

    expect(ops.filter((op) => op.type === "line").length).toBeGreaterThan(0);
    expect(ops.filter((op) => op.type === "line").every((op) => op.style === "dashed")).toBe(true);
    expect(ops.some((op) => op.type === "text" && /^[-_]+$/.test(op.text ?? ""))).toBe(false);
  });

  it("keeps the payment total row consistent with the other revenue-summary rows", () => {
    const ops = buildDailyClosingReportOps(printData());
    const paymentTotalOp = ops.find((op) => op.left === "4. Payments received");

    expect(paymentTotalOp?.bold).toBe(false);
    expect(paymentTotalOp?.size).toBe(24);
  });

  it("keeps signature prompts as printable placeholders, each under its own dot-line lr row so the dots land directly above their own name", () => {
    const ops = buildDailyClosingReportOps(printData());
    const html = renderDailyClosingPrintHtml(printData());
    const signatureRow = ops.find((op) => op.left === "Employee signature");
    const dotsRow = ops[ops.indexOf(signatureRow!) - 1];

    expect(signatureRow?.right).toBe("Store manager signature");
    expect(dotsRow?.type).toBe("lr");
    expect(dotsRow?.left).toBe(dotsRow?.right);
    expect(dotsRow?.left).toMatch(/^\.+$/);

    // The ops dot text must appear verbatim in the HTML preview too (1:1 parity).
    expect(html).toContain(`<span>${dotsRow?.left}</span>`);
  });

  it("keeps the grand total prominent with two bold lines on current and older Agents", () => {
    const ops = buildDailyClosingReportOps(printData());
    const labelOp = ops.find((op) => op.text === "Grand total");
    const amountOp = ops[ops.indexOf(labelOp!) + 1];

    expect(labelOp?.type).toBe("text");
    expect(labelOp?.bold).toBe(true);
    expect(amountOp?.type).toBe("text");
    expect(amountOp?.align).toBe("right");
    expect(amountOp?.bold).toBe(true);
    expect(ops.some((op) => op.type === "lr" && op.left?.includes("Grand total"))).toBe(false);
  });

  it("gives the signature area extra leading space before the dot-line, more than the standard blank spacing used elsewhere", () => {
    const ops = buildDailyClosingReportOps(printData());
    const signatureRow = ops.find((op) => op.left === "Employee signature");
    const dotsRow = ops[ops.indexOf(signatureRow!) - 1];
    const blankRow = ops[ops.indexOf(dotsRow) - 1];

    expect(blankRow?.type).toBe("blank");
    expect(blankRow?.n).toBeGreaterThanOrEqual(3);
  });

  it("prints a numbered sales-by-order-channel section between the revenue summary and the signature area", () => {
    const ops = buildDailyClosingReportOps(printData());

    const titleIndex = ops.findIndex((op) => op.text === "Sales summary by order channel");
    expect(titleIndex).toBeGreaterThanOrEqual(0);
    expect(ops[titleIndex - 1]).toEqual({ type: "line", style: "dashed" });

    const channelOp = ops.find((op) => op.left === "1. Dine-in (9)");
    expect(channelOp?.type).toBe("lr");
    expect(channelOp?.right).toBe(money(9572453, ""));

    expect(ops.some((op) => op.left === "2. Takeaway (0)")).toBe(true);
    expect(ops.some((op) => op.left === "3. Delivery (0)")).toBe(true);

    const cancelIndex = ops.findIndex((op) => op.left?.startsWith("5. Cancelled bills"));
    const blankIndex = ops.findIndex((op) => op.type === "blank");
    expect(titleIndex).toBeGreaterThan(cancelIndex);
    expect(titleIndex).toBeLessThan(blankIndex);
  });

  it("omits the order-channel ops entirely when the API returns no channels", () => {
    const data = printData();
    data.report.orderChannels = [];

    const ops = buildDailyClosingReportOps(data);

    expect(ops.some((op) => op.text === "Sales summary by order channel")).toBe(false);
  });

  it("prints the applied date and time range in both the preview and ESC/POS metadata", () => {
    const data = printData();
    data.businessDate = "21/10/2026 18:00 - 22/10/2026 05:59";

    expect(renderDailyClosingPrintHtml(data)).toContain(data.businessDate);
    expect(buildDailyClosingReportOps(data)).toContainEqual({
      type: "text", text: `Business date: ${data.businessDate}`, align: "left", size: 24,
    });
  });

  it("keeps each payment-period endpoint together on a separate line for narrow paper", () => {
    const data = printData();
    data.labels.businessDate = "Payment period";
    data.paymentPeriod = { from: "21/10/2026 18:00", to: "22/10/2026 05:59" };
    const html = renderDailyClosingPrintHtml(data);
    const ops = buildDailyClosingReportOps(data);

    expect(html).toContain("<p>21/10/2026 18:00 -</p>");
    expect(html).toContain("<p>22/10/2026 05:59</p>");
    const header = ops.findIndex((op) => op.text === "Payment period:");
    expect(header).toBeGreaterThanOrEqual(0);
    expect(ops.slice(header + 1, header + 3).map((op) => op.text)).toEqual([
      "21/10/2026 18:00 -", "22/10/2026 05:59",
    ]);
  });
});
