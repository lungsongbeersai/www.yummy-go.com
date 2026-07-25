import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OrderCustomerPage } from "@/features/pos/order-customer/order-customer-page";
import { firstUrlParam } from "@/lib/url-pagination";

export const metadata: Metadata = {
  title: "ອໍເດີລູກຄ້າ",
};

export default async function Page(props: PageProps<"/pos/order">) {
  const params = await props.searchParams;
  const tableUuid = firstUrlParam(params.table_uuid);

  if (!tableUuid) redirect("/pos/tables");

  return (
    <OrderCustomerPage
      initialTableUuid={tableUuid}
      initialTableName={firstUrlParam(params.table_name)}
    />
  );
}
