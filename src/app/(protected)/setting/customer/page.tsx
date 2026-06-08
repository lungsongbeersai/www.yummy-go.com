import { CustomerSettingsPage } from "@/features/settings/customer/customer-page";
import { parseUrlPagination, type UrlSearchParamsRecord } from "@/lib/url-pagination";

type SearchParams = Promise<UrlSearchParamsRecord>;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;

  return <CustomerSettingsPage initialPagination={parseUrlPagination(params)} />;
}