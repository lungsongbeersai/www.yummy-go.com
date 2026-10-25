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
    invoiceNumber: "120826-0011",
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
  it("groups active bills into invoice rows by sale date, with a total per date", () => {
    const data = buildDailySalesPrintData({
      bills: [
        bill(),
        bill({ id: "bill-2", invoiceNumber: "120826-0010", qtyTotal: 1, lineTotal: 350000, saleDate: "2026-07-13", tableName: "B2" }),
        bill({ id: "bill-3", invoiceNumber: "120826-0004", qtyTotal: 3, lineTotal: 200000, saleDate: "2026-07-14" }),
      ],
      dateFrom: "2026-07-13",
      dateTo: "2026-07-14",
      labels,
      user,
    });

    expect(data.dateGroups).toEqual([
      {
        date: "2026-07-13",
        invoices: [
          { amount: 112, invoiceNumber: "120826-0011", quantity: 2, tableName: "A1" },
          { amount: 350000, invoiceNumber: "120826-0010", quantity: 1, tableName: "B2" },
        ],
        totalAmount: 350112,
      },
      {
        date: "2026-07-14",
        invoices: [{ amount: 200000, invoiceNumber: "120826-0004", quantity: 3, tableName: "A1" }],
        totalAmount: 200000,
      },
    ]);
  });

  it("excludes cancelled bills from invoice rows and reports them separately", () => {
    const data = buildDailySalesPrintData({
      bills: [bill(), bill({ cancelled: true, id: "cancelled", lineTotal: 99 })],
      dateFrom: "2026-07-13",
      dateTo: "2026-07-13",
      labels,
      user,
    });

    expect(data.dateGroups).toEqual([
      {
        date: "2026-07-13",
        invoices: [{ amount: 112, invoiceNumber: "120826-0011", quantity: 2, tableName: "A1" }],
        totalAmount: 112,
      },
    ]);
    expect(data.summary.activeBillCount).toBe(1);
    expect(data.summary.cancelledBillCount).toBe(1);
    expect(data.summary.cancelledAmount).toBe(99);
    expect(data.summary.grandTotal).toBe(112);
  });

  it("sums bill-level totals for the summary section", () => {
    const data = buildDailySalesPrintData({
      bills: [
        bill(),
        bill({
          id: "bill-2",
          invoiceNumber: "120826-0010",
          amountTotal: 50,
          discountTotal: 5,
          lineTotal: 62,
          qtyTotal: 1,
          receiveCashAmount: 40,
          receiveTransferAmount: 22,
        }),
      ],
      dateFrom: "2026-07-13",
      dateTo: "2026-07-13",
      labels,
      user,
    });

    expect(data.summary).toMatchObject({
      activeBillCount: 2,
      cashReceived: 120,
      discount: 15,
      grandTotal: 174,
      transferReceived: 54,
    });
    expect(data.summary).not.toHaveProperty("totalQuantity");
  });
});

