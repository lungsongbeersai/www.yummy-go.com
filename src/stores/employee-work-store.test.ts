import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getEmployeeWork, getEmployeeWorkReport, type EmployeeWorkItem, type EmployeeWorkOrder, type EmployeeWorkResponse } from "@/services/pos";
import { useAuthStore, type AuthUser } from "@/stores/auth-store";
import { resetSessionStores } from "@/stores/session-store-registry";
import { employeeWorkPeriod } from "@/features/pos/employee-work/employee-work-period";
import { ServiceError } from "@/lib/api";
import { useEmployeeWorkStore } from "./employee-work-store";

vi.mock("@/services/pos", () => ({ getEmployeeWork: vi.fn(), getEmployeeWorkReport: vi.fn() }));
const user: AuthUser = { uuid: "employee", email: "employee@example.test", status: 7, store_status: 2, profile: "", branch_uuid: "branch", branch_name: "Branch", branch_tel: "", branch_address: "", store_uuid: "store", store_name: "Store", store_logo: "", store_table_status: 1 };
let monotonic = 0;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

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

beforeEach(() => {
  vi.resetAllMocks();
  monotonic = 0;
  vi.spyOn(performance, "now").mockImplementation(() => monotonic);
  useAuthStore.setState({ user, token: "token" });
  useEmployeeWorkStore.getState().enter();
});
afterEach(() => { useEmployeeWorkStore.getState().reset(); vi.restoreAllMocks(); });

