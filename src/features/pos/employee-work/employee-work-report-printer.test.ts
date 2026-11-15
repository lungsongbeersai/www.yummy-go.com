import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceError } from "@/lib/api";
import type { EmployeeWorkItem, EmployeeWorkOrder, EmployeeWorkResponse } from "@/services/pos";
import type { KitchenPrintResult } from "@/services/printer";
import { employeeWorkPeriod } from "./employee-work-period";
import { buildEmployeeWorkReportOps, EmployeeWorkPrintError, printEmployeeWorkOnNative, type EmployeeWorkNativePrintInput, type EmployeeWorkPrintTransport } from "./employee-work-report-printer";

const system = vi.hoisted(() => ({ print: vi.fn() }));
vi.mock("@/lib/android-system-print", () => ({ printHtmlWithAndroidSystemPrint: system.print }));

const label = (key: string) => `L:${key}`;
function report(count = 1): EmployeeWorkResponse {
  const period = employeeWorkPeriod(new Date("2026-11-15T12:00:00+07:00"));
  const data: EmployeeWorkOrder[] = Array.from({ length: count }, (_, index) => {
    const item: EmployeeWorkItem = {
      order_it_uuid: `own-item-${index}`, product_name: `Owned product ${index + 1}`, size_name: "Large", quantity: 1,
      price: 10000, item_discount_amount: 0, total: 10000, financial_quantity: 1, is_set_component: false,
      status: 2, kitchen_sent: true, kitchen_confirmed_at: null, created_at: "2026-11-15T05:00:00+07:00",
      created_at_source: "item_audit", business_date: period.businessDay, financial_warning: null,
      created_by: "employee", created_by_name: "Synthetic employee", note: "Synthetic own note", toppings: [], print_status: "unknown",
    };
    return {
      order_uuid: `bill-${index}`, order_invoice: `BILL-${index + 1}`, table_uuid: "table", table_name: `Table ${index + 1}`,
      zone_name: "Zone", order_created_by: "other-opener", creator_name: "Other bill opener", first_item_at: item.created_at,
      last_item_at: item.created_at, time_warning: null, financial_warning: null, scope: "current", order_check_bill: 1,
      order_status: 1, is_cancelled: false, bill_state: "open", check_bill_requested: false, kitchen_status: "sent", payment_status: "unpaid",
      own_totals: { source: "employee_items", currency: "LAK", item_count: 1, quantity: 1, gross_amount: 10000, item_discount_amount: 0, total_amount: 10000 },
      items: [item],
    };
  });
  const scope = { order_count: count, item_count: count, financial_unknown_count: 0, total_amount: count * 10000 };
  return {
    status: "success", message: "OK", server_now: "2026-11-15T12:00:00+07:00", ownership_mode: "item_creator",
    totals_basis: "item_net_before_bill_adjustments", employee: { login_uuid: "employee", display_name: "Synthetic employee", branch_uuid: "branch", branch_name: "Synthetic branch", store_uuid: "store" },
    business_day: { date: period.businessDay, time_zone: "Asia/Vientiane", cutoff: "05:00", starts_at: period.startsAt, ends_at: period.endsAt, next_reset_at: period.nextBoundaryAt },
    filters: { business_date: period.businessDay, scope: "current", kitchen_status: "all", payment_status: "all", search: "", lang: "la" }, data,
    summary: { ...scope, quantity: count, open_count: count, pending_kitchen_count: 0, sent_kitchen_count: count, check_bill_count: 0, unpaid_count: count, paid_count: 0, credit_count: 0, cancelled_count: 0 },
    scope_summary: { current: scope, carryover: { ...scope, order_count: 0, item_count: 0, total_amount: 0 }, undated: { ...scope, order_count: 0, item_count: 0, total_amount: 0 } },
    pagination: { page: 1, limit: count, total: count, total_pages: 1 }, report: { complete: true, max_orders: 1000 }, warnings: [],
  };
}

function setup(value = report()) {
  const transport = {
    resolveDeviceIdentity: vi.fn<EmployeeWorkPrintTransport["resolveDeviceIdentity"]>().mockResolvedValue({ device_code: "current-device" }),
    submitReportPrint: vi.fn<EmployeeWorkPrintTransport["submitReportPrint"]>().mockResolvedValue({ pending_query: { print_job_uuid: "job", login_uuid_fk: "employee", device_code: "current-device", print_mode: "mobile_wifi" } }),
    executeReport: vi.fn<EmployeeWorkPrintTransport["executeReport"]>().mockResolvedValue({ total: 1, successCount: 1, failedCount: 0 }),
  };
  let current = true;
  const input: EmployeeWorkNativePrintInput = { report: value, html: "<!doctype html><p>Synthetic private A4</p>", jobName: "Synthetic own report", label, language: "la", isCurrent: () => current, transport };
  return { input, transport, invalidate: () => { current = false; } };
}

