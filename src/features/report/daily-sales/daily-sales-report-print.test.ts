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
    expect(html).toContain("saleDate: 2026-07-13");
    expect(html).toContain("&lt;script&gt;0011&lt;/script&gt;");
    expect(html).toContain('class="total-row grand-total"');
    expect(html).toContain(`href="${WINDOW_OPEN_FONT_STYLESHEET_HREF}"`);
    expect(html).toContain(`body class="${WINDOW_OPEN_FONT_CLASS_NAME}"`);
    expect(html).toContain("document.fonts?.ready");
    expect(html.indexOf("grand-total")).toBeLessThan(html.indexOf("revenueSummary"));
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
    expect(html).toContain(".divider { border-top: 1px solid #111; }");
  });

  it("shows the item count (not table) on the main invoice row, as one two-column row", () => {
    const data = buildDailySalesPrintData({
      bills: [bill({ invoiceNumber: "120826-0011", qtyTotal: 5, lineTotal: 150000 })],
      dateFrom: "2026-07-13",
      dateTo: "2026-07-13",
      labels,
      user,
    });
    const html = renderDailySalesPrintHtml(data);

    expect(html).toContain("1./ 120826-0011 (5 items)");
    expect(html).toContain("150,000");
  });

  it("prints the table name on an indented line below the main invoice row", () => {
    const data = buildDailySalesPrintData({
      bills: [bill({ invoiceNumber: "120826-0011", tableName: "4" })],
      dateFrom: "2026-07-13",
      dateTo: "2026-07-13",
      labels,
      user,
    });
    const html = renderDailySalesPrintHtml(data);

    expect(html).toContain('class="invoice-items"');
    expect(html).toContain("table 4");
    expect(html.indexOf("1./ 120826-0011 (")).toBeLessThan(html.indexOf("table 4"));
  });

  it("prints the Invoice No. / Amount header row exactly once, above every date group instead of repeating it per date", () => {
    const data = buildDailySalesPrintData({
      bills: [
        bill(),
        bill({ id: "bill-2", invoiceNumber: "080826-0001", saleDate: "2026-07-14" }),
      ],
      dateFrom: "2026-07-13",
      dateTo: "2026-07-14",
      labels,
      user,
    });
    const html = renderDailySalesPrintHtml(data);

    const headerOccurrences = html.split('<span>invoiceNumber</span><span>totalAmount</span>').length - 1;
    const headerIndex = html.indexOf("invoiceNumber</span><span>totalAmount");
    expect(headerOccurrences).toBe(1);
    expect(headerIndex).toBeLessThan(html.indexOf("saleDate: 2026-07-13"));
    expect(headerIndex).toBeLessThan(html.indexOf("120826-0011"));
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

    const firstDateTotalIndex = html.indexOf('<span>dateTotal</span><span>100,000</span>');
    const secondDateHeaderIndex = html.indexOf("<h2>saleDate: 2026-07-14");
    const dividerIndex = html.indexOf('<div class="divider divider-section"></div>', firstDateTotalIndex);

    expect(firstDateTotalIndex).toBeGreaterThanOrEqual(0);
    expect(dividerIndex).toBeGreaterThan(firstDateTotalIndex);
    expect(dividerIndex).toBeLessThan(secondDateHeaderIndex);
    // เว้นระยะเพิ่มหลังเส้นคั่นนี้ (margin-bottom) แทนการเพิ่มเส้นคั่นซ้อน — ให้วันที่ถัดไปหายใจ
    expect(html).toContain(".divider-section { margin-bottom: 2mm; }");
  });

  it("prints a total-for-the-date row after each date group's invoices", () => {
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

    expect(html).toContain('class="total-row strong"><span>dateTotal</span><span>150,000</span>');
    expect(html.indexOf("120826-0010")).toBeLessThan(html.indexOf("dateTotal"));
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

  it("sizes every text/lr op 4pt larger than the previous baseline", () => {
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
    expect(storeOp?.size).toBe(28);
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

  it("prints bill count as a plain number, not money-formatted, and no longer prints a total item count", () => {
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
    expect(totalQuantityOp).toBeUndefined();
  });

  it('bolds the bill-count row, matching window.open\'s class="total-row strong" (auto print and window.open must always match)', () => {
    const data = buildDailySalesPrintData({
      bills: [bill()],
      dateFrom: "2026-07-13",
      dateTo: "2026-07-13",
      labels,
      user,
    });

    const ops = buildDailySalesReportOps(data);
    const billCountOp = ops.find((op) => op.left === "billCount");

    expect(billCountOp?.bold).toBe(true);
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

  it("shows the item count on the main invoice row, and the table name on a separate indented text line", () => {
    const data = buildDailySalesPrintData({
      bills: [bill({ invoiceNumber: "120826-0011", tableName: "4", qtyTotal: 5, lineTotal: 150000 })],
      dateFrom: "2026-07-13",
      dateTo: "2026-07-13",
      labels,
      user,
    });

    const ops = buildDailySalesReportOps(data);
    const invoiceOp = ops.find((op) => op.left === "1./ 120826-0011 (5 items)");
    const invoiceIndex = ops.indexOf(invoiceOp!);
    const tableOp = ops[invoiceIndex + 1];

    expect(invoiceOp?.right).toBe("150,000");
    expect(tableOp?.type).toBe("text");
    expect(tableOp?.text).toBe("  table 4");
  });

  it("numbers invoices starting at 1 within each date, resetting for the next date, in both outputs", () => {
    const data = buildDailySalesPrintData({
      bills: [
        bill({ invoiceNumber: "120826-0011", saleDate: "2026-07-13" }),
        bill({ id: "bill-2", invoiceNumber: "120826-0010", saleDate: "2026-07-13" }),
        bill({ id: "bill-3", invoiceNumber: "080826-0001", saleDate: "2026-07-14" }),
      ],
      dateFrom: "2026-07-13",
      dateTo: "2026-07-14",
      labels,
      user,
    });

    const ops = buildDailySalesReportOps(data);
    const html = renderDailySalesPrintHtml(data);

    expect(ops.find((op) => op.left === "1./ 120826-0011 (2 items)")).toBeDefined();
    expect(ops.find((op) => op.left === "2./ 120826-0010 (2 items)")).toBeDefined();
    expect(ops.find((op) => op.left === "1./ 080826-0001 (2 items)")).toBeDefined();
    expect(html).toContain("1./ 120826-0011 (2 items)");
    expect(html).toContain("2./ 120826-0010 (2 items)");
    expect(html).toContain("1./ 080826-0001 (2 items)");
  });

  it("prints a total-for-the-date lr row right after each date group's invoices", () => {
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
    const dateTotalOp = ops.find((op) => op.left === "dateTotal");
    const lastInvoiceIndex = ops.findIndex((op) => op.left === "2./ 120826-0010 (2 items)");

    expect(dateTotalOp?.right).toBe("150,000");
    expect(ops.indexOf(dateTotalOp!)).toBeGreaterThan(lastInvoiceIndex);
  });

  it("draws a divider right before the date-total row, matching window.open's divider before that row (auto print and window.open must always match)", () => {
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

    expect(ops[dateTotalIndex - 1]).toEqual({ type: "line" });
  });

  it("orders the header row, then the date line, then the first invoice row — each pair separated by a divider", () => {
    const data = buildDailySalesPrintData({
      bills: [bill({ invoiceNumber: "120826-0011", saleDate: "2026-07-13" })],
      dateFrom: "2026-07-01",
      dateTo: "2026-07-20",
      labels,
      user,
    });

    const ops = buildDailySalesReportOps(data);
    const headerIndex = ops.findIndex((op) => op.left === "invoiceNumber" && op.right === "totalAmount");
    const dividerAfterHeaderIndex = headerIndex + 1;
    const dateIndex = ops.findIndex((op) => op.text === "saleDate: 2026-07-13");
    const dividerAfterDateIndex = dateIndex + 1;
    const invoiceIndex = ops.findIndex((op) => op.left === "1./ 120826-0011 (2 items)");

    expect(headerIndex).toBeGreaterThanOrEqual(0);
    expect(ops[dividerAfterHeaderIndex]?.type).toBe("line");
    expect(dateIndex).toBe(dividerAfterHeaderIndex + 1);
    expect(ops[dividerAfterDateIndex]?.type).toBe("line");
    expect(invoiceIndex).toBe(dividerAfterDateIndex + 1);
  });

  it('does not bold the Invoice No. / Amount header row, matching window.open\'s unstyled .invoice-table-header (auto print and window.open must always match)', () => {
    const data = buildDailySalesPrintData({
      bills: [bill({ invoiceNumber: "120826-0011", saleDate: "2026-07-13" })],
      dateFrom: "2026-07-13",
      dateTo: "2026-07-13",
      labels,
      user,
    });

    const ops = buildDailySalesReportOps(data);
    const headerOp = ops.find((op) => op.left === "invoiceNumber" && op.right === "totalAmount");

    expect(headerOp?.bold).toBe(false);
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
    const secondDateHeaderIndex = ops.findIndex((op) => op.text === "saleDate: 2026-07-14");

    // เส้นคั่นตามด้วยบรรทัดว่าง (ไม่ใช่เส้นคั่นซ้อน) ให้วันที่ถัดไปหายใจ ตรงกับฝั่ง window.open
    expect(ops[firstDateTotalIndex + 1]).toEqual({ type: "line" });
    expect(ops[firstDateTotalIndex + 2]).toMatchObject({ type: "blank", n: 1 });
    expect(secondDateHeaderIndex).toBe(firstDateTotalIndex + 3);
  });

  it("prints the exact same invoice left-label and table sub-line text as the window.open HTML, so both outputs match", () => {
    const data = buildDailySalesPrintData({
      bills: [bill({ invoiceNumber: "080826-0002", tableName: "12", qtyTotal: 52, lineTotal: 9260636 })],
      dateFrom: "2026-07-13",
      dateTo: "2026-07-13",
      labels,
      user,
    });

    const ops = buildDailySalesReportOps(data);
    const html = renderDailySalesPrintHtml(data);
    const invoiceOp = ops.find((op) => op.left?.includes("080826-0002"));

    expect(invoiceOp?.left).toBe("1./ 080826-0002 (52 items)");
    expect(html).toContain("1./ 080826-0002 (52 items)");
    expect(invoiceOp?.right).toBe("9,260,636");
    expect(html).toContain("9,260,636");
    expect(html).toContain("table 12");
  });

  it("draws the Invoice No. / Amount header exactly once, with a divider before and after it, in both outputs (auto print and window.open must always match)", () => {
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
    const html = renderDailySalesPrintHtml(data);

    // window.open: the header row now appears once, above every date group, with its own border-bottom.
    expect(html.match(/class="total-row invoice-table-header"/g)?.length).toBe(1);
    expect(html.match(/<h2>saleDate:/g)?.length).toBe(data.dateGroups.length);

    // auto print: the header lr op appears once, with a divider both before and after it.
    const headerIndexes = ops
      .map((op, index) => (op.left === "invoiceNumber" && op.right === "totalAmount" ? index : -1))
      .filter((index) => index >= 0);
    expect(headerIndexes).toHaveLength(1);
    const headerIndex = headerIndexes[0];
    expect(ops[headerIndex - 1]?.type).toBe("line");
    expect(ops[headerIndex + 1]?.type).toBe("line");
  });
});