describe("employee work session and business-day ownership", () => {
  it("accepts only the actor's own lines on a bill opened by another employee", async () => {
    const result = response();
    expect(result.data[0].order_created_by).not.toBe(user.uuid);
    vi.mocked(getEmployeeWork).mockResolvedValueOnce(result);
    await useEmployeeWorkStore.getState().load();
    expect(useEmployeeWorkStore.getState().response).toBe(result);
  });

  it("uses server summary and preserves unknown own-item amounts without recomputing zeros", async () => {
    const result = response();
    result.data[0].own_totals = { ...result.data[0].own_totals, source: "unknown", total_amount: null };
    result.data[0].items[0] = { ...result.data[0].items[0], total: null, financial_quantity: null, financial_warning: "SET_OWNERSHIP_AMBIGUOUS" };
    result.data[0].financial_warning = "SET_OWNERSHIP_AMBIGUOUS";
    result.summary = { ...result.summary, financial_unknown_count: 1, total_amount: null };
    vi.mocked(getEmployeeWork).mockResolvedValueOnce(result);
    await useEmployeeWorkStore.getState().load();
    expect(useEmployeeWorkStore.getState().response).toBe(result);
    expect(useEmployeeWorkStore.getState().response?.summary.total_amount).toBeNull();
  });

  it("keeps the latest filters when earlier reads finish last", async () => {
    const old = deferred<EmployeeWorkResponse>();
    vi.mocked(getEmployeeWork).mockReturnValueOnce(old.promise);
    const first = useEmployeeWorkStore.getState().load();
    const next = response(); next.filters.search = "Table 1";
    vi.mocked(getEmployeeWork).mockResolvedValueOnce(next);
    await useEmployeeWorkStore.getState().load({ search: "Table 1" });
    old.resolve(response()); await first;
    expect(useEmployeeWorkStore.getState().response).toBe(next);
  });

  it.each(["employee", "branch", "store", "token", "classification"])("drops old list/report responses across an authenticated %s ABA change", async changed => {
    vi.mocked(getEmployeeWork).mockResolvedValueOnce(response());
    await useEmployeeWorkStore.getState().load();
    const oldList = deferred<EmployeeWorkResponse>(); const oldReport = deferred<EmployeeWorkResponse>();
    vi.mocked(getEmployeeWork).mockReturnValueOnce(oldList.promise);
    vi.mocked(getEmployeeWorkReport).mockReturnValueOnce(oldReport.promise);
    const report = useEmployeeWorkStore.getState().loadReport();
    const listing = useEmployeeWorkStore.getState().load();
    const version = useEmployeeWorkStore.getState().sessionVersion;
    if (changed === "token") useAuthStore.setState({ token: "other" });
    else useAuthStore.setState({ user: { ...user, ...(changed === "employee" ? { uuid: "other" } : changed === "branch" ? { branch_uuid: "other" } : changed === "store" ? { store_uuid: "other" } : { store_status: 1 }) } });
    useAuthStore.setState({ user, token: "token" });
    expect(useEmployeeWorkStore.getState().sessionVersion).toBeGreaterThan(version);
    useEmployeeWorkStore.getState().enter();
    oldList.resolve(response()); oldReport.resolve({ ...response(), report: { complete: true, max_orders: 1000 } });
    await listing; expect(await report).toBeNull();
    expect(useEmployeeWorkStore.getState()).toMatchObject({ response: null, report: null, loading: false, reportLoading: false });
  });

  it("keeps a newer dialog lease intact when an older dialog cleans up", () => {
    const old = useEmployeeWorkStore.getState().enter();
    const current = useEmployeeWorkStore.getState().enter();
    useEmployeeWorkStore.getState().leave(old);
    vi.mocked(getEmployeeWork).mockResolvedValueOnce(response());
    return useEmployeeWorkStore.getState().load().then(() => {
      expect(useEmployeeWorkStore.getState().response).not.toBeNull();
      useEmployeeWorkStore.getState().leave(current);
      expect(useEmployeeWorkStore.getState().response).toBeNull();
    });
  });

  it("clears yesterday immediately at05:00, resets pagination and rejects late pre-cutoff list/report callbacks", async () => {
    const before = response("2026-11-15T04:59:59+07:00");
    before.pagination.page = 3;
    vi.mocked(getEmployeeWork).mockResolvedValueOnce(before);
    await useEmployeeWorkStore.getState().load({ page: 3 });
    const oldList = deferred<EmployeeWorkResponse>(); const oldReport = deferred<EmployeeWorkResponse>(); const fresh = deferred<EmployeeWorkResponse>();
    vi.mocked(getEmployeeWork).mockReturnValueOnce(oldList.promise).mockReturnValueOnce(fresh.promise);
    vi.mocked(getEmployeeWorkReport).mockReturnValueOnce(oldReport.promise);
    const report = useEmployeeWorkStore.getState().loadReport();
    const listing = useEmployeeWorkStore.getState().load();
    monotonic = 1000;
    expect(useEmployeeWorkStore.getState().checkRollover()).toBe(true);
    expect(useEmployeeWorkStore.getState()).toMatchObject({ response: null, report: null, rollover: true, params: { page: 1 }, loading: true });
    oldList.resolve(before); oldReport.resolve({ ...before, report: { complete: true, max_orders: 1000 } });
    await listing; expect(await report).toBeNull();
    fresh.resolve(response("2026-11-15T05:00:00+07:00")); await Promise.resolve(); await Promise.resolve();
    expect(useEmployeeWorkStore.getState().response?.business_day.date).toBe("2026-11-15");
    expect(getEmployeeWork).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, business_date: undefined }));
  });

  it("rejects a late old-day result instead of reanchoring the clock before the cutoff", async () => {
    const before = response("2026-11-15T04:59:59+07:00");
    vi.mocked(getEmployeeWork).mockResolvedValueOnce(before);
    await useEmployeeWorkStore.getState().load();
    const late = deferred<EmployeeWorkResponse>();
    vi.mocked(getEmployeeWork).mockReturnValueOnce(late.promise);
    const loading = useEmployeeWorkStore.getState().load();
    monotonic = 2000; late.resolve(before);
    await expect(loading).rejects.toThrow("business day changed");
    expect(useEmployeeWorkStore.getState().response).toBeNull();
  });

  it("resets to page1 and drops the previous report when waking across05:00 with a paused monotonic clock", async () => {
    const before = response("2026-11-15T04:59:59+07:00"); before.pagination.page = 3;
    vi.mocked(getEmployeeWork).mockResolvedValueOnce(before);
    await useEmployeeWorkStore.getState().load({ page: 3 });
    const oldReport = deferred<EmployeeWorkResponse>();
    vi.mocked(getEmployeeWorkReport).mockReturnValueOnce(oldReport.promise);
    const report = useEmployeeWorkStore.getState().loadReport();
    const after = response("2026-11-15T05:00:01+07:00");
    vi.mocked(getEmployeeWork).mockResolvedValueOnce({ ...after, pagination: { ...after.pagination, page: 3 } }).mockResolvedValueOnce(after);
    await useEmployeeWorkStore.getState().load();
    expect(useEmployeeWorkStore.getState()).toMatchObject({ response: after, params: { page: 1 }, report: null, reportLoading: false });
    oldReport.resolve({ ...before, report: { complete: true, max_orders: 1000 } });
    expect(await report).toBeNull();
    expect(useEmployeeWorkStore.getState().reportError).toBeNull();
  });

  it.each(["employee", "branch", "item-owner", "filters", "period"])("fails closed on mismatched %s metadata", async mismatch => {
    const result = response();
    if (mismatch === "employee") result.employee.login_uuid = "foreign";
    if (mismatch === "branch") result.employee.branch_uuid = "foreign";
    if (mismatch === "item-owner") result.data[0].items[0].created_by = "foreign";
    if (mismatch === "filters") result.filters.search = "other";
    if (mismatch === "period") result.business_day.next_reset_at = "2026-11-17T05:00:00+07:00";
    vi.mocked(getEmployeeWork).mockResolvedValueOnce(result);
    await expect(useEmployeeWorkStore.getState().load()).rejects.toThrow();
    expect(useEmployeeWorkStore.getState()).toMatchObject({ response: null, loading: false });
  });

  it.each(["old-policy", "missing-basis", "null-creator", "mixed-foreign", "duplicate", "duplicate-across-bills", "empty-group", "wrong-date", "out-of-scope-date", "unzoned-time", "unknown-time-with-date", "closed-carryover", "cancelled-carryover-line", "cancelled-carryover-bill"])("rejects %s list data rather than retaining or filtering a partial response", async invalid => {
    const result = response();
    if (invalid === "old-policy") Object.assign(result, { ownership_mode: "bill_opener" });
    if (invalid === "missing-basis") Reflect.deleteProperty(result, "totals_basis");
    if (invalid === "null-creator") result.data[0].items[0].created_by = null;
    if (invalid === "mixed-foreign") result.data[0].items.push({ ...ownedItem("2026-11-15", "foreign"), created_by: "another-employee" });
    if (invalid === "duplicate") result.data[0].items.push({ ...result.data[0].items[0] });
    if (invalid === "duplicate-across-bills") result.data.push({ ...order("2026-11-15", "other-bill"), items: [{ ...result.data[0].items[0] }] });
    if (invalid === "empty-group") result.data[0].items = [];
    if (invalid === "wrong-date") result.data[0].items[0].business_date = "2026-11-14";
    if (invalid === "out-of-scope-date") result.data[0].items[0] = ownedItem("2026-11-14");
    if (invalid === "unzoned-time") result.data[0].items[0].created_at = "2026-11-15 05:00:00";
    if (invalid === "unknown-time-with-date") result.data[0].items[0].created_at_source = "unknown";
    if (invalid.includes("carryover")) {
      result.filters.scope = "carryover"; result.data[0].scope = "carryover"; result.data[0].items = [ownedItem("2026-11-14")];
      if (invalid === "closed-carryover") { result.data[0].bill_state = "closed"; result.data[0].payment_status = "credit_unpaid"; }
      if (invalid === "cancelled-carryover-line") result.data[0].items[0].status = 9;
      if (invalid === "cancelled-carryover-bill") result.data[0].is_cancelled = true;
    }
    vi.mocked(getEmployeeWork).mockResolvedValueOnce(result);
    await expect(useEmployeeWorkStore.getState().load({ scope: result.filters.scope })).rejects.toThrow();
    expect(useEmployeeWorkStore.getState()).toMatchObject({ response: null, report: null, loading: false });
  });

  it("keeps today's own additions separate from prior-day own lines on the same unclosed bill", async () => {
    const today = response();
    today.data[0].items[0].created_at_source = "stored_item_time";
    today.data[0].time_warning = "ITEM_TIME_IS_RECORD_TIME";
    vi.mocked(getEmployeeWork).mockResolvedValueOnce(today);
    await useEmployeeWorkStore.getState().load();
    expect(useEmployeeWorkStore.getState().response?.data[0].items[0].business_date).toBe("2026-11-15");
    const prior = response(); prior.filters.scope = "carryover";
    const item = ownedItem("2026-11-14", "prior-item");
    prior.data[0] = { ...prior.data[0], scope: "carryover", first_item_at: item.created_at, last_item_at: item.created_at, items: [item] };
    vi.mocked(getEmployeeWork).mockResolvedValueOnce(prior);
    await useEmployeeWorkStore.getState().load({ scope: "carryover" });
    expect(useEmployeeWorkStore.getState().response?.data[0].order_uuid).toBe(today.data[0].order_uuid);
    expect(useEmployeeWorkStore.getState().response?.data[0].items[0].order_it_uuid).toBe("prior-item");
    expect(useEmployeeWorkStore.getState().response?.data[0].items.some(row => row.order_it_uuid === today.data[0].items[0].order_it_uuid)).toBe(false);
  });

  it("accepts unknown-date own items only in the separate actionable undated scope", async () => {
    const result = response(); result.filters.scope = "undated";
    result.data[0] = { ...result.data[0], scope: "undated", first_item_at: null, last_item_at: null, time_warning: "ITEM_TIME_UNVERIFIED", items: [{ ...ownedItem(), created_at: null, created_at_source: "unknown", business_date: null }] };
    vi.mocked(getEmployeeWork).mockResolvedValueOnce(result);
    await useEmployeeWorkStore.getState().load({ scope: "undated" });
    expect(useEmployeeWorkStore.getState().response).toBe(result);
  });

  it("rejects a foreign line in an otherwise complete own-items report", async () => {
    vi.mocked(getEmployeeWork).mockResolvedValueOnce(response());
    await useEmployeeWorkStore.getState().load();
    const report = response(); report.report.complete = true;
    report.data[0].items[0].created_by = "another-employee";
    vi.mocked(getEmployeeWorkReport).mockResolvedValueOnce(report);
    await expect(useEmployeeWorkStore.getState().loadReport()).rejects.toThrow("another employee");
    expect(useEmployeeWorkStore.getState()).toMatchObject({ report: null, reportLoading: false });
  });

  it("loads every filtered report record with its pinned business day and invalidates prepared output on reset", async () => {
    const page = response(); page.pagination.total = 2; page.pagination.total_pages = 2;
    vi.mocked(getEmployeeWork).mockResolvedValueOnce(page);
    await useEmployeeWorkStore.getState().load();
    const complete = { ...page, data: [order(), order("2026-11-15", "bill-2")], summary: { ...page.summary, order_count: 2, item_count: 2, quantity: 2, total_amount: 20000 }, report: { complete: true, max_orders: 1000 } };
    vi.mocked(getEmployeeWorkReport).mockResolvedValueOnce(complete);
    expect(await useEmployeeWorkStore.getState().loadReport()).toBe(complete);
    expect(getEmployeeWorkReport).toHaveBeenCalledWith(expect.objectContaining({ business_date: page.business_day.date, scope: "current" }));
    expect(useEmployeeWorkStore.getState().isCurrentReport(complete)).toBe(true);
    resetSessionStores();
    expect(useEmployeeWorkStore.getState().isCurrentReport(complete)).toBe(false);
  });

  it("rejects incomplete full-report data without turning the visible page into a report", async () => {
    vi.mocked(getEmployeeWork).mockResolvedValueOnce(response());
    await useEmployeeWorkStore.getState().load();
    vi.mocked(getEmployeeWorkReport).mockResolvedValueOnce(response());
    await expect(useEmployeeWorkStore.getState().loadReport()).rejects.toThrow("complete work report");
    expect(useEmployeeWorkStore.getState()).toMatchObject({ report: null, reportLoading: false });
  });

  it.each(["day", "lease", "filters"])("silently drops a late failed report after %s invalidation", async invalidation => {
    vi.mocked(getEmployeeWork).mockResolvedValueOnce(response("2026-11-15T04:59:59+07:00"));
    await useEmployeeWorkStore.getState().load();
    const failure = deferred<EmployeeWorkResponse>();
    vi.mocked(getEmployeeWorkReport).mockReturnValueOnce(failure.promise);
    const printing = useEmployeeWorkStore.getState().loadReport();
    if (invalidation === "day") {
      monotonic = 1000;
      vi.mocked(getEmployeeWork).mockResolvedValueOnce(response("2026-11-15T05:00:00+07:00"));
      useEmployeeWorkStore.getState().checkRollover();
    } else if (invalidation === "lease") useEmployeeWorkStore.getState().enter();
    else {
      const next = response("2026-11-15T04:59:59+07:00"); next.filters.search = "new";
      vi.mocked(getEmployeeWork).mockResolvedValueOnce(next);
      await useEmployeeWorkStore.getState().load({ search: "new" });
    }
    failure.reject(new ServiceError("Old report failed", invalidation === "day" ? 500 : 413));
    await expect(printing).resolves.toBeNull();
    expect(useEmployeeWorkStore.getState()).toMatchObject({ report: null, reportError: null, reportLoading: false });
  });

  it("preserves a current report limit failure so the UI can show its 413 guidance", async () => {
    vi.mocked(getEmployeeWork).mockResolvedValueOnce(response());
    await useEmployeeWorkStore.getState().load();
    const failure = new ServiceError("Report too large", 413);
    vi.mocked(getEmployeeWorkReport).mockRejectedValueOnce(failure);
    await expect(useEmployeeWorkStore.getState().loadReport()).rejects.toBe(failure);
    expect(useEmployeeWorkStore.getState()).toMatchObject({ report: null, reportError: "Report too large", reportLoading: false });
  });
});
