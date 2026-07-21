import type { Metadata } from "next";
import { CustomerSettingsPage } from "@/features/settings/customer/customer-page";
import { parseUrlPagination } from "@/lib/url-pagination";

export const metadata: Metadata = {
  title: "ລູກຄ້າ",
};

export default async function Page(props: PageProps<"/setting/customer">) {
  const params = await props.searchParams;

  return <CustomerSettingsPage initialPagination={parseUrlPagination(params)} />;
}