import { STOCK_PAGE_LIMIT_OPTIONS } from "@/features/stock/stock-constants";
import { StockPage } from "@/features/stock/stock-page";
import {
  parseUrlPagination,
  type UrlSearchParamsRecord,
} from "@/lib/url-pagination";

type SearchParams = Promise<UrlSearchParamsRecord>;

export default async function Page({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;

  return (
    <StockPage
      initialPagination={parseUrlPagination(params, {
        limitOptions: [...STOCK_PAGE_LIMIT_OPTIONS],
      })}
    />
  );
}
