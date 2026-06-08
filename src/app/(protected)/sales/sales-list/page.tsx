import { SalesListPage } from "@/features/sales/list/sales-list-page";
import { parseUrlPagination, type UrlSearchParamsRecord } from "@/lib/url-pagination";

type SearchParams = Promise<UrlSearchParamsRecord>;
const SALES_LIST_LIMIT_OPTIONS = [20, 50, 100, 200];

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;

  return <SalesListPage initialPagination={parseUrlPagination(params, { limitOptions: SALES_LIST_LIMIT_OPTIONS })} />;
}
