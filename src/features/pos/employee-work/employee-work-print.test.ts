import { describe, expect, it } from "vitest";
import type { EmployeeWorkItem, EmployeeWorkOrder, EmployeeWorkResponse } from "@/services/pos";
import { employeeWorkPeriod } from "./employee-work-period";
import { employeeWorkPaymentLabels } from "./employee-work-format";
import { renderEmployeeWorkReport } from "./employee-work-print";

function ownedItem(businessDay = "2026-11-15", id = "bill-item"): EmployeeWorkItem {
  return { order_it_uuid: id, product_name: "Own soup", size_name: "Large", quantity: 1, price: 10000, item_discount_amount: 0, total: 10000, financial_quantity: 1, is_set_component: false, status: 2, kitchen_sent: true, kitchen_confirmed_at: null, created_at: `${businessDay}T05:00:00+07:00`, created_at_source: "item_audit", business_date: businessDay, financial_warning: null, created_by: "employee", created_by_name: "Employee", note: "No ice", toppings: [], print_status: "unknown" };
}

function order(businessDay = "2026-11-15", id = "bill"): EmployeeWorkOrder {
  const item = ownedItem(businessDay, `${id}-item`);
  return { order_uuid: id, order_invoice: "BILL-1", table_uuid: "table", table_name: "Table 1", zone_name: "Zone", order_created_by: "bill-opener", creator_name: "Another bill opener", first_item_at: item.created_at, last_item_at: item.created_at, time_warning: null, financial_warning: null, scope: "current", order_check_bill: 1, order_status: 1, is_cancelled: false, bill_state: "open", check_bill_requested: false, kitchen_status: "sent", payment_status: "unpaid", own_totals: { source: "employee_items", currency: "LAK", item_count: 1, quantity: 1, gross_amount: 10000, item_discount_amount: 0, total_amount: 10000 }, items: [item] };
}

function response(serverNow = "2026-11-15T12:00:00+07:00"): EmployeeWorkResponse {
  const period = employeeWorkPeriod(new Date(serverNow));
  const scope = { order_count: 1, item_count: 1, financial_unknown_count: 0, total_amount: 10000 };
  return { status: "success", message: "OK", server_now: serverNow, ownership_mode: "item_creator", totals_basis: "item_net_before_bill_adjustments", employee: { login_uuid: "employee", display_name: "Employee", branch_uuid: "branch", branch_name: "Branch", store_uuid: "store" }, business_day: { date: period.businessDay, time_zone: "Asia/Vientiane", cutoff: "05:00", starts_at: period.startsAt, ends_at: period.endsAt, next_reset_at: period.nextBoundaryAt }, filters: { business_date: period.businessDay, scope: "current", search: "", kitchen_status: "all", payment_status: "all", lang: "la" }, data: [order(period.businessDay)], summary: { order_count: 1, item_count: 1, quantity: 1, open_count: 1, pending_kitchen_count: 0, sent_kitchen_count: 1, check_bill_count: 0, unpaid_count: 1, paid_count: 0, credit_count: 0, cancelled_count: 0, financial_unknown_count: 0, total_amount: 10000 }, scope_summary: { current: scope, carryover: { ...scope, order_count: 0 }, undated: { ...scope, order_count: 0 } }, pagination: { page: 1, limit: 20, total: 1, total_pages: 1 }, report: { complete: false, max_orders: 1000 }, warnings: [] };
}

const label = (key: string) => `L:${key}`;
function complete() {
  const result = response();
  result.report.complete = true;
  return result;
}

