import { beforeEach, describe, expect, it, vi } from "vitest";
import * as cashflow from "@/services/cashflow";
import type { CashflowCategory, CashflowEntriesResponse, CashflowReport } from "@/services/cashflow";
import { useCashflowStore } from "./cashflow-store";
import { resetSessionStores } from "./session-store-registry";

vi.mock("@/services/cashflow", async (original) => ({
  ...await original<typeof import("@/services/cashflow")>(),
  getCashflowCategories: vi.fn(), getCashflowEntries: vi.fn(), getCashflowReport: vi.fn(),
  saveCashflowCategory: vi.fn(), deleteCashflowCategory: vi.fn(), saveCashflowEntry: vi.fn(), deleteCashflowEntry: vi.fn(),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

const category: CashflowCategory = { category_uuid: "category", branch_uuid: "one", name: "Utilities", direction: "expense", is_active: true, created_at: "", updated_at: "" };
const summary = { sales_income: 100, other_income: 20, income_total: 120, shop_expense: 10, other_expense: 5, expense_total: 15, balance: 105 };
const report: CashflowReport = { branch_uuid: "one", date_from: "2026-11-01", date_to: "2026-11-23", summary, daily: [], categories: [] };
const params = { branch_uuid: "one", date_from: "2026-11-01", date_to: "2026-11-23" };

beforeEach(() => { vi.clearAllMocks(); useCashflowStore.getState().reset(); });

describe("cashflow store branch and session isolation", () => {
  it("clears all financial data as soon as a different branch starts loading", async () => {
    vi.mocked(cashflow.getCashflowCategories).mockResolvedValueOnce([category]);
    vi.mocked(cashflow.getCashflowReport).mockResolvedValueOnce(report);
    await useCashflowStore.getState().loadCategories(params);
    await useCashflowStore.getState().loadReport(params);
    const pending = deferred<CashflowCategory[]>();
    vi.mocked(cashflow.getCashflowCategories).mockReturnValueOnce(pending.promise);
    const request = useCashflowStore.getState().loadCategories({ branch_uuid: "two" });
    expect(useCashflowStore.getState()).toMatchObject({ branchUuid: "two", categoriesBranchUuid: "two", categories: [], report: null, categoriesLoading: true });
    pending.resolve([]);
    await request;
  });

  it("cannot repopulate the new branch from a late old branch response", async () => {
    const old = deferred<CashflowCategory[]>();
    vi.mocked(cashflow.getCashflowCategories).mockReturnValueOnce(old.promise).mockResolvedValueOnce([]);
    const oldRequest = useCashflowStore.getState().loadCategories({ branch_uuid: "one" });
    await useCashflowStore.getState().loadCategories({ branch_uuid: "two" });
    old.resolve([category]);
    await oldRequest;
    expect(useCashflowStore.getState()).toMatchObject({ branchUuid: "two", categories: [] });
  });

  it("keeps the newest report when date filters complete out of order", async () => {
    const older = deferred<CashflowReport>();
    vi.mocked(cashflow.getCashflowReport).mockReturnValueOnce(older.promise).mockResolvedValueOnce({ ...report, summary: { ...summary, balance: 900 } });
    const first = useCashflowStore.getState().loadReport(params);
    const newestParams = { ...params, date_from: "2026-11-10", source: "sales" as const };
    await useCashflowStore.getState().loadReport(newestParams);
    older.resolve(report);
    await first;
    expect(useCashflowStore.getState().report?.summary.balance).toBe(900);
    expect(useCashflowStore.getState().reportParams).toEqual(newestParams);
    expect(useCashflowStore.getState().reportParams).not.toBe(newestParams);
  });

  it("publishes only the successful request's original filters and clears them during a new load", async () => {
    vi.mocked(cashflow.getCashflowReport).mockResolvedValueOnce(report);
    await useCashflowStore.getState().loadReport(params);
    const pending = deferred<CashflowReport>();
    vi.mocked(cashflow.getCashflowReport).mockReturnValueOnce(pending.promise);
    const next = { ...params, date_from: "2026-11-10" };
    const request = useCashflowStore.getState().loadReport(next);
    expect(useCashflowStore.getState()).toMatchObject({ report: null, reportParams: null, reportLoading: true });
    next.date_from = "2026-11-20";
    pending.resolve(report);
    await request;
    expect(useCashflowStore.getState().reportParams?.date_from).toBe("2026-11-10");
    expect(vi.mocked(cashflow.getCashflowReport).mock.calls[1][0].date_from).toBe("2026-11-10");
  });

  it("resets data and rejects stale state updates when the login session changes", async () => {
    const pending = deferred<CashflowReport>();
    vi.mocked(cashflow.getCashflowReport).mockReturnValueOnce(pending.promise);
    const request = useCashflowStore.getState().loadReport(params);
    resetSessionStores();
    pending.resolve(report);
    await request;
    expect(useCashflowStore.getState()).toMatchObject({ report: null, reportParams: null, reportLoading: false, branchUuid: "" });
  });

  it("keeps actual request failures visible and clears previous report totals", async () => {
    vi.mocked(cashflow.getCashflowReport).mockResolvedValueOnce(report).mockRejectedValueOnce(new Error("Permission revoked"));
    await useCashflowStore.getState().loadReport(params);
    await expect(useCashflowStore.getState().loadReport(params)).rejects.toThrow("Permission revoked");
    expect(useCashflowStore.getState()).toMatchObject({ report: null, reportParams: null, reportLoading: false, reportError: "Permission revoked" });
  });

  it("does not let a completed archived category write into a later branch", async () => {
    const pending = deferred<void>();
    vi.mocked(cashflow.deleteCashflowCategory).mockReturnValueOnce(pending.promise);
    vi.mocked(cashflow.getCashflowCategories).mockResolvedValueOnce([{ ...category, branch_uuid: "two", name: "Second branch" }]);
    const mutation = useCashflowStore.getState().removeCategory("category", "one");
    await useCashflowStore.getState().loadCategories({ branch_uuid: "two" });
    pending.resolve();
    await mutation;
    expect(useCashflowStore.getState()).toMatchObject({ branchUuid: "two", saving: false });
    expect(useCashflowStore.getState().categories[0].is_active).toBe(true);
  });

  it("retains loading for concurrent mutations and propagates version conflicts", async () => {
    const first = deferred<void>();
    const second = deferred<void>();
    vi.mocked(cashflow.deleteCashflowEntry).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const one = useCashflowStore.getState().removeEntry("one", 2, "branch");
    const two = useCashflowStore.getState().removeEntry("two", 4, "branch");
    first.resolve();
    await one;
    expect(useCashflowStore.getState().saving).toBe(true);
    second.reject(new Error("Entry version conflict"));
    await expect(two).rejects.toThrow("Entry version conflict");
    expect(useCashflowStore.getState()).toMatchObject({ saving: false, error: "Entry version conflict" });
  });

  it("uses nested server pagination when loading manual entries", async () => {
    vi.mocked(cashflow.getCashflowEntries).mockResolvedValueOnce({ status: "success", message: "", data: [],
      pagination: { page: 2, limit: 20, total: 23, totalPages: 2 } } satisfies CashflowEntriesResponse);
    await useCashflowStore.getState().loadEntries({ branch_uuid: "one", page: 2 });
    expect(useCashflowStore.getState()).toMatchObject({ total: 23, totalPages: 2, entriesLoading: false, entriesBranchUuid: "one" });
  });
});
