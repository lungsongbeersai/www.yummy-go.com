import { redirect } from "next/navigation";
import { OrderCustomerPage } from "@/features/pos/order-customer/order-customer-page";
import { firstUrlParam } from "@/lib/url-pagination";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const tableUuid = firstUrlParam(params.table_uuid);

  if (!tableUuid) redirect("/sales/open-table-sale");

  return (
    <OrderCustomerPage
      initialTableUuid={tableUuid}
      initialTableName={firstUrlParam(params.table_name)}
    />
  );
}
