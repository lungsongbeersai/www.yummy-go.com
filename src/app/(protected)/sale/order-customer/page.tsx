import { redirect } from "next/navigation";
import { OrderCustomerPage } from "@/features/pos/order-customer-page";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const tableUuid = firstParam(params.table_uuid);

  if (!tableUuid) redirect("/sales/open-table-sale");

  return (
    <OrderCustomerPage
      initialTableUuid={tableUuid}
      initialTableName={firstParam(params.table_name)}
    />
  );
}

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}
