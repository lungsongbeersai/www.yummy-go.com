import type { Metadata } from "next";
import { CashflowCategoriesPage } from "@/features/cashflow/cashflow-categories-page";

export const metadata: Metadata = { title: "ປະເພດລາຍຮັບ–ລາຍຈ່າຍ" };

export default function Page() {
  return <CashflowCategoriesPage />;
}
