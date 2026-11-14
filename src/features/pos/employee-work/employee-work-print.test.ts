import { describe, expect, it } from "vitest";
import type { EmployeeWorkItem, EmployeeWorkOrder, EmployeeWorkResponse } from "@/services/pos";
import { employeeWorkPeriod } from "./employee-work-period";
import { employeeWorkPaymentLabels } from "./employee-work-format";
import { renderEmployeeWorkReport } from "./employee-work-print";

function order(): EmployeeWorkOrder {
  return { order_uuid: "bill", order_invoice: "BILL-1", table_uuid: "table", table_name: "Table 1", zone_name: "Zone", order_created_by: "employee", creator_name: "Employee", order_date: "2026-11-15", opened_at: "2026-11-15T08:00:00+07:00", opened_at_source: "order_audit", opened_at_exact: true, business_date: "2026-11-15", time_warning: null, financial_warning: null, date_time_payment: null, payment_time_source: "unknown", scope: "current", order_check_bill: 1, order_status: 1, is_cancelled: false, bill_state: "open", check_bill_requested: false, kitchen_status: "sent", payment_status: "unpaid", totals: { source: "stored_bill", currency: "LAK", quantity: 1, gross_amount: 10000, item_discount_amount: 0, subtotal: 10000, discount_amount: 0, service_amount: 0, vat_amount: 0, grand_total: 10000, received_total: 0, balance_amount: 10000, credit_balance: 0 }, items: [] };
}

function response(serverNow = "2026-11-15T12:00:00+07:00"): EmployeeWorkResponse {
  const period = employeeWorkPeriod(new Date(serverNow));
  const scope = { order_count: 1, financial_unknown_count: 0, total_amount: 10000, balance_amount: 10000 };
  return { status: "success", message: "OK", server_now: serverNow, ownership_mode: "bill_opener", employee: { login_uuid: "employee", display_name: "Employee", branch_uuid: "branch", branch_name: "Branch", store_uuid: "store" }, business_day: { date: period.businessDay, time_zone: "Asia/Vientiane", cutoff: "05:00", starts_at: period.startsAt, ends_at: period.endsAt, next_reset_at: period.nextBoundaryAt }, filters: { business_date: period.businessDay, scope: "current", search: "", kitchen_status: "all", payment_status: "all", lang: "la" }, data: [order()], summary: { order_count: 1, open_count: 1, pending_kitchen_count: 0, sent_kitchen_count: 1, check_bill_count: 0, unpaid_count: 1, paid_count: 0, credit_count: 0, cancelled_count: 0, financial_unknown_count: 0, total_amount: 10000, balance_amount: 10000, credit_balance_amount: 0 }, scope_summary: { current: scope, carryover: { ...scope, order_count: 0 }, undated: { ...scope, order_count: 0 } }, pagination: { page: 1, limit: 20, total: 1, total_pages: 1 }, report: { complete: false, max_orders: 1000 }, warnings: [] };
}

const label = (key: string) => `L:${key}`;
function complete() {
  const result = response();
  result.report.complete = true;
  return result;
}
function item(): EmployeeWorkItem {
  return { order_it_uuid: "item", product_name: "Synthetic soup", size_name: "Large", quantity: 2, price: 10000, item_discount_amount: 0, total: 20000, financial_quantity: 2, is_set_component: false, status: 2, kitchen_sent: true, kitchen_confirmed_at: null, created_at: "2026-11-15T10:00:00+07:00", created_by: "contributor", created_by_name: "Another employee", note: "No ice", toppings: [], print_status: "unknown" };
}

