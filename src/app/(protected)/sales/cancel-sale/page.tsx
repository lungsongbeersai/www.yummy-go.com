import { CancelSalePage } from "@/features/sales/cancel-sale/cancel-sale-page";
import { INITIAL_DATE_SELECT, SALES_LIST_LIMIT_OPTIONS } from "@/features/sales/cancel-sale/cancel-sale-utils";
import { firstUrlParam, parseUrlPagination } from "@/lib/url-pagination";

export default async function Page(props: PageProps<"/sales/cancel-sale">) {
  const params = await props.searchParams;
  const dateSelect = firstUrlParam(params.date_select) === "yesterday" ? "yesterday" : INITIAL_DATE_SELECT;

  return (
    <CancelSalePage
      initialDateSelect={dateSelect}
      initialOrderUuid={firstUrlParam(params.order_uuid).trim()}
      initialPagination={parseUrlPagination(params, { limitOptions: SALES_LIST_LIMIT_OPTIONS })}
    />
  );
}
