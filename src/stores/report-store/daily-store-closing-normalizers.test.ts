import { describe, expect, it } from "vitest";
import { normalizeDailyStoreClosingReportResponse } from "./daily-store-closing-normalizers";

describe("normalizeDailyStoreClosingReportResponse", () => {
  it("normalizes item quantities without inferring group quantities", () => {
    const report = normalizeDailyStoreClosingReportResponse({
      status: "success",
      lang: "la",
      labels: {
        report_name: "Daily report",
        total_qty: "Total quantity",
        discount_amount: "Discount",
        total_amount: "Sales total",
        service_charge: "Service charge",
        vat: "VAT",
        grand_total: "Grand total",
        cash: "Cash",
        transfer: "Transfer",
        credit: "Credit",
        payment_total: "Payment total",
        cancel_bill: "Cancelled bills",
        cancel_amount: "Cancelled amount",
        group_total: "Group total",
        no_group: "No group",
      },
      filters: {
        branch_uuid_fk: "branch-1",
        date: "2026-07-10",
        lang: "la",
      },
      groups: [
        {
          group_name: "Drinks",
          total_qty: 0,
          discount_amount: "500",
          total_amount: "9500",
          items: [
            {
              product_full_name: "Tea",
              unit_price: "5000",
              total_qty: "2",
              discount_amount: "500",
              total_amount: "9500",
              toppings: [
                {
                  topping_name: "Pearls",
                  topping_price: "2500",
                  topping_qty: "2",
                },
              ],
            },
          ],
        },
      ],
      summary: {
        total_qty: "2",
        discount_amount: "500",
        total_amount: "9500",
        sum_servicecharge: "950",
        sum_vate: "700",
        grand_total: "11150",
      },
      payment_summary: {
        cash: "11150",
        transfer: 0,
        credit: 0,
        payment_total: "11150",
      },
      cancel_summary: {
        cancel_bill_count: "1",
        cancel_total_amount: "2000",
      },
    });

    expect(report.filters).toEqual({
      branchUuid: "branch-1",
      date: "2026-07-10",
      lang: "la",
    });
    expect(report.groups[0]).toMatchObject({
      discountAmount: 500,
      name: "Drinks",
      totalAmount: 9500,
      totalQty: 0,
    });
    expect(report.groups[0].items[0]).toMatchObject({
      discountAmount: 500,
      productName: "Tea",
      totalAmount: 9500,
      totalQty: 2,
      unitPrice: 5000,
    });
    expect(report.groups[0].items[0].toppings[0]).toMatchObject({
      name: "Pearls",
      price: 2500,
      qty: 2,
    });
    expect(report.summary).toEqual({
      discountAmount: 500,
      grandTotal: 11150,
      serviceCharge: 950,
      totalAmount: 9500,
      totalQty: 2,
      vat: 700,
    });
    expect(report.paymentSummary.paymentTotal).toBe(11150);
    expect(report.cancelSummary).toEqual({ billCount: 1, totalAmount: 2000 });
  });

  it("returns printable zero-value sections for missing or null data", () => {
    const report = normalizeDailyStoreClosingReportResponse({
      data: {
        cancel_summary: null,
        filters: { date: "2026-07-11" },
        groups: null,
        labels: null,
        order_channels: null,
        payment_summary: null,
        summary: null,
      },
    });

    expect(report.filters.date).toBe("2026-07-11");
    expect(report.groups).toEqual([]);
    expect(report.orderChannels).toEqual([]);
    expect(report.summary.grandTotal).toBe(0);
    expect(report.paymentSummary.paymentTotal).toBe(0);
    expect(report.cancelSummary).toEqual({ billCount: 0, totalAmount: 0 });
    expect(report.labels.reportName).toBe("");
  });

  it("normalizes the order channel sales summary", () => {
    const report = normalizeDailyStoreClosingReportResponse({
      data: {
        order_channels: [
          {
            order_channel: 1,
            order_channel_name: "ນັ່ງກິນຢູ່ຮ້ານ",
            bill_count: 9,
            grand_total: 9572453,
          },
          {
            order_channel: 2,
            order_channel_name: "ສັ່ງກັບບ້ານ",
            bill_count: 0,
            grand_total: 0,
          },
        ],
      },
    });

    expect(report.orderChannels).toEqual([
      { billCount: 9, channel: 1, grandTotal: 9572453, key: "order-channel-1", name: "ນັ່ງກິນຢູ່ຮ້ານ" },
      { billCount: 0, channel: 2, grandTotal: 0, key: "order-channel-2", name: "ສັ່ງກັບບ້ານ" },
    ]);
  });
});
