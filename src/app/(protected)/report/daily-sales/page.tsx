import type { Metadata } from "next";
import { DailySalesReportPage } from "@/features/report/daily-sales/daily-sales-report-page";
import { parseUrlPagination } from "@/lib/url-pagination";

export const metadata: Metadata = {
  title: "ລາຍງານຂາຍປະຈຳວັນ",
};

export default async function Page(props: PageProps<"/report/daily-sales">) {
  const params = await props.searchParams;

  return <DailySalesReportPage initialPagination={parseUrlPagination(params)} />;
}
