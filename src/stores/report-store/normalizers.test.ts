import { describe, expect, it } from "vitest";
import { createDailySalesBillGroups, normalizeDailySalesReportResponse } from "@/stores/report-store/normalizers";

describe("daily sales report normalizers", () => {
  it("groups flat report rows by invoice", () => {
    const groups = createDailySalesBillGroups([
      { order_invoice: "INV-1", prod_name: "Coffee", qty: 2, unit_price: 10, total: 20 },
      { order_invoice: "INV-1", prod_name: "Tea", qty: 1, unit_price: 5, total: 5 }
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      invoiceNumber: "INV-1",
      itemCount: 2,
      qtyTotal: 3,
      baseTotal: 25
    });
  });

  it("normalizes nested detail bill responses", () => {
    const normalized = normalizeDailySalesReportResponse({
      status: "success",
      message: "ok",
      data: [
        {
          title: { invoice: "INV-2", date: "2026-05-29", table_name: "A1" },
          summary: { total: 30 },
          details: [{ product_name: "Noodle", qty: 1, total: 30 }]
        }
      ]
    });

    expect(normalized.billGroups).toHaveLength(1);
    expect(normalized.billGroups[0].invoiceNumber).toBe("INV-2");
    expect(normalized.rows).toHaveLength(1);
  });
});
