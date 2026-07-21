import { CustomerSettingsPage } from "@/features/settings/customer/customer-page";
import { parseUrlPagination } from "@/lib/url-pagination";

export default async function Page(props: PageProps<"/setting/customer">) {
  const params = await props.searchParams;

  return <CustomerSettingsPage initialPagination={parseUrlPagination(params)} />;
}