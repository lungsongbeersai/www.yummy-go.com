import { describe, expect, it } from "vitest";
import type { CashflowReportCategory } from "@/services/cashflow";
import { cashflowCategorySeries } from "./income-expenses-category-series";

const categories: CashflowReportCategory[] = [
  { category_uuid: "sales", category_name: "Sales", direction: "income", income: 1700, expense: 0, balance: 1700 },
  { category_uuid: "shared", category_name: "General", direction: "both", income: 200, expense: 30, balance: 170 },
  { category_uuid: "supplies", category_name: "Supplies", direction: "expense", income: 0, expense: 20, balance: -20 },
];

describe("cashflow category chart series", () => {
  it("keeps sales distinct and includes a shared category in both directions", () => {
    const income = cashflowCategorySeries(categories, "income");
    const expense = cashflowCategorySeries(categories, "expense");
    expect(income.map((row) => [row.categoryUuid, row.amount])).toEqual([["sales", 1700], ["shared", 200]]);
    expect(expense.map((row) => [row.categoryUuid, row.amount])).toEqual([["shared", 30], ["supplies", 20]]);
    expect(income.reduce((total, row) => total + row.amount, 0)).toBe(1900);
    expect(expense.reduce((total, row) => total + row.amount, 0)).toBe(50);
    expect(income[0].share).toBeCloseTo(1700 / 1900 * 100);
    expect(expense[0].share).toBe(60);
    expect(expense.reduce((total, row) => total + row.share, 0)).toBe(100);
  });

  it("omits empty categories without changing backend amounts or order", () => {
    const before = structuredClone(categories);
    expect(cashflowCategorySeries([], "income")).toEqual([]);
    expect(cashflowCategorySeries([{ ...categories[0], income: 0 }], "income")).toEqual([]);
    cashflowCategorySeries(categories, "expense");
    expect(categories).toEqual(before);
  });
});