beforeEach(() => { vi.clearAllMocks(); system.print.mockResolvedValue(false); });

describe("complete employee report printer operations", () => {
  it("includes all25 own records, filters/time/employee, warnings and only own amounts", () => {
    const value = report(25);
    value.filters.search = "Synthetic";
    value.filters.kitchen_status = "sent";
    value.data[0].time_warning = "ITEM_TIME_IS_RECORD_TIME";
    value.data[0].items[0].item_discount_amount = 500;
    value.data[0].items[0].toppings = [{ topping_name: "Owned topping", quantity: 2, price: 500 }];
    value.data[0].items[0].print_status = "acknowledged";
    Object.assign(value.data[0], { totals: { grand_total: 987654321, received_total: 876543210 } });
    const serialized = JSON.stringify(buildEmployeeWorkReportOps(value, label));
    for (let index = 1; index <= 25; index++) expect(serialized).toContain(`Owned product ${index}`);
    for (const expected of ["Synthetic employee", "Synthetic branch", "15/11/2026 05:00:00", "16/11/2026 04:59:59", "L:recordedItemTime", "L:amountsHint", "L:itemDiscount", "Owned topping × 2 · 500 LAK", "L:printAcknowledged", "Other bill opener", "250,000 LAK"]) expect(serialized).toContain(expected);
    for (const forbidden of ["987654321", "876543210", "L:vat", "L:received", "L:outstanding", "L:printUnknown"]) expect(serialized).not.toContain(forbidden);
    expect(JSON.stringify(value)).toContain("987654321"); // Input is not mutated.
  });

  it("preserves unknown amounts/topppings and SET components without charging a repeated SET", () => {
    const value = report();
    value.data[0].items[0] = { ...value.data[0].items[0], price: null, quantity: null, total: null, financial_quantity: null,
      item_discount_amount: null, is_set_component: true, financial_warning: "SET_OWNERSHIP_AMBIGUOUS", toppings: [{ topping_name: "Unknown topping", quantity: null, price: null }] };
    value.data[0].own_totals = { ...value.data[0].own_totals, source: "unknown", total_amount: null, quantity: null };
    value.summary.total_amount = null; value.summary.quantity = null; value.summary.financial_unknown_count = 1;
    const text = JSON.stringify(buildEmployeeWorkReportOps(value, label));
    expect(text).toContain("L:setComponent"); expect(text).toContain("L:setOwnershipReview");
    expect(text).toContain("L:unknown LAK"); expect(text).toContain("Unknown topping × L:unknown · L:unknown LAK");
    expect(text).toContain("L:unknownAmounts"); expect(text).not.toContain("SET_OWNERSHIP_AMBIGUOUS");
  });

  it.each(["incomplete", "foreign", "duplicate", "wrong-day"])("rejects %s report before producing operations", invalid => {
    const value = report();
    if (invalid === "incomplete") value.report.complete = false;
    if (invalid === "foreign") value.data[0].items[0].created_by = "someone-else";
    if (invalid === "duplicate") value.data[0].items.push({ ...value.data[0].items[0] });
    if (invalid === "wrong-day") value.data[0].items[0].business_date = "2026-11-14";
    expect(() => buildEmployeeWorkReportOps(value, label)).toThrowError(expect.objectContaining({ code: "invalid-report" }));
  });

  it("fails explicitly rather than truncating a payload above the safe existing API body bound", () => {
    const value = report(); value.data[0].items[0].note = "x".repeat(2 * 1024 * 1024);
    expect(() => buildEmployeeWorkReportOps(value, label)).toThrowError(expect.objectContaining({ code: "report-too-large" }));
  });

  it.each(["operations", "text", "column", "total-text"])("rejects backend sanitizer %s overflow before creating a queue", async limit => {
    const value = report(limit === "operations" ? 200 : limit === "total-text" ? 60 : 1);
    if (limit === "text") value.data[0].items[0].note = "x".repeat(5001);
    if (limit === "total-text") for (const order of value.data) order.items[0].note = "x".repeat(4400);
    const { input, transport } = setup(value);
    if (limit === "column") input.label = key => key === "unitPrice" ? "x".repeat(2501) : label(key);
    await expect(printEmployeeWorkOnNative(input)).rejects.toMatchObject({ code: "report-too-large", mayHavePrinted: false });
    expect(transport.resolveDeviceIdentity).not.toHaveBeenCalled();
    expect(transport.submitReportPrint).not.toHaveBeenCalled();
    expect(transport.executeReport).not.toHaveBeenCalled();
  });
});

