import { describe, expect, it } from "vitest";
import type { DailySalesBillGroup } from "@/stores/report-store";
import {
  cardSummaryConfigs,
  reportColumns,
  reportDetailItemColumns,
  summaryConfigs,
} from "./daily-sales-report-columns";
import {
  dateTotalsFromGroups,
  exportSummaryRows,
  exportTableRows,
  reportFileBaseName,
  selectedDetailBillGroups,
} from "./daily-sales-report-export-utils";
import {
  billSummaryMetrics,
  billPaymentMethodParam,
  detailPaginationBasis,
  detailPaymentMethodParam,
  firstNumber,
  formatDate,
  hasDisplayValue,
  isCancelledRow,
  isPaymentAttentionRow,
  readValue,
  reportImageColor,
  reportImageSrc,
  reportRecordId,
  reportTotalFromBillGroups,
  reportTotalFromRows,
  statusClass,
  summaryCardValue,
  textValue,
  toppingLines,
} from "./daily-sales-report-utils";
import type { ReportFilters } from "./daily-sales-report-types";

const t = (key: string) => key;

function billGroup(
  overrides: Partial<DailySalesBillGroup> = {},
): DailySalesBillGroup {
  return {
    amountTotal: 100_000,
    baseTotal: 90_000,
    branchName: "Branch",
    cancelled: false,
    cashierName: "Cashier",
    changeAmount: 1_000,
    debtAmount: 0,
    discountBillAmount: 5_000,
    id: "bill-1",
    invoiceNumber: "INV-1",
    itemCount: 2,
    itemDiscountAmount: 2_000,
    items: [
      {
        __report_record_id: "line-1",
        line_total: 60_000,
        product_name: "Noodle",
        qty: 2,
        topping_total: 5_000,
      },
      {
        __report_record_id: "line-2",
        line_total: 40_000,
        product_name: "Tea",
        qty: 1,
      },
    ],
    lineTotal: 100_000,
    paymentType: "cash",
    qtyTotal: 3,
    receiveCashAmount: 101_000,
    receiveTransferAmount: 0,
    saleDate: "2026-05-29",
    serviceChargeAmount: 0,
    status: "paid",
    tableName: "A1",
    toppingTotal: 5_000,
    vatAmount: 0,
    ...overrides,
  };
}

