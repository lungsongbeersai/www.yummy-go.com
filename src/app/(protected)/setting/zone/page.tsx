import { ZoneSettingsPage } from "@/features/settings/zone/zone-page";
import { parseUrlPagination, type UrlSearchParamsRecord } from "@/lib/url-pagination";

type SearchParams = Promise<UrlSearchParamsRecord>;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;

  return <ZoneSettingsPage initialPagination={parseUrlPagination(params)} />;
}