describe("installed-shell employee report transport", () => {
  it("keeps an available Android system dialog and never queues another printer", async () => {
    system.print.mockResolvedValue(true);
    const { input, transport } = setup();
    await expect(printEmployeeWorkOnNative(input)).resolves.toEqual({ status: "system-dialog" });
    expect(system.print).toHaveBeenCalledWith({ html: input.html, jobName: input.jobName });
    expect(transport.resolveDeviceIdentity).not.toHaveBeenCalled(); expect(transport.submitReportPrint).not.toHaveBeenCalled();
  });

  it("keeps available A4 system printing independent of receipt operation limits", async () => {
    system.print.mockResolvedValue(true);
    const { input, transport } = setup(report(200));
    await expect(printEmployeeWorkOnNative(input)).resolves.toEqual({ status: "system-dialog" });
    expect(transport.submitReportPrint).not.toHaveBeenCalled();
  });

  it("missing system plugin uses the configured existing report queue/ACK transport without sending private A4 HTML", async () => {
    const { input, transport } = setup(report(25));
    await expect(printEmployeeWorkOnNative(input)).resolves.toEqual({ status: "printed" });
    const submitted = transport.submitReportPrint.mock.calls[0][0];
    expect(submitted).toMatchObject({ device_code: "current-device", report_key: "employee_work", report_title: input.jobName, lang: "la", print_document: { paper_width_mm: 80, copies: 1, cut_mode: "per_ticket" } });
    expect(submitted.print_document.ops.filter(op => op.text?.startsWith("Owned product"))).toHaveLength(25);
    expect(submitted.print_document.browser_payload).toBeUndefined(); expect(submitted.report_payload).toBeUndefined();
    expect(JSON.stringify(submitted)).not.toContain("Synthetic private A4");
    expect(transport.executeReport).toHaveBeenCalledOnce();
    expect(transport.executeReport).toHaveBeenCalledWith(expect.objectContaining({ login_uuid_fk: "employee", pending_query: expect.objectContaining({ print_job_uuid: "job", login_uuid_fk: "employee" }) }));
  });

  it("does not fall through to another transport when an available system plugin fails", async () => {
    system.print.mockRejectedValue(new Error("private native implementation details"));
    const { input, transport } = setup();
    await expect(printEmployeeWorkOnNative(input)).rejects.toMatchObject({ code: "print-failed", mayHavePrinted: true, message: "print-failed" });
    expect(transport.submitReportPrint).not.toHaveBeenCalled();
  });

  it.each(["system", "identity", "queue"])("drops the previous report/session after awaited %s preparation", async phase => {
    const { input, transport, invalidate } = setup();
    if (phase === "system") system.print.mockImplementationOnce(async () => { invalidate(); return false; });
    if (phase === "identity") transport.resolveDeviceIdentity.mockImplementationOnce(async () => { invalidate(); return { device_code: "current-device" }; });
    if (phase === "queue") transport.submitReportPrint.mockImplementationOnce(async () => { invalidate(); return { pending_query: { print_job_uuid: "job", login_uuid_fk: "employee" } }; });
    await expect(printEmployeeWorkOnNative(input)).rejects.toMatchObject({ code: "stale" });
    if (phase !== "queue") expect(transport.submitReportPrint).not.toHaveBeenCalled();
    expect(transport.executeReport).not.toHaveBeenCalled();
  });

  it("checks stale identity again after the print dialog/executor resolves", async () => {
    const systemCase = setup();
    system.print.mockImplementationOnce(async () => { systemCase.invalidate(); return true; });
    await expect(printEmployeeWorkOnNative(systemCase.input)).rejects.toMatchObject({ code: "stale" });
    const queuedCase = setup();
    queuedCase.transport.executeReport.mockImplementationOnce(async () => { queuedCase.invalidate(); return { total: 1, successCount: 1, failedCount: 0 }; });
    await expect(printEmployeeWorkOnNative(queuedCase.input)).rejects.toMatchObject({ code: "stale" });
  });

  it.each(["no-device", "no-printer"])("reports %s without fake success or browser fallback", async missing => {
    const { input, transport } = setup();
    if (missing === "no-device") transport.resolveDeviceIdentity.mockResolvedValue({ device_code: "" });
    else transport.submitReportPrint.mockResolvedValue({ pending_query: undefined, reason: "unconfigured report role" });
    await expect(printEmployeeWorkOnNative(input)).rejects.toMatchObject({ code: "report-printer-unavailable", mayHavePrinted: false });
    expect(transport.executeReport).not.toHaveBeenCalled();
  });

  it("rejects a mismatched queue actor but preserves legitimate branch Shared target metadata", async () => {
    const mismatch = setup();
    mismatch.transport.submitReportPrint.mockResolvedValue({ pending_query: { print_job_uuid: "job", login_uuid_fk: "other-employee", device_code: "current-device" } });
    await expect(printEmployeeWorkOnNative(mismatch.input)).rejects.toMatchObject({ code: "delivery-unknown", mayHavePrinted: true });
    expect(mismatch.transport.executeReport).not.toHaveBeenCalled();
    const shared = setup();
    const pending = { print_job_uuid: "shared-job", login_uuid_fk: "employee", device_code: "owner-device", agent_id: "owner-agent", remote_shared_print: true };
    shared.transport.submitReportPrint.mockResolvedValue({ pending_query: pending });
    await expect(printEmployeeWorkOnNative(shared.input)).resolves.toEqual({ status: "printed" });
    expect(shared.transport.executeReport.mock.calls[0][0].pending_query).toBe(pending);
  });

  it.each([
    { total: 2, successCount: 1, failedCount: 1 },
    { total: 1, successCount: 0, failedCount: 0, pending: true },
    { total: 0, successCount: 0, failedCount: 0 },
    { total: Infinity, successCount: Infinity, failedCount: 0 },
  ] satisfies KitchenPrintResult[])("does not label partial/pending/malformed result %j as printed or automatically retry", async result => {
    const { input, transport } = setup(); transport.executeReport.mockResolvedValue(result);
    await expect(printEmployeeWorkOnNative(input)).rejects.toMatchObject({ code: "delivery-unknown", mayHavePrinted: true });
    expect(system.print).toHaveBeenCalledOnce(); expect(transport.submitReportPrint).toHaveBeenCalledOnce(); expect(transport.executeReport).toHaveBeenCalledOnce();
  });

  it("keeps ambiguous submission failure unknown and never submits a second job", async () => {
    const { input, transport } = setup(); transport.submitReportPrint.mockRejectedValue(new Error("transport lost after commit"));
    await expect(printEmployeeWorkOnNative(input)).rejects.toMatchObject({ code: "delivery-unknown", mayHavePrinted: true });
    expect(transport.submitReportPrint).toHaveBeenCalledOnce(); expect(transport.executeReport).not.toHaveBeenCalled();
  });

  it("reports explicit413 without treating it as uncertain paper delivery", async () => {
    const { input, transport } = setup(); transport.submitReportPrint.mockRejectedValue(new ServiceError("too large", 413));
    await expect(printEmployeeWorkOnNative(input)).rejects.toMatchObject({ code: "report-too-large", mayHavePrinted: false });
  });

  it("deduplicates an in-flight report even while the first identity lookup is pending", async () => {
    const { input, transport } = setup();
    let resolve: ((value: { device_code: string }) => void) | undefined;
    transport.resolveDeviceIdentity.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const first = printEmployeeWorkOnNative(input), second = printEmployeeWorkOnNative(input);
    expect(first).toBe(second);
    await vi.waitFor(() => expect(resolve).toBeDefined()); resolve?.({ device_code: "current-device" });
    await expect(first).resolves.toEqual({ status: "printed" });
    expect(transport.submitReportPrint).toHaveBeenCalledOnce(); expect(transport.executeReport).toHaveBeenCalledOnce();
  });

  it("rejects stale/invalid report before crossing either native or network boundary", async () => {
    const stale = setup(); stale.invalidate();
    await expect(printEmployeeWorkOnNative(stale.input)).rejects.toMatchObject({ code: "stale" });
    const invalid = setup(); invalid.input.report.report.complete = false;
    await expect(printEmployeeWorkOnNative(invalid.input)).rejects.toBeInstanceOf(EmployeeWorkPrintError);
    expect(system.print).not.toHaveBeenCalled(); expect(invalid.transport.submitReportPrint).not.toHaveBeenCalled();
  });
});
