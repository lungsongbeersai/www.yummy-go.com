import { CancelHistoryPage } from "@/features/sales/cancel-history/cancel-history-page";
import { CANCEL_HISTORY_LIMIT_OPTIONS } from "@/features/sales/cancel-history/cancel-history-utils";
import { parseUrlPagination } from "@/lib/url-pagination";

export default async function Page(props: PageProps<"/sales/cancel-history">) {
  const params = await props.searchParams;

  return <CancelHistoryPage initialPagination={parseUrlPagination(params, { limitOptions: CANCEL_HISTORY_LIMIT_OPTIONS })} />;
}
