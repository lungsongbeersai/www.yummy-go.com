import { describe, expect, it } from "vitest";
import type { AuthUser } from "@/stores/auth-store";
import type { PaymentMethodReportRow } from "@/stores/report-store";
import {
  buildPaymentMethodsPrintData,
  buildPaymentMethodsReportOps,
  renderPaymentMethodsPrintHtml,
  type PaymentMethodsPrintLabels,
} from "./payment-methods-report-print";

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

const labels: PaymentMethodsPrintLabels = {
  grandTotal: "Grand total",
  period: "Period",
  printedAt: "Printed at",
  printedBy: "Printed by",
  title: "Payment methods report",
};

function row(overrides: Partial<PaymentMethodReportRow> = {}): PaymentMethodReportRow {
  return {
    afterDiscountBill: 0,
    afterDiscountItem: 0,
    billCount: 5,
    billTotal: 100000,
    discountBill: 0,
    discountItemAmount: 0,
    grandTotal: 110000,
    paymentAmount: 110000,
    paymentMethodCode: "cash",
    paymentMethodName: "Cash",
    productPriceTotal: 100000,
    serviceCharge: 5000,
    sortOrder: 1,
    total: 100000,
    toppingTotal: 0,
    vat: 5000,
    ...overrides,
  };
}

function printData() {
  return buildPaymentMethodsPrintData({
    dateFrom: "2026-07-13",
    dateTo: "2026-07-13",
    labels,
    reportTotal: { grand_total: 220000 },
    rows: [
      row(),
      row({ billCount: 3, grandTotal: 110000, paymentMethodCode: "transfer", paymentMethodName: "Transfer", sortOrder: 2 }),
    ],
    user,
  });
}

describe("buildPaymentMethodsPrintData", () => {
  it("keeps only name, bill count, and grand total per method, dropping the per-metric financial breakdown", () => {
    const data = printData();

    expect(data.rows).toEqual([
      { billCount: 5, grandTotal: 110000, name: "Cash" },
      { billCount: 3, grandTotal: 110000, name: "Transfer" },
    ]);
    expect(data.grandTotal).toBe(220000);
  });
});

describe("renderPaymentMethodsPrintHtml", () => {
  it("renders the shared 80mm receipt base with bill count inline and a headline grand total block", () => {
    const html = renderPaymentMethodsPrintHtml(printData());

    expect(html).toContain("@page { size: 80mm auto");
    expect(html).toContain("Cash (5)");
    expect(html).toContain("Transfer (3)");
    expect(html).toContain('class="headline-total"');
    expect(html).not.toContain('class="total-row grand-total"');
  });

  it("does not print the subtotal/discount/service/vat breakdown, since that is the daily-closing/daily-sales report's job", () => {
    const html = renderPaymentMethodsPrintHtml(printData());

    expect(html).not.toContain("Subtotal");
    expect(html).not.toContain("Discount");
    expect(html).not.toContain("VAT");
  });
});

describe("buildPaymentMethodsReportOps", () => {
  it("gives every lr op an explicit bold flag so the printer agent never receives an inconsistent op shape", () => {
    const ops = buildPaymentMethodsReportOps(printData());
    const lrOps = ops.filter((op) => op.type === "lr");

    expect(lrOps.length).toBeGreaterThan(0);
    lrOps.forEach((op) => {
      expect(typeof op.bold).toBe("boolean");
    });
  });

  it("orders the header like receiptHeaderHtml: store name, then branch, then title", () => {
    const ops = buildPaymentMethodsReportOps(printData());
    const storeIndex = ops.findIndex((op) => op.text === "Store");
    const branchIndex = ops.findIndex((op) => op.text === "Branch");
    const titleIndex = ops.findIndex((op) => op.text === "Payment methods report");

    expect(storeIndex).toBeGreaterThanOrEqual(0);
    expect(branchIndex).toBeGreaterThan(storeIndex);
    expect(titleIndex).toBeGreaterThan(branchIndex);
  });

  it("prints one plain lr row per payment method with its bill count inline", () => {
    const ops = buildPaymentMethodsReportOps(printData());

    const cashRow = ops.find((op) => op.left === "Cash (5)");
    const transferRow = ops.find((op) => op.left === "Transfer (3)");

    expect(cashRow?.type).toBe("lr");
    expect(cashRow?.bold).toBe(false);
    expect(transferRow?.type).toBe("lr");
    expect(transferRow?.bold).toBe(false);
  });

  it("prints the grand total as two bold text ops instead of an lr row, matching the daily-sales/daily-closing pattern since bold/size on lr does nothing physically", () => {
    const ops = buildPaymentMethodsReportOps(printData());
    const labelOp = ops.find((op) => op.text === "Grand total");
    const amountOp = ops[ops.indexOf(labelOp!) + 1];

    expect(labelOp?.type).toBe("text");
    expect(labelOp?.bold).toBe(true);
    expect(amountOp?.type).toBe("text");
    expect(amountOp?.align).toBe("right");
    expect(amountOp?.bold).toBe(true);
    expect(ops.some((op) => op.type === "lr" && op.left === "Grand total")).toBe(false);
  });

  it("does not print the subtotal/discount/service/vat breakdown, since that is the daily-closing/daily-sales report's job", () => {
    const ops = buildPaymentMethodsReportOps(printData());

    expect(ops.some((op) => op.text === "Subtotal" || op.left === "Subtotal")).toBe(false);
    expect(ops.some((op) => op.text === "VAT" || op.left === "VAT")).toBe(false);
  });
});
