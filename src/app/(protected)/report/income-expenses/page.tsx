import type { Metadata } from "next";
import { IncomeExpensesReportPage } from "@/features/report/income-expenses/income-expenses-report-page";

export const metadata: Metadata = { title: "ລາຍງານລາຍຮັບ–ລາຍຈ່າຍ" };

export default function IncomeExpensesReportRoute() {
  return <IncomeExpensesReportPage />;
}
