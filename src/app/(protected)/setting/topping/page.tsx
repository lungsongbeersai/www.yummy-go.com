import { ToppingSettingsPage } from "@/features/settings/topping/topping-page";
import { parseUrlPagination, type UrlSearchParamsRecord } from "@/lib/url-pagination";

type SearchParams = Promise<UrlSearchParamsRecord>;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;

  return <ToppingSettingsPage initialPagination={parseUrlPagination(params)} />;
}