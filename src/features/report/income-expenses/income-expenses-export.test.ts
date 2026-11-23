import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx-js-style";
import { createReportWorkbook } from "@/lib/export/excel";
import type { CashflowReport } from "@/services/cashflow";
import { cashflowReportWorksheets } from "./income-expenses-export";

const summary = { sales_income: 1000.5, other_income: 250, income_total: 1250.5,
  shop_expense: 2000, other_expense: 50.25, expense_total: 2050.25, balance: -799.75 };
const report: CashflowReport = {
  branch_uuid: "selected-branch", date_from: "2026-11-01", date_to: "2026-11-23", summary,
  daily: [{ date: "2026-11-23", ...summary }],
  categories: [
    { category_uuid: "sales", category_name: "Sales", direction: "income", income: 1000.5, expense: 0, balance: 1000.5 },
    { category_uuid: "shared-category", category_name: "Shared", direction: "both", income: 250, expense: 2050.25, balance: -1800.25 },
  ],
};
const t = (key: string) => key;

describe("income and expense report export", () => {
  it("exports the selected branch and exact filters with saved base-currency totals", () => {
    const sheets = cashflowReportWorksheets(report, "Branch A", ["source: all", "category: all"], t);
    expect(sheets).toHaveLength(3);
    for (const sheet of sheets) {
      expect(sheet.layout?.headerLines).toContain("nav.branch: Branch A");
      expect(sheet.layout?.headerLines).toContain("01/11/2026 - 23/11/2026");
      expect(sheet.layout?.headerLines).toContain("source: all");
      expect(sheet.layout?.headerLines).toContain("cashflow.report.baseCurrencyHint");
    }
    const summaryRows = sheets[0].sections[0];
    expect("rows" in summaryRows && summaryRows.rows.at(-1)).toEqual({
      "report.excel.metric": "cashflow.summary.balance", "report.excel.value": -799.75,
    });
    const dailyRows = sheets[1].sections[0];
    expect("rows" in dailyRows && dailyRows.rows[0]).toMatchObject({
      "cashflow.fields.date": "23/11/2026", "cashflow.summary.salesIncome": 1000.5,
      "cashflow.summary.balance": -799.75,
    });
  });

  it("keeps sales separate and preserves both directions for a shared category", () => {
    const section = cashflowReportWorksheets(report, "Branch A", [], t)[2].sections[0];
    expect("rows" in section && section.rows).toEqual([
      { "cashflow.fields.category": "cashflow.summary.salesIncome", "cashflow.fields.income": 1000.5,
        "cashflow.fields.expense": 0, "cashflow.fields.balance": 1000.5 },
      { "cashflow.fields.category": "Shared", "cashflow.fields.income": 250,
        "cashflow.fields.expense": 2050.25, "cashflow.fields.balance": -1800.25 },
    ]);
  });

  it("produces a readable workbook with numeric negative balances and complete daily rows", () => {
    const workbook = createReportWorkbook(XLSX, cashflowReportWorksheets(report, "Branch A", [], t));
    expect(workbook.SheetNames).toEqual(["Summary", "Daily", "Categories"]);
    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(workbook.Sheets.Daily, { header: 1 });
    expect(rows.some((row) => row[0] === "23/11/2026" && row.includes(-799.75))).toBe(true);
    const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
    const reloaded = XLSX.read(bytes, { type: "buffer" });
    expect(reloaded.SheetNames).toEqual(workbook.SheetNames);
  });
});
