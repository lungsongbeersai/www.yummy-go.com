import { beforeEach, describe, expect, it, vi } from "vitest";
import { cashflowBranchUuid, deleteCashflowCategory, deleteCashflowEntry, getCashflowCategories,
  getCashflowEntries, getCashflowReport, saveCashflowCategory, saveCashflowEntry } from "./cashflow";

const mocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/lib/api", () => ({ apiRequest: mocks.request, ServiceError: class extends Error {} }));

const entry = { entry_uuid: "entry", branch_uuid: "branch", category_uuid_fk: "category", category_name: "Utilities",
  entry_date: "2026-11-23", direction: "expense", expense_group: "shop", amount: "12.50", currency: "THB",
  exchange_rate: "650", base_amount: "8125", description: "Electricity", reference: "INV-1", note: "",
  payment_method: "cash", version: "2", created_at: "", updated_at: "" };
const summary = { sales_income: "100000", other_income: "10000", income_total: "110000",
  shop_expense: "8125", other_expense: "0", expense_total: "8125", balance: "101875" };

beforeEach(() => { mocks.request.mockReset(); });

describe("cashflow service scope and financial payloads", () => {
  it("rejects an absent branch before making any financial request", async () => {
    expect(() => cashflowBranchUuid({})).toThrow("branch_uuid");
    await expect(getCashflowReport({ date_from: "2026-11-01", date_to: "2026-11-23" })).rejects.toThrow("branch_uuid");
    expect(mocks.request).not.toHaveBeenCalled();
  });

  it("loads branch categories including inactive historic labels with API language normalization", async () => {
    mocks.request.mockResolvedValue({ data: [{ category_uuid: "category", is_active: false }] });
    await expect(getCashflowCategories({ branch_uuid_fk: " branch ", include_inactive: true, lang: "en" })).resolves.toEqual([
      { category_uuid: "category", is_active: false },
    ]);
    expect(mocks.request.mock.calls[0][2].params).toEqual({ branch_uuid: "branch", include_inactive: true, lang: "eng" });
  });

  it("sends the edited category only to its explicit branch and retains deliberate inactive state", async () => {
    mocks.request.mockResolvedValue({ data: { category_uuid: "category" } });
    await saveCashflowCategory({ branch_uuid_fk: "branch", category_uuid: "category", name: " Utilities ",
      direction: "both", is_active: false });
    expect(mocks.request.mock.calls[0][2].data).toEqual({ branch_uuid: "branch", category_uuid: "category",
      name: "Utilities", direction: "both", is_active: false });
  });

  it("normalizes numeric strings and nested pagination without mixing foreign branch request data", async () => {
    mocks.request.mockResolvedValue({ data: [entry], pagination: { page: 2, limit: 20, total: 30, totalPages: 2 } });
    const result = await getCashflowEntries({ branch_uuid_fk: "branch", page: 2, direction: "expense", category_uuid_fk: "category" });
    expect(result.data[0]).toMatchObject({ amount: 12.5, exchange_rate: 650, base_amount: 8125, version: 2 });
    expect(result.total).toBe(30);
    expect(mocks.request.mock.calls[0][2].params).toMatchObject({ branch_uuid: "branch", page: 2, direction: "expense", category_uuid_fk: "category" });
    expect(mocks.request.mock.calls[0][2].params).not.toHaveProperty("branch_uuid_fk");
  });

  it("preserves retry identity/version but never forwards a forged rate or manual sales source", async () => {
    mocks.request.mockResolvedValue({ data: entry });
    await saveCashflowEntry({ branch_uuid: "branch", entry_uuid: "entry", version: 2, category_uuid_fk: "category",
      entry_date: "2026-11-23", direction: "income", expense_group: "shop", amount: 12.5,
      currency: "THB", description: " Other income ", payment_method: "transfer", exchange_rate: 1, source: "sales" });
    const data = mocks.request.mock.calls[0][2].data;
    expect(data).toMatchObject({ branch_uuid: "branch", entry_uuid: "entry", version: 2,
      description: "Other income", expense_group: null, payment_method: "transfer" });
    expect(data).not.toHaveProperty("exchange_rate");
    expect(data).not.toHaveProperty("source");
  });

  it.each([0, -5, NaN, Infinity])("rejects invalid monetary amount %s without an HTTP request", async (amount) => {
    await expect(saveCashflowEntry({ branch_uuid: "branch", entry_uuid: "entry", category_uuid_fk: "category",
      entry_date: "2026-11-23", direction: "income", amount, currency: "LAK", description: "Other income",
      payment_method: "cash" })).rejects.toThrow("amount");
    expect(mocks.request).not.toHaveBeenCalled();
  });

  it("keeps deletes branch-scoped and entry deletes versioned", async () => {
    mocks.request.mockResolvedValue({ status: "success" });
    await deleteCashflowEntry("entry", 3, "branch");
    await deleteCashflowCategory("category", "branch");
    expect(mocks.request.mock.calls[0]).toEqual(["post", "/api/v1/cashflow/entries/delete", {
      data: { entry_uuid: "entry", version: 3, branch_uuid: "branch" },
    }]);
    expect(mocks.request.mock.calls[1][2].data).toEqual({ category_uuid: "category", branch_uuid: "branch" });
  });

  it("uses the exact filtered report and normalizes server monetary totals", async () => {
    mocks.request.mockResolvedValue({ data: { branch_uuid: "branch", date_from: "2026-11-01", date_to: "2026-11-23",
      summary, daily: [{ date: "2026-11-23", ...summary }],
      categories: [{ category_uuid: "sales", category_name: "Sales", direction: "income", income: "100000", expense: "0", balance: "100000" }] } });
    const result = await getCashflowReport({ branch_uuid: "branch", date_from: "2026-11-01", date_to: "2026-11-23",
      source: "sales", category_uuid_fk: "sales", lang: "en" });
    expect(result.summary.balance).toBe(101875);
    expect(result.daily[0].income_total).toBe(110000);
    expect(result.categories[0].income).toBe(100000);
    expect(mocks.request.mock.calls[0][2].params).toMatchObject({ source: "sales", category_uuid_fk: "sales", branch_uuid: "branch", lang: "eng" });
  });

  it("surfaces malformed server totals instead of inventing zero income", async () => {
    mocks.request.mockResolvedValue({ data: { branch_uuid: "branch", date_from: "2026-11-01", date_to: "2026-11-23",
      summary: { ...summary, sales_income: null }, daily: [], categories: [] } });
    await expect(getCashflowReport({ branch_uuid: "branch", date_from: "2026-11-01", date_to: "2026-11-23" })).rejects.toThrow("sales_income");
  });

  it.each([
    { branch_uuid: "another-branch" },
    { branch_uuid: undefined },
    { date_from: "2026-10-01" },
    { date_to: "2026-11-22" },
    { date_to: undefined },
  ])("rejects a report for a different branch or date range: %j", async (mismatch) => {
    mocks.request.mockResolvedValue({ data: { branch_uuid: "branch", date_from: "2026-11-01", date_to: "2026-11-23",
      summary, daily: [], categories: [], ...mismatch } });
    await expect(getCashflowReport({ branch_uuid: "branch", date_from: "2026-11-01", date_to: "2026-11-23" }))
      .rejects.toThrow("scope does not match");
  });

  it("matches canonical UUID casing and trimmed request dates without rejecting the selected branch", async () => {
    const branch = "a0000000-0000-4000-8000-000000000001";
    mocks.request.mockResolvedValue({ data: { branch_uuid: branch, date_from: "2026-11-01", date_to: "2026-11-23",
      summary, daily: [], categories: [] } });
    const result = await getCashflowReport({ branch_uuid_fk: ` ${branch.toUpperCase()} `,
      date_from: " 2026-11-01 ", date_to: " 2026-11-23 " });
    expect(result.branch_uuid).toBe(branch);
    expect(mocks.request.mock.calls[0][2].params).toMatchObject({ branch_uuid: branch.toUpperCase(),
      date_from: "2026-11-01", date_to: "2026-11-23" });
  });

  it("propagates transport errors for mutations without a local success", async () => {
    const error = new Error("Backend unavailable");
    mocks.request.mockRejectedValue(error);
    await expect(deleteCashflowEntry("entry", 3, "branch")).rejects.toBe(error);
  });
});
