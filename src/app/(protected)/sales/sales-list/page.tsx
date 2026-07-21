import { SalesListPage } from "@/features/sales/sales-list/sales-list-page";
import { SALES_LIST_LIMIT_OPTIONS } from "@/features/sales/sales-list/sales-list-utils";
import { parseUrlPagination } from "@/lib/url-pagination";

export default async function Page(props: PageProps<"/sales/sales-list">) {
  const params = await props.searchParams;

  return <SalesListPage initialPagination={parseUrlPagination(params, { limitOptions: SALES_LIST_LIMIT_OPTIONS })} />;
}