describe("daily sales report basic helpers", () => {
  it("keeps the all payment filter because the API expects it", () => {
    expect(billPaymentMethodParam("All")).toBe("All");
    expect(billPaymentMethodParam("1")).toBe("1");
    expect(detailPaymentMethodParam("All")).toBe("all");
    expect(detailPaymentMethodParam("1")).toBe("cash");
    expect(detailPaymentMethodParam("2")).toBe("transfer");
    expect(detailPaymentMethodParam("4")).toBe("debt");
  });

  it("uses only backend summary fields for detailed report summary cards", () => {
    const cards = summaryConfigs(t, "detail");

    expect(cards.map((card) => card.keys)).toEqual([
      ["bill_count"],
      ["total_qty"],
      ["amount"],
      ["discount_item"],
      ["discount_bill"],
      ["sum_discount"],
      ["sum_servicecharge"],
      ["sum_vate"],
      ["sum_total"],
    ]);

    const summary = {
      amount: 29_173_726,
      bill_count: 64,
      discount_bill: 1_176_056,
      discount_item: 421_460,
      sum_discount: 1_597_516,
      sum_servicecharge: 2_131_726,
      sum_total: 32_779_324,
      sum_vate: 3_071_389,
      total_qty: 433,
    };

    expect(
      cards.map((card) => summaryCardValue(summary, summary, card.keys)),
    ).toEqual([
      64,
      433,
      29_173_726,
      421_460,
      1_176_056,
      1_597_516,
      2_131_726,
      3_071_389,
      32_779_324,
    ]);
  });

  it("keeps card summary configs tied to the bill report backend summary", () => {
    const cards = cardSummaryConfigs(t);

    expect(cards.map((card) => card.keys)).toEqual([
      ["bill_count"],
      ["total_qty"],
      ["amount"],
      ["discount_bill"],
      ["sum_discount"],
      ["after_discount"],
      ["sum_servicecharge"],
      ["sum_vate"],
      ["sum_total"],
    ]);
  });

  it("reads fallback values and formats dates safely", () => {
    const row = { invoice_no: "INV-9", total: "12000" };

    expect(readValue(row, ["invoice_number", "invoice_no"])).toBe("INV-9");
    expect(textValue(undefined, "fallback")).toBe("fallback");
    expect(firstNumber(undefined, "bad", "12000")).toBe(12_000);
    expect(formatDate("2026-05-29")).toBe("2026-05-29");
  });

  it("detects cancelled rows and image color/source", () => {
    expect(isCancelledRow({ status_name: "Cancelled" })).toBe(true);
    expect(statusClass({ status_name: "Cancelled" }, "paid")).toContain(
      "destructive",
    );
    expect(statusClass({}, "Cancelled bill")).toContain("bg-destructive");
    expect(statusClass({}, "ຊຳລະແລ້ວ")).toContain("text-primary");
    expect(statusClass({}, "ໜີ້ຄ້າງ")).toContain("amber");
    expect(statusClass({}, "Pending payment")).toContain("sky");
    expect(isPaymentAttentionRow({ debt_amount: 12000 })).toBe(true);
    expect(isPaymentAttentionRow({ payment_method: "debt" })).toBe(true);
    expect(
      isPaymentAttentionRow({
        payment_method: "\u0edc\u0eb5\u0ec9\u0e84\u0ec9\u0eb2\u0e87",
      }),
    ).toBe(true);
    expect(isPaymentAttentionRow({ status: "Pending payment" })).toBe(true);
    expect(isPaymentAttentionRow({ status: "paid", debt_amount: 0 })).toBe(
      false,
    );
    expect(
      isPaymentAttentionRow({ status_name: "Cancelled", debt_amount: 12000 }),
    ).toBe(false);
    expect(reportImageColor({ prod_image: "color:#10b981" })).toBe("#10b981");
    expect(reportImageSrc({ prod_image: "noodle.png" })).toBe(
      "/uploaded/products/noodle.png",
    );
  });

  it("builds stable record ids for orders and line items", () => {
    expect(reportRecordId({ order_uuid: "order-1" })).toBe("order:order-1");
    expect(
      reportRecordId({ order_it_uuid: "item-1", product_name: "Tea" }),
    ).toBe("item:item-1");
    expect(
      reportRecordId({ invoice_no: "INV", product_name: "Tea", qty: 1 }),
    ).toContain("line:INV:Tea");
  });

  it("detects display values for hide-empty logic", () => {
    expect(hasDisplayValue("active")).toBe(true);
    expect(hasDisplayValue("paid")).toBe(true);
    expect(hasDisplayValue("")).toBe(false);
    expect(hasDisplayValue(null)).toBe(false);
    expect(hasDisplayValue(undefined)).toBe(false);
    expect(hasDisplayValue("  ")).toBe(false);
    expect(hasDisplayValue("-")).toBe(false);
  });

  it("formats topping lines from the sale report list API shape", () => {
    expect(
      toppingLines({
        toppings: [
          {
            topping_name: "Egg",
            topping_price: 5000,
            topping_qty: 1,
            topping_total: 5000,
          },
        ],
      }),
    ).toEqual(["1 x Egg - 5.000 ₭"]);
  });
});

describe("daily sales report totals and selection", () => {
  it("calculates summary and detail totals from rows", () => {
    const summaryTotal = reportTotalFromRows(
      [
        { net_total: 100, order_total: 120, receive_cash: 100 },
        { net_total: 50, order_total: 50, status: "cancelled" },
      ],
      "bill",
    );
    const detailTotal = reportTotalFromRows(
      [
        { line_total: 100, qty: 2, topping_total: 10 },
        { line_total: 50, qty: 1, status_name: "cancelled" },
      ],
      "detail",
    );

    expect(summaryTotal.net_total).toBe(150);
    expect(summaryTotal.cancelled_count).toBe(1);
    expect(detailTotal.lines_count).toBe(2);
    expect(detailTotal.qty_total).toBe(3);
    expect(detailTotal.topping_total).toBe(10);
  });

  it("detects status data presence for hide-empty logic", () => {
    const itemsWithStatus = [
      { status_name: "paid", product_name: "Noodle" },
      { status: "active", product_name: "Tea" },
    ];
    const itemsWithoutStatus = [
      { product_name: "Noodle" },
      { product_name: "Tea" },
    ];
    const itemsWithEmptyStatus = [
      { status_name: "", product_name: "Noodle" },
      { status: "-", product_name: "Tea" },
    ];

    expect(
      itemsWithStatus.some((item) =>
        hasDisplayValue(
          readValue(item, [
            "status_name",
            "status_text",
            "status",
            "status_code",
            "order_status_text",
            "order_it_status_text",
          ]),
        ),
      ),
    ).toBe(true);

    expect(
      itemsWithoutStatus.some((item) =>
        hasDisplayValue(
          readValue(item, [
            "status_name",
            "status_text",
            "status",
            "status_code",
            "order_status_text",
            "order_it_status_text",
          ]),
        ),
      ),
    ).toBe(false);

    expect(
      itemsWithEmptyStatus.some((item) =>
        hasDisplayValue(
          readValue(item, [
            "status_name",
            "status_text",
            "status",
            "status_code",
            "order_status_text",
            "order_it_status_text",
          ]),
        ),
      ),
    ).toBe(false);
  });

  it("calculates bill group totals and date totals", () => {
    const groups = [
      billGroup(),
      billGroup({
        id: "bill-2",
        invoiceNumber: "INV-2",
        saleDate: "2026-05-29",
      }),
    ];

    expect(reportTotalFromBillGroups(groups).bills_count).toBe(2);
    expect(reportTotalFromBillGroups(groups).total).toBe(200_000);
    expect(dateTotalsFromGroups(groups)).toMatchObject([
      { bills_count: 2, total: 200_000 },
    ]);
  });

  it("selects partial detail bill groups by line id", () => {
    const selected = selectedDetailBillGroups(
      [billGroup()],
      new Set(["line-1"]),
    );

    expect(selected).toHaveLength(1);
    expect(selected[0]?.items).toHaveLength(1);
    expect(selected[0]?.items[0]?.product_name).toBe("Noodle");
  });

  it("chooses pagination basis from report metrics", () => {
    expect(
      detailPaginationBasis(4, { lines_count: 4, bills_count: 2 }, {}),
    ).toBe("lines");
    expect(
      detailPaginationBasis(2, { lines_count: 4, bills_count: 2 }, {}),
    ).toBe("bills");
  });
});

