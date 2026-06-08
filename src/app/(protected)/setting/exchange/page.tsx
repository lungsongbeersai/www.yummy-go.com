import { ExchangeSettingsPage } from "@/features/settings/exchange/exchange-page";
import { parseUrlPagination, type UrlSearchParamsRecord } from "@/lib/url-pagination";

type SearchParams = Promise<UrlSearchParamsRecord>;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;

  return <ExchangeSettingsPage initialPagination={parseUrlPagination(params)} />;
}