describe("renderDailySalesPrintHtml", () => {
  it("renders an escaped 80mm receipt with date-grouped invoice rows and a summary section", () => {
    const data = buildDailySalesPrintData({
      bills: [bill({ invoiceNumber: "<script>0011</script>" })],
      dateFrom: "2026-07-13",
      dateTo: "2026-07-13",
      labels,
      user,
    });
    const html = renderDailySalesPrintHtml(data);

    expect(html).toContain("@page { size: 80mm auto");
    expect(html).toContain("html, body { width: 74mm");
    expect(html).toContain("<span>13/07/2026</span>");
    expect(html).toContain("&lt;script&gt;0011&lt;/script&gt;");
    expect(html).toContain('class="total-row grand-total bold"');
    expect(html).toContain(`href="${WINDOW_OPEN_FONT_STYLESHEET_HREF}"`);
    expect(html).toContain(`body class="${WINDOW_OPEN_FONT_CLASS_NAME}"`);
    expect(html).toContain("document.fonts?.ready");
    expect(html.indexOf('<h2 class="section-title bold">salesSummary</h2>')).toBeLessThan(html.indexOf('<div class="total-row grand-total bold">'));
    expect(html.indexOf('<div class="total-row grand-total bold">')).toBeLessThan(html.indexOf('<h2 class="section-title bold">revenueSummary</h2>'));
  });

  it("separates each major section with a full-width CSS divider, matching auto print's { type: \"line\" } (auto print and window.open must always match)", () => {
    const data = buildDailySalesPrintData({
      bills: [bill()],
      dateFrom: "2026-07-13",
      dateTo: "2026-07-13",
      labels,
      user,
    });
    const html = renderDailySalesPrintHtml(data);

    expect(html.match(/<div class="divider"><\/div>/g)?.length).toBeGreaterThanOrEqual(3);
    expect(html).toContain(".divider { border-top: 1px solid #000; }");
  });

  it("prints each bill as 'table · invoice' with the amount, and the item count on a lighter line below", () => {
    const data = buildDailySalesPrintData({
      bills: [bill({ invoiceNumber: "120826-0011", tableName: "T01", qtyTotal: 5, lineTotal: 150000 })],
      dateFrom: "2026-07-13",
      dateTo: "2026-07-13",
      labels,
      user,
    });
    const html = renderDailySalesPrintHtml(data);

    expect(html).toContain('<div class="total-row"><span>T01 · 120826-0011</span><span>150,000</span></div>');
    expect(html).toContain('<p class="sub">5 items</p>');
    expect(html).not.toContain("1./");
  });

  it("keeps a table's bills together, tables in order of their first bill", () => {
    const data = buildDailySalesPrintData({
      bills: [
        bill({ invoiceNumber: "120826-0011", tableName: "T04" }),
        bill({ id: "bill-2", invoiceNumber: "120826-0012", tableName: "T07" }),
        bill({ id: "bill-3", invoiceNumber: "120826-0013", tableName: "T04" }),
      ],
      dateFrom: "2026-07-13",
      dateTo: "2026-07-13",
      labels,
      user,
    });
    const html = renderDailySalesPrintHtml(data);

    expect(html.indexOf("T04 · 120826-0011")).toBeLessThan(html.indexOf("T04 · 120826-0013"));
    expect(html.indexOf("T04 · 120826-0013")).toBeLessThan(html.indexOf("T07 · 120826-0012"));
  });

  it("heads each date group with the date and its bill count, and no Invoice No. / Amount header row", () => {
    const data = buildDailySalesPrintData({
      bills: [
        bill(),
        bill({ id: "bill-2", invoiceNumber: "120826-0010" }),
        bill({ id: "bill-3", invoiceNumber: "080826-0001", saleDate: "2026-07-14" }),
      ],
      dateFrom: "2026-07-13",
      dateTo: "2026-07-14",
      labels,
      user,
    });
    const html = renderDailySalesPrintHtml(data);

    expect(html).toContain('<div class="date-head bold"><span>13/07/2026</span><span class="count">2 bills</span></div>');
    expect(html).toContain('<div class="date-head bold"><span>14/07/2026</span><span class="count">1 bills</span></div>');
    expect(html).not.toContain("invoiceNumber");
  });

  it("draws a separator line between date groups, right after the previous date's total", () => {
    const data = buildDailySalesPrintData({
      bills: [
        bill({ invoiceNumber: "120826-0011", saleDate: "2026-07-13", lineTotal: 100000 }),
        bill({ id: "bill-2", invoiceNumber: "080826-0001", saleDate: "2026-07-14", lineTotal: 50000 }),
      ],
      dateFrom: "2026-07-13",
      dateTo: "2026-07-14",
      labels,
      user,
    });
    const html = renderDailySalesPrintHtml(data);

    const firstDateTotalIndex = html.indexOf("<span>dateTotal</span><span>100,000</span>");
    const secondDateHeaderIndex = html.indexOf("<span>14/07/2026</span>");
    const dividerIndex = html.indexOf('<div class="divider"></div>', firstDateTotalIndex);

    expect(firstDateTotalIndex).toBeGreaterThanOrEqual(0);
    expect(dividerIndex).toBeGreaterThan(firstDateTotalIndex);
    expect(dividerIndex).toBeLessThan(secondDateHeaderIndex);
  });

  it("prints a bold total-for-the-date row after each date group's invoices", () => {
    const data = buildDailySalesPrintData({
      bills: [
        bill({ invoiceNumber: "120826-0011", lineTotal: 100000 }),
        bill({ id: "bill-2", invoiceNumber: "120826-0010", lineTotal: 50000 }),
      ],
      dateFrom: "2026-07-13",
      dateTo: "2026-07-13",
      labels,
      user,
    });
    const html = renderDailySalesPrintHtml(data);

    expect(html).toContain('class="total-row date-total bold"><span>dateTotal</span><span>150,000</span>');
    expect(html.indexOf("120826-0010")).toBeLessThan(html.indexOf("dateTotal"));
  });

  it("keeps bill rows and the sales-summary rows at normal weight; only headings and totals are bold", () => {
    const data = buildDailySalesPrintData({
      bills: [bill()],
      dateFrom: "2026-07-13",
      dateTo: "2026-07-13",
      labels,
      user,
    });
    const html = renderDailySalesPrintHtml(data);

    expect(html).toContain('<div class="total-row"><span>A1 · 120826-0011</span>');
    expect(html).toContain('<div class="total-row"><span>billCount</span><span>1</span></div>');
    expect(html).toContain('<div class="total-row"><span>subtotal</span>');
    expect(html).not.toContain('class="total-row strong"');
  });

  it("does not append a currency symbol to any printed amount", () => {
    const data = buildDailySalesPrintData({
      bills: [bill({ lineTotal: 150000 })],
      dateFrom: "2026-07-13",
      dateTo: "2026-07-13",
      labels,
      user,
    });
    const html = renderDailySalesPrintHtml(data);

    expect(html).toContain("150,000");
    expect(html).not.toContain("₭");
  });

  it("no longer shows a total item count in the revenue summary", () => {
    const data = buildDailySalesPrintData({
      bills: [bill()],
      dateFrom: "2026-07-13",
      dateTo: "2026-07-13",
      labels,
      user,
    });
    const html = renderDailySalesPrintHtml(data);

    expect(html).not.toContain("totalQuantity");
  });
});

