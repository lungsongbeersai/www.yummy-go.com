import { describe, expect, it } from "vitest";
import type { AuthUser } from "@/stores/auth-store";
import type { EmployeeSalesReportSummary, EmployeeSalesRow } from "@/services/report";
import {
  buildEmployeeSalesPrintData,
  buildEmployeeSalesReportOps,
  renderEmployeeSalesPrintHtml,
  type EmployeeSalesPrintLabels,
} from "./employee-sales-report-print";

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

const labels: EmployeeSalesPrintLabels = {
  grandTotal: "Grand total",
  itemsHeaderLeft: "Employee",
  itemsHeaderRight: "Total amount",
  period: "Period",
  printedAt: "Printed at",
  printedBy: "Printed by",
  title: "Employee sales report",
};

function row(overrides: Partial<EmployeeSalesRow> = {}): EmployeeSalesRow {
  return {
    branch_name: "Branch",
    branch_uuid_fk: "branch-1",
    cancel_summary: { cancel_bill_count: 0, cancel_total_amount: 0 },
    groups: [],
    login_active: 1,
    login_email: "alice@example.com",
    login_profile: "",
    login_uuid: "login-1",
    order_channels: [],
    orders: [],
    payment_summary: { cash: 0, credit: 0, payment_total: 0, transfer: 0 },
    roles_id: 1,
    roles_name: "Cashier",
    summary: {
      bill_count: 5,
      bill_discount_amount: 0,
      discount_amount: 0,
      grand_total: 110000,
      gross_amount: 100000,
      item_discount_amount: 0,
      net_sale: 100000,
      order_count: 5,
      service_charge: 5000,
      total_qty: 10,
      vat: 5000,
    },
    ...overrides,
  };
}

function summary(overrides: Partial<EmployeeSalesReportSummary> = {}): EmployeeSalesReportSummary {
  return {
    bill_count: 8,
    bill_discount_amount: 0,
    cancel_bill_count: 0,
    cancel_total_amount: 0,
    cash: 0,
    credit: 0,
    discount_amount: 0,
    employee_count: 2,
    grand_total: 220000,
    gross_amount: 200000,
    item_discount_amount: 0,
    net_sale: 200000,
    order_count: 8,
    payment_total: 0,
    service_charge: 10000,
    total_qty: 20,
    transfer: 0,
    vat: 10000,
    ...overrides,
  };
}

function printData() {
  return buildEmployeeSalesPrintData({
    dateFrom: "2026-07-13",
    dateTo: "2026-07-13",
    labels,
    rows: [
      row(),
      row({ login_email: "bob@example.com", login_uuid: "login-2", summary: { ...row().summary, bill_count: 3, grand_total: 110000 } }),
    ],
    summary: summary(),
    user,
  });
}

describe("buildEmployeeSalesPrintData", () => {
  it("keeps only name, bill count, and grand total per employee, dropping the per-metric financial breakdown", () => {
    const data = printData();

    expect(data.rows).toEqual([
      { billCount: 5, grandTotal: 110000, name: "alice@example.com" },
      { billCount: 3, grandTotal: 110000, name: "bob@example.com" },
    ]);
    expect(data.grandTotal).toBe(220000);
  });

  it("uses login_email as the display name, ignoring login_profile (an avatar image URL, not a name)", () => {
    const data = buildEmployeeSalesPrintData({
      dateFrom: "2026-07-13",
      dateTo: "2026-07-13",
      labels,
      rows: [row({ login_profile: "https://cdn.example.com/avatar.jpg", login_email: "alice@example.com" })],
      summary: summary(),
      user,
    });

    expect(data.rows[0].name).toBe("alice@example.com");
  });
});

describe("renderEmployeeSalesPrintHtml", () => {
  it("renders the shared 80mm receipt base with bill count inline and a flat grand total row, matching payment-methods", () => {
    const html = renderEmployeeSalesPrintHtml(printData());

    expect(html).toContain("@page { size: 80mm auto");
    expect(html).toContain("alice@example.com (5)");
    expect(html).toContain("bob@example.com (3)");
    expect(html).toContain('class="total-row grand-total"');
  });

  it("does not print the subtotal/discount/service/vat breakdown, since that is the daily-closing/daily-sales report's job", () => {
    const html = renderEmployeeSalesPrintHtml(printData());

    expect(html).not.toContain("Subtotal");
    expect(html).not.toContain("Discount");
    expect(html).not.toContain("VAT");
  });
});

describe("buildEmployeeSalesReportOps", () => {
  it("gives every lr op an explicit bold flag so the printer agent never receives an inconsistent op shape", () => {
    const ops = buildEmployeeSalesReportOps(printData());
    const lrOps = ops.filter((op) => op.type === "lr");

    expect(lrOps.length).toBeGreaterThan(0);
    lrOps.forEach((op) => {
      expect(typeof op.bold).toBe("boolean");
    });
  });

  it("orders the header like receiptHeaderHtml: store name, then branch, then title", () => {
    const ops = buildEmployeeSalesReportOps(printData());
    const storeIndex = ops.findIndex((op) => op.text === "Store");
    const branchIndex = ops.findIndex((op) => op.text === "Branch");
    const titleIndex = ops.findIndex((op) => op.text === "Employee sales report");

    expect(storeIndex).toBeGreaterThanOrEqual(0);
    expect(branchIndex).toBeGreaterThan(storeIndex);
    expect(titleIndex).toBeGreaterThan(branchIndex);
  });

  it("prints one plain lr row per employee with its bill count inline", () => {
    const ops = buildEmployeeSalesReportOps(printData());

    const aliceRow = ops.find((op) => op.left === "alice@example.com (5)");
    const bobRow = ops.find((op) => op.left === "bob@example.com (3)");

    expect(aliceRow?.type).toBe("lr");
    expect(aliceRow?.bold).toBe(false);
    expect(bobRow?.type).toBe("lr");
    expect(bobRow?.bold).toBe(false);
  });

  it("does not cap the employees printed, unlike a top-N design", () => {
    const rows = Array.from({ length: 13 }, (_, index) =>
      row({ login_email: `employee-${index + 1}@example.com`, login_uuid: `login-${index + 1}` }),
    );
    const ops = buildEmployeeSalesReportOps(
      buildEmployeeSalesPrintData({ dateFrom: "2026-07-13", dateTo: "2026-07-13", labels, rows, summary: summary(), user }),
    );
    const employeeRows = ops.filter((op) => op.type === "lr" && /^employee-\d+@example\.com/.test(op.left ?? ""));

    expect(employeeRows).toHaveLength(13);
  });

  it("prints the grand total as a single bold lr row at size 34, matching daily-sales exactly", () => {
    const ops = buildEmployeeSalesReportOps(printData());
    const grandTotalOp = ops.find((op) => op.left === "Grand total");

    expect(grandTotalOp?.type).toBe("lr");
    expect(grandTotalOp?.bold).toBe(true);
    expect(grandTotalOp?.size).toBe(34);
  });

  it("does not print the subtotal/discount/service/vat breakdown, since that is the daily-closing/daily-sales report's job", () => {
    const ops = buildEmployeeSalesReportOps(printData());

    expect(ops.some((op) => op.text === "Subtotal" || op.left === "Subtotal")).toBe(false);
    expect(ops.some((op) => op.text === "VAT" || op.left === "VAT")).toBe(false);
  });
});
