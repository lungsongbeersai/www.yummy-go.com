import { BestSellingProductsReportPage } from "@/features/report/best-selling-products/best-selling-products-report-page";
import { parseUrlPagination, type UrlSearchParamsRecord } from "@/lib/url-pagination";

type SearchParams = Promise<UrlSearchParamsRecord>;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;

  return <BestSellingProductsReportPage initialPagination={parseUrlPagination(params)} />;
}
