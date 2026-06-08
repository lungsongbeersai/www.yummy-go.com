import { CancelHistoryPage } from "@/features/sales/cancel-history/cancel-history-page";
import { CANCEL_HISTORY_LIMIT_OPTIONS } from "@/features/sales/cancel-history/cancel-history-utils";
import { parseUrlPagination, type UrlSearchParamsRecord } from "@/lib/url-pagination";

type SearchParams = Promise<UrlSearchParamsRecord>;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;

  return <CancelHistoryPage initialPagination={parseUrlPagination(params, { limitOptions: CANCEL_HISTORY_LIMIT_OPTIONS })} />;
}
