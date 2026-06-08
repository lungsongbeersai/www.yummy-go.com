import { CurrencySettingsPage } from "@/features/settings/currency/currency-page";
import { parseUrlPagination, type UrlSearchParamsRecord } from "@/lib/url-pagination";

type SearchParams = Promise<UrlSearchParamsRecord>;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;

  return <CurrencySettingsPage initialPagination={parseUrlPagination(params)} />;
}