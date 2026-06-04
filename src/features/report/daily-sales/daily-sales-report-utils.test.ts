import { describe, expect, it } from "vitest";
import type { DailySalesBillGroup } from "@/stores/report-store";
import { reportColumns, summaryConfigs } from "./daily-sales-report-columns";
import {
  dateTotalsFromGroups,
  exportSummaryRows,
  exportTableRows,
  reportFileBaseName,
  selectedDetailBillGroups,
} from "./daily-sales-report-export-utils";
import {
  detailPaginationBasis,
  firstNumber,
  formatDate,
  isCancelledRow,
  readValue,
  reportImageColor,
  reportImageSrc,
  reportRecordId,
  reportTotalFromBillGroups,
  reportTotalFromRows,
  statusClass,
  summaryCardValue,
  textValue,
} from "./daily-sales-report-utils";
import type { ReportFilters } from "./daily-sales-report-types";

const t = (key: string) => key;

function billGroup(
  overrides: Partial<DailySalesBillGroup> = {},
): DailySalesBillGroup {
  return {
    amountTotal: 100_000,
    baseTotal: 90_000,
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
});

describe("daily sales report totals and selection", () => {
  it("calculates summary and detail totals from rows", () => {
    const summaryTotal = reportTotalFromRows(
      [
        { net_total: 100, order_total: 120, receive_cash: 100 },
        { net_total: 50, order_total: 50, status: "cancelled" },
      ],
      "summary",
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
  it("builds summary/export table rows and filenames", () => {
    const filters: ReportFilters = {
      branchUuid: "branch-1",
      dateFrom: "2026-05-01",
      dateTo: "2026-05-29",
      limit: 20,
      orderBy: "DESC",
      paymentMethod: "all",
      typePage: "summary",
    };
    const cards = summaryConfigs(t, "summary");
    const columns = reportColumns(t, "summary");
    const reportTotal = { bills_count: 2, net_total: 150_000 };

    expect(reportFileBaseName(filters)).toBe(
      "daily-sales-summary-2026-05-01-to-2026-05-29",
    );
    expect(summaryCardValue([], reportTotal, ["net_total"])).toBe(150_000);
    expect(
      exportSummaryRows(cards.slice(0, 1), reportTotal, reportTotal),
    ).toEqual([{ Metric: "report.cards.billsCount", Value: 2 }]);
    expect(
      exportTableRows(
        [{ invoice_no: "INV-1", net_total: 150_000 }],
        columns,
      )[0],
    ).toMatchObject({
      No: 1,
      "report.columns.invoiceNumber": "INV-1",
      "report.columns.netTotal": 150_000,
    });
  });
});
