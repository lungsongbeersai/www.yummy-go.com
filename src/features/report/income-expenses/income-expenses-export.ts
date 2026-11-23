import type { CashflowReport, CashflowReportSummary } from "@/services/cashflow";
import type { ReportExcelWorksheet } from "@/lib/export/excel";
import { formatReportDate, formatReportDateRange } from "@/features/report/shared/report-date-format";

export const CASHFLOW_SUMMARY_METRICS = [
  ["sales_income", "salesIncome"],
  ["other_income", "otherIncome"],
  ["income_total", "incomeTotal"],
  ["shop_expense", "shopExpense"],
  ["other_expense", "otherExpense"],
  ["expense_total", "expenseTotal"],
  ["balance", "balance"],
] as const satisfies ReadonlyArray<readonly [keyof CashflowReportSummary, string]>;

export function cashflowReportWorksheets(
  report: CashflowReport,
  branchLabel: string,
  filterLabels: string[],
  t: (key: string) => string,
): ReportExcelWorksheet[] {
  const layout = {
    title: t("cashflow.report.title"),
    headerLines: [
      `${t("nav.branch")}: ${branchLabel}`,
      formatReportDateRange(report.date_from, report.date_to),
      ...filterLabels,
      t("cashflow.report.baseCurrencyHint"),
      t("cashflow.report.salesIncomeHint"),
    ],
  };
  return [
    {
      name: "Summary",
      layout,
      sections: [{
        title: t("report.summary"),
        rows: CASHFLOW_SUMMARY_METRICS.map(([key, label]) => ({
          [t("report.excel.metric")]: t(`cashflow.summary.${label}`),
          [t("report.excel.value")]: report.summary[key],
        })),
      }],
    },
    {
      name: "Daily",
      layout,
      sections: [{
        title: t("cashflow.report.daily"),
        rows: report.daily.map((day) => Object.fromEntries([
          [t("cashflow.fields.date"), formatReportDate(day.date)],
          ...CASHFLOW_SUMMARY_METRICS.map(([key, label]) => [t(`cashflow.summary.${label}`), day[key]]),
        ])),
      }],
    },
    {
      name: "Categories",
      layout,
      sections: [{
        title: t("cashflow.report.categories"),
        rows: report.categories.map((category) => ({
          [t("cashflow.fields.category")]: category.category_uuid === "sales"
            ? t("cashflow.summary.salesIncome") : category.category_name,
          [t("cashflow.fields.income")]: category.income,
          [t("cashflow.fields.expense")]: category.expense,
          [t("cashflow.fields.balance")]: category.balance,
        })),
      }],
    },
  ];
}
