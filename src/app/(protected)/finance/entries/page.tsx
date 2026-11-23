import type { Metadata } from "next";
import { CashflowEntriesPage } from "@/features/cashflow/cashflow-entries-page";

export const metadata: Metadata = { title: "ລາຍຮັບ–ລາຍຈ່າຍ" };

export default function Page() {
  return <CashflowEntriesPage />;
}
