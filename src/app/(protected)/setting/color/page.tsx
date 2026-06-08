import { ColorSettingsPage } from "@/features/settings/color/color-page";
import { parseUrlPagination, type UrlSearchParamsRecord } from "@/lib/url-pagination";

type SearchParams = Promise<UrlSearchParamsRecord>;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;

  return <ColorSettingsPage initialPagination={parseUrlPagination(params)} />;
}