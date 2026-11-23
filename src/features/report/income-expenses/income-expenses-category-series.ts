import type { CashflowDirection, CashflowReportCategory } from "@/services/cashflow";

export interface CashflowCategorySeriesRow {
  categoryUuid: string;
  name: string;
  amount: number;
  share: number;
}

export function cashflowCategorySeries(
  categories: CashflowReportCategory[],
  direction: CashflowDirection,
): CashflowCategorySeriesRow[] {
  const rows = categories
    .filter((category) => category[direction] > 0)
    .map((category) => ({
      categoryUuid: category.category_uuid,
      name: category.category_name,
      amount: category[direction],
    }))
    .sort((a, b) => b.amount - a.amount || a.categoryUuid.localeCompare(b.categoryUuid));
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  return rows.map((row) => ({ ...row, share: total > 0 ? row.amount / total * 100 : 0 }));
}
