import { SalesListPage } from "@/features/sales/list/sales-list-page";
import { SALES_LIST_LIMIT_OPTIONS } from "@/features/sales/list/sales-list-utils";
import { parseUrlPagination, type UrlSearchParamsRecord } from "@/lib/url-pagination";

type SearchParams = Promise<UrlSearchParamsRecord>;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;

  return <SalesListPage initialPagination={parseUrlPagination(params, { limitOptions: SALES_LIST_LIMIT_OPTIONS })} />;
}
