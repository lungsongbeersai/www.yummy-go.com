import { SalesListPage } from "@/features/sales/list/sales-list-page";
import { INITIAL_DATE_SELECT, SALES_LIST_LIMIT_OPTIONS } from "@/features/sales/list/sales-list-utils";
import { parseUrlPagination, type UrlSearchParamsRecord } from "@/lib/url-pagination";

type SearchParams = Promise<UrlSearchParamsRecord>;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const dateSelect = firstParam(params.date_select) === "yesterday" ? "yesterday" : INITIAL_DATE_SELECT;

  return (
    <SalesListPage
      initialDateSelect={dateSelect}
      initialOrderUuid={firstParam(params.order_uuid).trim()}
      initialPagination={parseUrlPagination(params, { limitOptions: SALES_LIST_LIMIT_OPTIONS })}
    />
  );
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
