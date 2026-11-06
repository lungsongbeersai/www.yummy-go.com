import type { Metadata } from "next";
import { MySalesPage } from "@/features/sales/my-sales/my-sales-page";
import { MY_SALES_LIMIT_OPTIONS } from "@/features/sales/my-sales/my-sales-options";
import { parseUrlPagination } from "@/lib/url-pagination";

export const metadata: Metadata = {
  title: "ອໍເດີຂອງຂ້ອຍ",
};

export default async function Page(props: PageProps<"/my_orders">) {
  const params = await props.searchParams;
  return <MySalesPage initialPagination={parseUrlPagination(params, { limitOptions: MY_SALES_LIMIT_OPTIONS })} />;
}
