import { DailySalesReportPage } from "@/features/report/daily-sales/daily-sales-report-page";
import { parseUrlPagination, type UrlSearchParamsRecord } from "@/lib/url-pagination";

type SearchParams = Promise<UrlSearchParamsRecord>;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;

  return <DailySalesReportPage initialPagination={parseUrlPagination(params)} />;
}
