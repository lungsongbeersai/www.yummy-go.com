import { SalesListPage } from "@/features/sales/list/sales-list-page";
import { INITIAL_DATE_SELECT, SALES_LIST_LIMIT_OPTIONS } from "@/features/sales/list/sales-list-utils";
import { firstUrlParam, parseUrlPagination, type UrlSearchParamsRecord } from "@/lib/url-pagination";

type SearchParams = Promise<UrlSearchParamsRecord>;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const dateSelect = firstUrlParam(params.date_select) === "yesterday" ? "yesterday" : INITIAL_DATE_SELECT;

  return (
    <SalesListPage
      initialDateSelect={dateSelect}
      initialOrderUuid={firstUrlParam(params.order_uuid).trim()}
      initialPagination={parseUrlPagination(params, { limitOptions: SALES_LIST_LIMIT_OPTIONS })}
    />
  );
}
