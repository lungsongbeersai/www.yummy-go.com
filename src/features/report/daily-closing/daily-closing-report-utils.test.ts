import { describe, expect, it } from "vitest";
import type { DailyStoreClosingReport } from "@/stores/report-store";
import {
  dailyClosingLabel,
  dailyClosingPaymentDifference,
  dailyClosingReportItemCount,
} from "./daily-closing-report-utils";

function reportFixture(): DailyStoreClosingReport {
  return {
    cancelSummary: { billCount: 0, totalAmount: 0 },
    filters: { branchUuid: "branch-1", date: "2026-07-10", lang: "la" },
    groups: [
      {
        discountAmount: 0,
        items: [
          {
            discountAmount: 0,
            key: "item-1",
            productName: "Tea",
            toppings: [],
            totalAmount: 5000,
            totalQty: 1,
            unitPrice: 5000,
          },
          {
            discountAmount: 0,
            key: "item-2",
            productName: "Coffee",
            toppings: [],
            totalAmount: 7000,
            totalQty: 1,
            unitPrice: 7000,
          },
        ],
        key: "group-1",
        name: "Drinks",
        totalAmount: 12000,
        totalQty: 0,
      },
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
    paymentSummary: { cash: 11500, credit: 0, paymentTotal: 12000, transfer: 500 },
    summary: {
      discountAmount: 0,
      grandTotal: 11500,
      serviceCharge: 0,
      totalAmount: 11500,
      totalQty: 2,
      vat: 0,
    },
  };
}

describe("daily closing report utils", () => {
  it("calculates the payment reconciliation difference", () => {
    expect(dailyClosingPaymentDifference(reportFixture())).toBe(500);
  });

  it("counts item rows without treating topping quantities as product quantities", () => {
    expect(dailyClosingReportItemCount(reportFixture())).toBe(2);
  });

  it("uses API labels when present and falls back for blank labels", () => {
    expect(dailyClosingLabel(" Cash ", "Fallback")).toBe("Cash");
    expect(dailyClosingLabel("   ", "Fallback")).toBe("Fallback");
  });
});
