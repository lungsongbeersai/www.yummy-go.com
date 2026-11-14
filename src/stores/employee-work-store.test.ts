import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getEmployeeWork, getEmployeeWorkReport, type EmployeeWorkOrder, type EmployeeWorkResponse } from "@/services/pos";
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

function order(): EmployeeWorkOrder {
  return { order_uuid: "bill", order_invoice: "BILL-1", table_uuid: "table", table_name: "Table 1", zone_name: "Zone", order_created_by: "employee", creator_name: "Employee", order_date: "2026-11-15", opened_at: "2026-11-15T08:00:00+07:00", opened_at_source: "order_audit", opened_at_exact: true, business_date: "2026-11-15", time_warning: null, financial_warning: null, date_time_payment: null, payment_time_source: "unknown", scope: "current", order_check_bill: 1, order_status: 1, is_cancelled: false, bill_state: "open", check_bill_requested: false, kitchen_status: "sent", payment_status: "unpaid", totals: { source: "stored_bill", currency: "LAK", quantity: 1, gross_amount: 10000, item_discount_amount: 0, subtotal: 10000, discount_amount: 0, service_amount: 0, vat_amount: 0, grand_total: 10000, received_total: 0, balance_amount: 10000, credit_balance: 0 }, items: [] };
}

function response(serverNow = "2026-11-15T12:00:00+07:00"): EmployeeWorkResponse {
  const period = employeeWorkPeriod(new Date(serverNow));
  const scope = { order_count: 1, financial_unknown_count: 0, total_amount: 10000, balance_amount: 10000 };
  return { status: "success", message: "OK", server_now: serverNow, ownership_mode: "bill_opener", employee: { login_uuid: "employee", display_name: "Employee", branch_uuid: "branch", branch_name: "Branch", store_uuid: "store" }, business_day: { date: period.businessDay, time_zone: "Asia/Vientiane", cutoff: "05:00", starts_at: period.startsAt, ends_at: period.endsAt, next_reset_at: period.nextBoundaryAt }, filters: { business_date: period.businessDay, scope: "current", search: "", kitchen_status: "all", payment_status: "all", lang: "la" }, data: [order()], summary: { order_count: 1, open_count: 1, pending_kitchen_count: 0, sent_kitchen_count: 1, check_bill_count: 0, unpaid_count: 1, paid_count: 0, credit_count: 0, cancelled_count: 0, financial_unknown_count: 0, total_amount: 10000, balance_amount: 10000, credit_balance_amount: 0 }, scope_summary: { current: scope, carryover: { ...scope, order_count: 0 }, undated: { ...scope, order_count: 0 } }, pagination: { page: 1, limit: 20, total: 1, total_pages: 1 }, report: { complete: false, max_orders: 1000 }, warnings: [] };
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
  it("uses server summary and preserves unknown bill amounts without recomputing zeros", async () => {
    const result = response();
    result.data[0].totals = { ...result.data[0].totals, source: "unknown", grand_total: null, balance_amount: null };
    result.summary = { ...result.summary, financial_unknown_count: 1, total_amount: null, balance_amount: null };
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

  it.each(["employee", "branch", "bill-owner", "filters", "period"])("fails closed on mismatched %s metadata", async mismatch => {
    const result = response();
    if (mismatch === "employee") result.employee.login_uuid = "foreign";
    if (mismatch === "branch") result.employee.branch_uuid = "foreign";
    if (mismatch === "bill-owner") result.data[0].order_created_by = "foreign";
    if (mismatch === "filters") result.filters.search = "other";
    if (mismatch === "period") result.business_day.next_reset_at = "2026-11-17T05:00:00+07:00";
    vi.mocked(getEmployeeWork).mockResolvedValueOnce(result);
    await expect(useEmployeeWorkStore.getState().load()).rejects.toThrow();
    expect(useEmployeeWorkStore.getState()).toMatchObject({ response: null, loading: false });
  });

  it("loads every filtered report record with its pinned business day and invalidates prepared output on reset", async () => {
    const page = response(); page.pagination.total = 2; page.pagination.total_pages = 2;
    vi.mocked(getEmployeeWork).mockResolvedValueOnce(page);
    await useEmployeeWorkStore.getState().load();
    const complete = { ...page, data: [order(), { ...order(), order_uuid: "bill-2" }], report: { complete: true, max_orders: 1000 } };
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
