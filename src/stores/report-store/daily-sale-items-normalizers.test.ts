import { describe, expect, it } from "vitest";
import { normalizeDailySaleItemsResponse } from "@/stores/report-store/daily-sale-items-normalizers";

describe("normalizeDailySaleItemsResponse", () => {
  it("maps report totals, bill summaries, nested items, and pagination", () => {
    const normalized = normalizeDailySaleItemsResponse(
      {
        page: 1,
        limit: 20,
        total: 25,
        totalPages: 2,
        report_total: {
          bills_count: 2,
          items_count: 3,
          qty_total: 5,
          total: 190000
        },
        data: [
          {
            order_uuid: "order-1",
            order_invoice: "INV-001",
            sale_date: "2026-06-01 10:00:00",
            table_name: "A1",
            payment_method_name: "Cash",
            bill_status: "active",
            summary: {
              amount: 180000,
              debt_amount: 0,
              discount_total: 10000,
              items_count: 2,
              qty_total: 3,
              receive_cash: 190000,
              receive_transfer: 0,
              service_charge: 10000,
              total: 190000,
              topping_total: 5000,
              vat: 5000
            },
            items: [
              {
                order_item_uuid: "item-1",
                product_name: "Noodle",
                qty: 2,
                sale_price: 50000,
                amount: 100000,
                total: 105000
              },
              {
                order_item_uuid: "item-2",
                product_name: "Tea",
                qty: 1,
                sale_price: 80000,
                amount: 80000,
                total: 85000
              }
            ]
          }
        ]
      },
      { limit: 20, page: 1 }
    );

    expect(normalized.reportTotal.total).toBe(190000);
    expect(normalized.pagination).toEqual({
      limit: 20,
      page: 1,
      total: 25,
      totalPages: 2
    });
    expect(normalized.bills).toHaveLength(1);
    expect(normalized.bills[0]).toMatchObject({
      amountTotal: 180000,
      invoiceNumber: "INV-001",
      itemCount: 2,
      lineTotal: 190000,
      receiveCashAmount: 190000,
      serviceChargeAmount: 10000,
      vatAmount: 5000
    });
    expect(normalized.rows).toHaveLength(2);
    expect(normalized.rows[0]).toMatchObject({
      __report_bill_id: "order-1",
      order_invoice: "INV-001",
      order_uuid: "order-1",
      payment_method_name: "Cash"
    });
  });
});