describe("employee responsibility report rendering", () => {
  it.each(["noto-sans", "noto-serif", "phetsarath", "saysettha"] as const)("uses chosen system font %s and explicit current period/filter/owner metadata", font => {
    const report = complete();
    report.filters.kitchen_status = "sent";
    report.filters.payment_status = "credit_partial";
    report.data[0].payment_status = "credit_partial";
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

  it("prints only owned lines and own totals even when another employee opened the bill", () => {
    const report = complete();
    report.data[0].items = [{ ...ownedItem(), quantity: 2, financial_quantity: 2, total: 20000 }, { ...ownedItem("2026-11-15", "component"), product_name: "Own set component", is_set_component: true, total: 0, price: 0, financial_quantity: 0 }];
    report.data[0].own_totals = { ...report.data[0].own_totals, item_count: 2, quantity: 2, gross_amount: 20000, total_amount: 20000 };
    Object.assign(report.data[0], { totals: { grand_total: 987654321, received_total: 876543210, balance_amount: 765432109, credit_balance: 654321098 } });
    report.data.push({ ...order("2026-11-15", "second"), order_invoice: "ALL-PAGES-BILL" });
    report.pagination.total = 2;
    report.summary = { ...report.summary, order_count: 2, item_count: 3, quantity: 3, total_amount: 30000 };
    const html = renderEmployeeWorkReport(report, label, "phetsarath", "https://example.test/");
    expect(html).toContain("ALL-PAGES-BILL");
    expect(html).toContain("L:billOpenedBy: Another bill opener");
    expect(html).toContain('class="number">10,000</td>');
    expect(html).toContain('class="number">2</td>');
    expect(html).toContain('class="number">20,000</td>');
    expect(html).toContain("L:setComponent");
    expect(html).toContain("L:ownTotal: <strong>20,000 LAK");
    expect(html).toContain("L:amountsHint");
    expect(html).not.toContain("L:printStatus");
    for (const forbidden of ["987,654,321", "876,543,210", "765,432,109", "654,321,098", "L:received", "L:outstanding", "L:billDiscount", "L:serviceCharge", "L:vat"]) expect(html).not.toContain(forbidden);
  });

  it("shows shared closed-credit status without assigning bill money to the employee", () => {
    const report = complete();
    report.data[0].bill_state = "closed";
    report.data[0].payment_status = "credit_unpaid";
    const html = renderEmployeeWorkReport(report, label, "noto-sans", "https://example.test/");
    expect(html).toContain("L:sharedBillStatus: L:closed");
    expect(html).toContain("L:settlement: L:credit");
    expect(html).not.toContain("L:settled");
    expect(html).toContain("L:ownTotal: <strong>10,000 LAK");
    expect(html).not.toContain("L:received");
    expect(html).not.toContain("L:outstanding");
    expect(employeeWorkPaymentLabels("credit_partial")).toEqual(["credit", "partlySettled"]);
  });

  it("preserves unknown owned SET amounts and quantities instead of inventing zero", () => {
    const report = complete();
    report.data[0].items[0] = { ...ownedItem(), quantity: null, price: null, total: null, financial_quantity: null, financial_warning: "SET_OWNERSHIP_AMBIGUOUS" };
    report.data[0].own_totals = { ...report.data[0].own_totals, source: "unknown", quantity: null, total_amount: null };
    report.data[0].financial_warning = "SET_OWNERSHIP_AMBIGUOUS";
    report.summary = { ...report.summary, financial_unknown_count: 1, quantity: null, total_amount: null };
    const html = renderEmployeeWorkReport(report, label, "noto-sans", "https://example.test/");
    expect(html).toContain('class="number">L:unknown</td>');
    expect(html).toContain("L:ownTotal: <strong>L:unknown LAK");
    expect(html).toContain("L:setOwnershipReview");
    expect(html).toContain("L:unknownAmounts");
    expect(html).not.toContain("SET_OWNERSHIP_AMBIGUOUS");
  });

  it("keeps a nullable topping quantity unknown instead of displaying zero", () => {
    const report = complete();
    report.data[0].items[0].toppings = [{ topping_name: "Synthetic topping", quantity: null, price: null }];
    const html = renderEmployeeWorkReport(report, label, "noto-sans", "https://example.test/");
    expect(html).toContain("Synthetic topping × L:unknown");
    expect(html).not.toContain("Synthetic topping × 0");
  });

  it("escapes untrusted names/notes/search and shows readable item-time provenance", () => {
    const report = complete();
    report.filters.search = '<svg data-search=x onload="x">';
    report.employee.display_name = "<script>private</script>";
    report.data[0].items = [{ ...ownedItem(), product_name: "<script>item</script>", note: "<svg onload=x>", created_at_source: "stored_item_time" }];
    report.data[0].time_warning = "ITEM_TIME_IS_RECORD_TIME";
    report.data[0].financial_warning = "ITEM_FINANCIAL_INCOMPLETE";
    const html = renderEmployeeWorkReport(report, label, "noto-sans", "https://example.test/");
    expect(html).toContain("&lt;script&gt;private&lt;/script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<svg");
    expect(html).toContain("L:recordedItemTime");
    expect(html).toContain("L:billNeedsReview");
    expect(html).not.toContain("ITEM_TIME_IS_RECORD_TIME");
    expect(html).not.toContain("ITEM_FINANCIAL_INCOMPLETE");
  });

  it.each(["old-policy", "missing-basis", "foreign-item", "null-creator", "duplicate", "wrong-day", "closed-carryover"])("refuses to print %s report data", invalid => {
    const report = complete();
    if (invalid === "old-policy") Object.assign(report, { ownership_mode: "bill_opener" });
    if (invalid === "missing-basis") Reflect.deleteProperty(report, "totals_basis");
    if (invalid === "foreign-item") report.data[0].items[0].created_by = "another-employee";
    if (invalid === "null-creator") report.data[0].items[0].created_by = null;
    if (invalid === "duplicate") report.data[0].items.push({ ...report.data[0].items[0] });
    if (invalid === "wrong-day") report.data[0].items[0].business_date = "2026-11-14";
    if (invalid === "closed-carryover") { report.filters.scope = "carryover"; report.data[0].scope = "carryover"; report.data[0].bill_state = "closed"; report.data[0].items[0] = ownedItem("2026-11-14"); }
    expect(() => renderEmployeeWorkReport(report, label, "noto-sans", "https://example.test/")).toThrow();
  });

  it("requires a complete report, including the intentionally empty complete report", () => {
    expect(() => renderEmployeeWorkReport(response(), label, "noto-sans", "https://example.test/")).toThrow("complete work report");
    const report = complete(); report.pagination.total = 2;
    expect(() => renderEmployeeWorkReport(report, label, "noto-sans", "https://example.test/")).toThrow("complete work report");
    report.data = []; report.pagination.total = 0; report.pagination.limit = 0;
    expect(renderEmployeeWorkReport(report, label, "noto-sans", "https://example.test/")).toContain("L:empty");
  });
});
