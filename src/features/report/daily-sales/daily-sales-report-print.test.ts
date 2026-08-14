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

  it("separates each major section with a full-width CSS divider, not a fixed-length dash string", () => {
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
    expect(html).not.toContain("---------------------");
  });

  it("shows the table number (not quantity) on the main invoice row, as one two-column row", () => {
    const data = buildDailySalesPrintData({
      bills: [bill({ invoiceNumber: "120826-0011", tableName: "4", lineTotal: 150000 })],
      dateFrom: "2026-07-13",
      dateTo: "2026-07-13",
      labels,
      user,
    });
    const html = renderDailySalesPrintHtml(data);

    expect(html).toContain("120826-0011 (table 4)");
    expect(html).toContain("150,000");
  });

  it("prints the item count on an indented line below the main invoice row", () => {
    const data = buildDailySalesPrintData({
      bills: [bill({ invoiceNumber: "120826-0011", qtyTotal: 5 })],
      dateFrom: "2026-07-13",
      dateTo: "2026-07-13",
      labels,
      user,
    });
    const html = renderDailySalesPrintHtml(data);

    expect(html).toContain('class="invoice-items"');
    expect(html).toContain("5 items");
    expect(html.indexOf("120826-0011 (table")).toBeLessThan(html.indexOf("5 items"));
  });

  it("prints an Invoice No. / Amount header row before the invoice rows in every date group", () => {
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
    expect(headerOccurrences).toBe(2);
    expect(html.indexOf("invoiceNumber</span><span>totalAmount")).toBeLessThan(html.indexOf("120826-0011"));
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

  it("never emits a line op — it prints as a run of underscores on the real printer — uses dashed text instead", () => {
    const data = buildDailySalesPrintData({
      bills: [bill()],
      dateFrom: "2026-07-13",
      dateTo: "2026-07-13",
      labels,
      user,
    });

    const ops = buildDailySalesReportOps(data);
    const dashOps = ops.filter((op) => op.type === "text" && op.text === "---------------------");

    expect(ops.some((op) => op.type === "line")).toBe(false);
    expect(dashOps.length).toBeGreaterThanOrEqual(3);
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

  it("shows the table number on the main invoice row, and the item count on a separate indented text line", () => {
    const data = buildDailySalesPrintData({
      bills: [bill({ invoiceNumber: "120826-0011", tableName: "4", qtyTotal: 5, lineTotal: 150000 })],
      dateFrom: "2026-07-13",
      dateTo: "2026-07-13",
      labels,
      user,
    });

    const ops = buildDailySalesReportOps(data);
    const invoiceOp = ops.find((op) => op.left === "120826-0011 (table 4)");
    const invoiceIndex = ops.indexOf(invoiceOp!);
    const itemsOp = ops[invoiceIndex + 1];

    expect(invoiceOp?.right).toBe("150,000");
    expect(itemsOp?.type).toBe("text");
    expect(itemsOp?.text).toBe("  5 items");
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
    const lastInvoiceIndex = ops.findIndex((op) => op.left === "120826-0010 (table A1)");

    expect(dateTotalOp?.right).toBe("150,000");
    expect(ops.indexOf(dateTotalOp!)).toBeGreaterThan(lastInvoiceIndex);
  });

  it("underlines both the date header and the Invoice No. / Amount table, matching window.open's two borders (.date-group h2 and .invoice-table-header)", () => {
    const data = buildDailySalesPrintData({
      bills: [bill({ invoiceNumber: "120826-0011", saleDate: "2026-07-13" })],
      dateFrom: "2026-07-01",
      dateTo: "2026-07-20",
      labels,
      user,
    });

    const ops = buildDailySalesReportOps(data);
    const isDashDivider = (op: (typeof ops)[number]) => op.type === "text" && op.text === "---------------------";
    const dateIndex = ops.findIndex((op) => op.text === "saleDate: 2026-07-13");
    const dividerBeforeHeaderIndex = dateIndex + 1;
    const headerIndex = ops.findIndex((op) => op.left === "invoiceNumber" && op.right === "totalAmount");
    const dividerAfterHeaderIndex = headerIndex + 1;
    const invoiceIndex = ops.findIndex((op) => op.left === "120826-0011 (table A1)");

    expect(dateIndex).toBeGreaterThanOrEqual(0);
    expect(isDashDivider(ops[dividerBeforeHeaderIndex])).toBe(true);
    expect(headerIndex).toBe(dividerBeforeHeaderIndex + 1);
    expect(isDashDivider(ops[dividerAfterHeaderIndex])).toBe(true);
    expect(invoiceIndex).toBe(dividerAfterHeaderIndex + 1);
  });

  it("puts the breathing room between separate date groups instead, so each group's header stays with its own table", () => {
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

    expect(ops[secondDateHeaderIndex - 1]?.type).toBe("blank");
    expect(secondDateHeaderIndex - 1).toBeGreaterThan(firstDateTotalIndex);
  });

  it("prints the exact same invoice left-label text as the window.open HTML, so both outputs match", () => {
    const data = buildDailySalesPrintData({
      bills: [bill({ invoiceNumber: "080826-0002", tableName: "12", qtyTotal: 52, lineTotal: 9260636 })],
      dateFrom: "2026-07-13",
      dateTo: "2026-07-13",
      labels,
      user,
    });

    const ops = buildDailySalesReportOps(data);
    const html = renderDailySalesPrintHtml(data);
    const invoiceOp = ops.find((op) => op.left?.startsWith("080826-0002"));

    expect(invoiceOp?.left).toBe("080826-0002 (table 12)");
    expect(html).toContain("080826-0002 (table 12)");
    expect(invoiceOp?.right).toBe("9,260,636");
    expect(html).toContain("9,260,636");
    expect(html).toContain("52 items");
  });

  it("draws a divider both before and after the Invoice No. / Amount header in every date group, in both outputs (auto print and window.open must always match)", () => {
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

    // window.open: h2 (date) and .invoice-table-header (Invoice No. / Amount row) each carry their own
    // border-bottom — one date-group section per sale date, so 2 dividers per date group.
    const dateGroupCount = data.dateGroups.length;
    expect(html.match(/<h2>saleDate:/g)?.length).toBe(dateGroupCount);
    expect(html.match(/class="total-row invoice-table-header"/g)?.length).toBe(dateGroupCount);

    // auto print: one dash-divider before and one right after each date group's header row —
    // same 2-dividers-per-date-group count as window.open's 2 borders.
    const headerIndexes = ops
      .map((op, index) => (op.left === "invoiceNumber" && op.right === "totalAmount" ? index : -1))
      .filter((index) => index >= 0);
    expect(headerIndexes).toHaveLength(dateGroupCount);
    headerIndexes.forEach((headerIndex) => {
      expect(ops[headerIndex - 1]?.type).toBe("text");
      expect(ops[headerIndex - 1]?.text).toBe("---------------------");
      expect(ops[headerIndex + 1]?.type).toBe("text");
      expect(ops[headerIndex + 1]?.text).toBe("---------------------");
    });
  });
});
