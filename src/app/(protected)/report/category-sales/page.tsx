import { CategorySalesReportPage } from "@/features/report/category-sales/category-sales-report-page";
import { parseUrlPagination, type UrlSearchParamsRecord } from "@/lib/url-pagination";

type SearchParams = Promise<UrlSearchParamsRecord>;

export default async function CategorySalesReportRoute({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  return <CategorySalesReportPage initialPagination={parseUrlPagination(params)} />;
}
