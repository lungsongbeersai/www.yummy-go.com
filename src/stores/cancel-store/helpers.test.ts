import { describe, expect, it } from "vitest";
import { normalizeCancelableBillsResponse, normalizeCancelledBillsResponse } from "@/stores/cancel-store/helpers";

describe("cancel store helpers", () => {
  it("normalizes cancelable bill response metadata", () => {
    const normalized = normalizeCancelableBillsResponse(
      {
        status: "success",
        message: "ok",
        data: [{ order_uuid: "o1" }],
        date_options: [{ value: "today" }],
        selected_bill: { order_uuid: "o1" },
        total: 8
      },
      { branch_uuid_fk: "b1", date_select: "today", limit: 4, orderBy: "DESC", page: 1 }
    );

    expect(normalized.bills).toHaveLength(1);
    expect(normalized.dateOptions).toEqual([{ value: "today" }]);
    expect(normalized.selectedBill).toEqual({ order_uuid: "o1" });
    expect(normalized.totalPages).toBe(2);
  });

  it("normalizes cancelled bill history without dropping cancel and payment fields", () => {
    const normalized = normalizeCancelledBillsResponse(
      {
        status: "success",
        message: "success",
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        start_date: "2026-06-03",
        end_date: "2026-06-03",
        data: [
          {
            order_uuid: "325ba296-67b7-43c3-a006-fa86b02157d2",
            order_invoice: "030626-0001",
            branch_uuid_fk: "9c1390bd-e316-4235-8901-79acfe19f514",
            branch_name: "Branch 1",
            table_uuid_fk: "e50a9efc-92b9-45aa-a806-6ee3e0e138ab",
            table_id: 9,
            table_name_la: "T01",
            order_date: "2026-06-03",
            order_cancelled_at: "2026-06-03 00:00:00",
            order_cancel_reason: "hhh",
            order_qty: "9",
            order_total: "1133000",
            order_discount_amount: "0",
            order_subtotal: "1041500",
            order_service_amount: "72905",
            order_vat_amount: "111441",
            order_grand_total: "1225846",
            order_paid_total: "1225846",
            order_balance: "0",
            status_code: "cancelled",
            status_name: "Cancelled"
          }
        ]
      },
      {
        branch_uuid_fk: "branch-1",
        end_date: "2026-06-03",
        limit: 20,
        orderBy: "DESC",
        page: 1,
        start_date: "2026-06-03"
      }
    );

    expect(normalized.historyBills).toHaveLength(1);
    expect(normalized.historyBills[0]).toMatchObject({
      balance: 0,
      cancelReason: "hhh",
      cancelledAt: "2026-06-03 00:00:00",
      discountAmount: 0,
      grandTotal: 1225846,
      invoice: "030626-0001",
      orderQty: 9,
      orderTotal: 1133000,
      paidTotal: 1225846,
      serviceAmount: 72905,
      statusCode: "cancelled",
      statusName: "Cancelled",
      subtotal: 1041500,
      tableName: "T01",
      vatAmount: 111441
    });
    expect(normalized.historyPage).toBe(1);
    expect(normalized.historyLimit).toBe(20);
    expect(normalized.historyTotal).toBe(1);
    expect(normalized.historyTotalPages).toBe(1);
  });

  it("falls back cancelled bill history pagination for empty responses", () => {
    const normalized = normalizeCancelledBillsResponse(
      {
        status: "success",
        message: "success",
        data: []
      },
      {
        branch_uuid_fk: "branch-1",
        end_date: "2026-06-03",
        limit: 20,
        orderBy: "ASC",
        page: 3,
        start_date: "2026-06-03"
      }
    );

    expect(normalized.historyBills).toEqual([]);
    expect(normalized.historyTotal).toBe(0);
    expect(normalized.historyTotalPages).toBe(3);
  });
});