describe("employee responsibility report rendering", () => {
  it.each(["noto-sans", "noto-serif", "phetsarath", "saysettha"] as const)("uses chosen system font %s and explicit current period/filter/owner metadata", font => {
    const report = complete();
    report.filters.kitchen_status = "sent";
    report.filters.payment_status = "credit_partial";
    report.filters.search = "Table 1";
    const html = renderEmployeeWorkReport(report, label, font, "https://example.test/");
    expect(html).toContain(`data-lao-font="${font}"`);
    expect(html).toContain("/fonts/app-document-fonts.css");
    expect(html).toContain("15/11/2026 05:00:00");
    expect(html).toContain("16/11/2026 04:59:59");
    expect(html).toContain("L:kitchen: L:sent");
    expect(html).toContain("L:settlement: L:credit · L:partlySettled");
    expect(html).toContain("Employee");
    expect(html).toContain("Branch");
  });

  it("prints full bills with contributor, unit price, quantity and authoritative line/bill totals", () => {
    const report = complete();
    report.data[0].items = [item(), { ...item(), order_it_uuid: "component", product_name: "Set component", is_set_component: true, total: 0, price: 0 }];
    report.data.push({ ...order(), order_uuid: "second", order_invoice: "ALL-PAGES-BILL" });
    report.pagination.total = 2;
    const html = renderEmployeeWorkReport(report, label, "phetsarath", "https://example.test/");
    expect(html).toContain("ALL-PAGES-BILL");
    expect(html).toContain("Another employee");
    expect(html).toContain('class="number">10,000</td>');
    expect(html).toContain('class="number">2</td>');
    expect(html).toContain('class="number">20,000</td>');
    expect(html).toContain("L:setComponent");
    expect(html).toContain("L:total: <strong>10,000 LAK");
    expect(html).not.toContain("L:printStatus");
  });

  it("keeps closed-credit separate from settled and preserves nullable payment facts as unknown", () => {
    const report = complete();
    const bill = report.data[0];
    bill.bill_state = "closed";
    bill.payment_status = "credit_unpaid";
    bill.financial_warning = "PAYMENT_SNAPSHOT_INCOMPLETE";
    bill.totals = { ...bill.totals, received_total: null, balance_amount: null, credit_balance: null };
    report.summary = { ...report.summary, financial_unknown_count: 1, total_amount: null, balance_amount: null, credit_balance_amount: null };
    const html = renderEmployeeWorkReport(report, label, "noto-sans", "https://example.test/");
    expect(html).toContain("L:checkBill: L:closed");
    expect(html).toContain("L:settlement: L:credit");
    expect(html).not.toContain("L:settled");
    expect(html).toContain("L:received: L:unknown");
    expect(html).toContain("L:outstanding: L:unknown");
    expect(html).toContain("L:credit: L:unknown");
    expect(html).toContain("L:billNeedsReview");
    expect(html).toContain("L:unknownAmounts");
    expect(employeeWorkPaymentLabels("credit_partial")).toEqual(["credit", "partlySettled"]);
  });

  it("escapes untrusted names/notes/search and shows readable provenance instead of warning codes", () => {
    const report = complete();
    report.filters.search = '<svg data-search=x onload="x">';
    report.employee.display_name = "<script>private</script>";
    report.data[0].items = [{ ...item(), product_name: "<script>item</script>", note: "<svg onload=x>" }];
    report.data[0].time_warning = "FIRST_SURVIVING_ITEM_ESTIMATE";
    report.data[0].financial_warning = "BILL_ITEMS_MISSING";
    report.data[0].date_time_payment = "RAW-UNZONED-PAYMENT-MARKER";
    const html = renderEmployeeWorkReport(report, label, "noto-sans", "https://example.test/");
    expect(html).toContain("&lt;script&gt;private&lt;/script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<svg");
    expect(html).toContain("L:estimatedOpening");
    expect(html).toContain("L:billNeedsReview");
    expect(html).not.toContain("FIRST_SURVIVING_ITEM_ESTIMATE");
    expect(html).not.toContain("BILL_ITEMS_MISSING");
    expect(html).not.toContain("RAW-UNZONED-PAYMENT-MARKER");
  });

  it("requires a complete report, including the intentionally empty complete report", () => {
    expect(() => renderEmployeeWorkReport(response(), label, "noto-sans", "https://example.test/")).toThrow("complete work report");
    const report = complete(); report.pagination.total = 2;
    expect(() => renderEmployeeWorkReport(report, label, "noto-sans", "https://example.test/")).toThrow("complete work report");
    report.data = []; report.pagination.total = 0; report.pagination.limit = 0;
    expect(renderEmployeeWorkReport(report, label, "noto-sans", "https://example.test/")).toContain("L:empty");
  });
});