describe("daily sales revenue summary placement", () => {
  it.each([
    { name: "no active sales", bills: [], cash: "0", transfer: "0", debt: "0", total: "0", cancelled: "0" },
    {
      name: "mixed payments and cancelled sales",
      bills: [
        bill({ lineTotal: 100000, receiveCashAmount: 60000, receiveTransferAmount: 30000, debtAmount: 10000 }),
        bill({ id: "cancelled", cancelled: true, lineTotal: 900000, receiveCashAmount: 900000, receiveTransferAmount: 900000, debtAmount: 900000 }),
      ],
      cash: "60,000", transfer: "30,000", debt: "10,000", total: "100,000", cancelled: "900,000",
    },
    {
      name: "tendered cash includes change",
      bills: [bill({ lineTotal: 164707, receiveCashAmount: 200000, receiveTransferAmount: 0, debtAmount: 0, changeAmount: 35293 })],
      cash: "200,000", transfer: "0", debt: "0", total: "164,707", cancelled: "0",
    },
    {
      name: "credit sales",
      bills: [bill({ lineTotal: 50000, receiveCashAmount: 0, receiveTransferAmount: 0, debtAmount: 50000 })],
      cash: "0", transfer: "0", debt: "50,000", total: "50,000", cancelled: "0",
    },
  ])("keeps $name in the final five-row section in both print outputs", ({ bills, cash, transfer, debt, total, cancelled }) => {
    const data = buildDailySalesPrintData({ bills, dateFrom: "2026-07-13", dateTo: "2026-07-13", labels, user });
    const ops = buildDailySalesReportOps(data);
    const html = renderDailySalesPrintHtml(data);
    const body = html.slice(html.indexOf("<body"), html.indexOf("<script>"));
    const section = body.slice(body.indexOf('<section class="revenue-summary">'));
    const headingIndex = ops.findIndex((op) => op.type === "text" && op.text === "revenueSummary");
    const grandTotalIndex = ops.findIndex((op) => op.type === "lr" && op.left === "grandTotal");
    const expectedRows = [
      ["cashReceived", cash],
      ["transferReceived", transfer],
      ["debt", debt],
      ["totalRevenue", total],
      [`cancelledBills (${data.summary.cancelledBillCount})`, cancelled],
    ];

    expect(grandTotalIndex).toBeGreaterThanOrEqual(0);
    expect(headingIndex).toBeGreaterThan(grandTotalIndex);
    expect(ops.filter((op) => op.text === "revenueSummary")).toHaveLength(1);
    expect(ops.slice(headingIndex + 1).filter((op) => op.type === "lr").map((op) => [op.left, op.right])).toEqual(expectedRows);
    expect(ops.find((op) => op.left === "totalRevenue")).toMatchObject({ bold: true, size: 32 });
    expect(ops[headingIndex - 1]).toEqual({ type: "spacer", px: 12 });
    expect(ops[headingIndex + 1]).toEqual({ type: "spacer", px: 12 });

    expect(body.indexOf('<div class="total-row grand-total bold">')).toBeLessThan(body.indexOf('<section class="revenue-summary">'));
    expect(body.match(/<h2 class="section-title bold">revenueSummary<\/h2>/g)).toHaveLength(1);
    expect(Array.from(section.matchAll(/<div class="total-row[^"]*"><span>([^<]*)<\/span><span>([^<]*)<\/span><\/div>/g), (match) => [match[1], match[2]])).toEqual(expectedRows);
    for (const label of ["billCount", "subtotal", "discount", "serviceCharge", "vat", "grandTotal"]) {
      expect(ops.findIndex((op) => op.type === "lr" && op.left === label)).toBeLessThan(headingIndex);
      expect(section).not.toContain(`<span>${label}</span>`);
    }
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

  it("keeps the header and total sizes", () => {
    const data = buildDailySalesPrintData({
      bills: [bill()],
      dateFrom: "2026-07-13",
      dateTo: "2026-07-13",
      labels,
      user,
    });

    const ops = buildDailySalesReportOps(data);
    const titleOp = ops.find((op) => op.text === "title");
    const storeOp = ops.find((op) => op.text === user.store_name);
    const regularLrOp = ops.find((op) => op.left === "subtotal");
    const grandTotalOp = ops.find((op) => op.left === "grandTotal");

    expect(titleOp?.size).toBe(36);
    expect(storeOp?.size).toBe(32);
    expect(regularLrOp?.size).toBe(28);
    expect(grandTotalOp?.size).toBe(34);
  });

  it("uses a plain { type: \"line\" } op for every divider, confirmed working on the real printer", () => {
    const data = buildDailySalesPrintData({
      bills: [bill()],
      dateFrom: "2026-07-13",
      dateTo: "2026-07-13",
      labels,
      user,
    });

    const ops = buildDailySalesReportOps(data);
    const lineOps = ops.filter((op) => op.type === "line");

    expect(lineOps.length).toBeGreaterThanOrEqual(3);
    lineOps.forEach((op) => {
      expect(op).toEqual({ type: "line" });
    });
  });

  it("does not send text_role, which this report's print job does not accept", () => {
    const data = buildDailySalesPrintData({
      bills: [bill()],
      dateFrom: "2026-07-13",
      dateTo: "2026-07-13",
      labels,
      user,
    });

    buildDailySalesReportOps(data).forEach((op) => {
      expect(op).not.toHaveProperty("text_role");
      expect(op).not.toHaveProperty("right_size");
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

  it("prints bill count as a plain, normal-weight number under the sales-summary heading", () => {
    const data = buildDailySalesPrintData({
      bills: [bill()],
      dateFrom: "2026-07-13",
      dateTo: "2026-07-13",
      labels,
      user,
    });

    const ops = buildDailySalesReportOps(data);
    const headingIndex = ops.findIndex((op) => op.text === "salesSummary");
    const billCountIndex = ops.findIndex((op) => op.left === "billCount");

    expect(ops[headingIndex]).toMatchObject({ type: "text", bold: true });
    expect(billCountIndex).toBe(headingIndex + 2);
    expect(ops[billCountIndex]).toMatchObject({ right: String(data.summary.activeBillCount), bold: false });
    expect(ops.find((op) => op.left === "totalQuantity")).toBeUndefined();
  });

  it("does not append a currency symbol to any op's right-hand value", () => {
    const data = buildDailySalesPrintData({
      bills: [bill({ lineTotal: 150000 })],
      dateFrom: "2026-07-13",
      dateTo: "2026-07-13",
      labels,
      user,
    });

    const ops = buildDailySalesReportOps(data);
    ops.forEach((op) => {
      expect(op.right ?? "").not.toContain("₭");
    });
  });

  it("prints each bill as a normal-weight 'table · invoice' row, then its item count, then a small spacer", () => {
    const data = buildDailySalesPrintData({
      bills: [bill({ invoiceNumber: "120826-0011", tableName: "T01", qtyTotal: 5, lineTotal: 150000 })],
      dateFrom: "2026-07-13",
      dateTo: "2026-07-13",
      labels,
      user,
    });

    const ops = buildDailySalesReportOps(data);
    const invoiceIndex = ops.findIndex((op) => op.left === "T01 · 120826-0011");

    expect(ops[invoiceIndex]).toMatchObject({ type: "lr", right: "150,000", bold: false });
    expect(ops[invoiceIndex + 1]).toMatchObject({ type: "text", text: "5 items", bold: false });
    expect(ops[invoiceIndex + 2]).toEqual({ type: "spacer", px: 4 });
  });

  it("keeps a table's bills together, tables in order of their first bill", () => {
    const data = buildDailySalesPrintData({
      bills: [
        bill({ invoiceNumber: "120826-0011", tableName: "T04" }),
        bill({ id: "bill-2", invoiceNumber: "120826-0012", tableName: "T07" }),
        bill({ id: "bill-3", invoiceNumber: "120826-0013", tableName: "T04" }),
      ],
      dateFrom: "2026-07-13",
      dateTo: "2026-07-13",
      labels,
      user,
    });

    const invoiceRows = buildDailySalesReportOps(data)
      .filter((op) => op.left?.includes(" · "))
      .map((op) => op.left);

    expect(invoiceRows).toEqual(["T04 · 120826-0011", "T04 · 120826-0013", "T07 · 120826-0012"]);
  });

  it("heads each date with a bold date / bill-count row followed by a divider", () => {
    const data = buildDailySalesPrintData({
      bills: [bill(), bill({ id: "bill-2", invoiceNumber: "120826-0010" })],
      dateFrom: "2026-07-01",
      dateTo: "2026-07-20",
      labels,
      user,
    });

    const ops = buildDailySalesReportOps(data);
    const dateIndex = ops.findIndex((op) => op.left === "13/07/2026");

    expect(ops[dateIndex]).toMatchObject({ type: "lr", right: "2 bills", bold: true });
    expect(ops[dateIndex - 1]).toEqual({ type: "line" });
    expect(ops[dateIndex + 1]).toEqual({ type: "line" });
    expect(ops[dateIndex + 2]?.left).toBe("A1 · 120826-0011");
    expect(ops.find((op) => op.left === "invoiceNumber")).toBeUndefined();
  });

  it("prints a bold total-for-the-date lr row after each date group's invoices, with a divider before it", () => {
    const data = buildDailySalesPrintData({
      bills: [
        bill({ invoiceNumber: "120826-0011", lineTotal: 100000 }),
        bill({ id: "bill-2", invoiceNumber: "120826-0010", lineTotal: 50000 }),
      ],
      dateFrom: "2026-07-13",
      dateTo: "2026-07-13",
      labels,
      user,
    });

    const ops = buildDailySalesReportOps(data);
    const dateTotalIndex = ops.findIndex((op) => op.left === "dateTotal");
    const lastInvoiceIndex = ops.findIndex((op) => op.left === "A1 · 120826-0010");

    expect(ops[dateTotalIndex]).toMatchObject({ right: "150,000", bold: true });
    expect(dateTotalIndex).toBeGreaterThan(lastInvoiceIndex);
    expect(ops[dateTotalIndex - 1]).toEqual({ type: "line" });
  });

  it("draws a separator line between date groups, right after the previous date's total", () => {
    const data = buildDailySalesPrintData({
      bills: [
        bill({ invoiceNumber: "120826-0011", saleDate: "2026-07-13" }),
        bill({ id: "bill-2", invoiceNumber: "080826-0001", saleDate: "2026-07-14" }),
      ],
      dateFrom: "2026-07-13",
      dateTo: "2026-07-14",
      labels,
      user,
    });

    const ops = buildDailySalesReportOps(data);
    const firstDateTotalIndex = ops.findIndex((op) => op.left === "dateTotal");
    const secondDateHeaderIndex = ops.findIndex((op) => op.left === "14/07/2026");

    // เส้นคั่นตามด้วยบรรทัดว่าง (ไม่ใช่เส้นคั่นซ้อน) ให้วันที่ถัดไปหายใจ
    expect(ops[firstDateTotalIndex + 1]).toEqual({ type: "line" });
    expect(ops[firstDateTotalIndex + 2]).toMatchObject({ type: "blank", n: 1 });
    expect(secondDateHeaderIndex).toBe(firstDateTotalIndex + 3);
  });

  it("prints the exact same bill row and item-count text as the window.open HTML, so both outputs match", () => {
    const data = buildDailySalesPrintData({
      bills: [bill({ invoiceNumber: "080826-0002", tableName: "12", qtyTotal: 52, lineTotal: 9260636 })],
      dateFrom: "2026-07-13",
      dateTo: "2026-07-13",
      labels,
      user,
    });

    const ops = buildDailySalesReportOps(data);
    const html = renderDailySalesPrintHtml(data);
    const invoiceIndex = ops.findIndex((op) => op.left?.includes("080826-0002"));

    expect(ops[invoiceIndex]?.left).toBe("12 · 080826-0002");
    expect(html).toContain("<span>12 · 080826-0002</span><span>9,260,636</span>");
    expect(ops[invoiceIndex]?.right).toBe("9,260,636");
    expect(ops[invoiceIndex + 1]?.text).toBe("52 items");
    expect(html).toContain('<p class="sub">52 items</p>');
  });
});