describe("daily sales report export helpers", () => {
  it("orders detail item columns to match the detail API shape", () => {
    expect(reportDetailItemColumns(t).map((column) => column.header)).toEqual([
      "report.columns.productImage",
      "report.columns.productName",
      "report.columns.salePrice",
      "report.columns.toppingTotal",
      "report.columns.amount",
      "report.columns.quantity",
      "report.columns.itemDiscount",
      "report.columns.lineTotal",
    ]);
  });

  it("uses sale_price for detail item price before amount", () => {
    const itemColumns = reportDetailItemColumns(t);
    const salePriceColumn = itemColumns.find(
      (column) => column.header === "report.columns.salePrice",
    );
    const amountColumn = itemColumns.find(
      (column) => column.header === "report.columns.amount",
    );

    expect(salePriceColumn).toBeDefined();
    expect(amountColumn).toBeDefined();
    expect(
      exportTableRows(
        [{ amount: 65_000, product_name: "Burger", sale_price: 60_000 }],
        [salePriceColumn, amountColumn].filter(
          (column): column is NonNullable<typeof column> => Boolean(column),
        ),
      )[0],
    ).toMatchObject({
      "report.columns.amount": 65_000,
      "report.columns.salePrice": 60_000,
    });
  });

  it("uses only API summary fields for expanded bill metrics", () => {
    expect(
      billSummaryMetrics(t, billGroup({ serviceChargeAmount: 14_000 })).map(
        (metric) => metric.label,
      ),
    ).toEqual([
      "report.cards.orderTotal",
      "report.cards.toppingTotal",
      "report.cards.discountAmount",
      "report.cards.vatAmount",
      "report.cards.netTotal",
    ]);
  });

  it("builds summary/export table rows and filenames", () => {
    const filters: ReportFilters = {
      branchUuid: "branch-1",
      dateFrom: "2026-05-01",
      dateTo: "2026-05-29",
      limit: 20,
      orderBy: "DESC",
      paymentMethod: "All",
      search: "",
      typePage: "bill",
    };
    const cards = summaryConfigs(t, "bill");
    const columns = reportColumns(t, "bill");
    const reportTotal = { bill_count: 2, sum_total: 150_000 };

    expect(reportFileBaseName(filters)).toBe(
      "daily-sales-bill-2026-05-01-to-2026-05-29",
    );
    expect(summaryCardValue([], reportTotal, ["sum_total"])).toBe(150_000);
    expect(
      exportSummaryRows(cards.slice(0, 1), reportTotal, reportTotal),
    ).toEqual([{ Metric: "report.cards.billsCount", Value: 2 }]);
    expect(
      exportTableRows(
        [{ order_invoice: "INV-1", sum_total: 150_000 }],
        columns,
      )[0],
    ).toMatchObject({
      No: 1,
      "report.columns.invoiceNumber": "INV-1",
      "report.columns.netTotal": 150_000,
    });
  });
});
