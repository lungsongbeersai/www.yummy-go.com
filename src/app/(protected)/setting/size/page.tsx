import { SizeSettingsPage } from "@/features/settings/size/size-page";
import { parseUrlPagination, type UrlSearchParamsRecord } from "@/lib/url-pagination";

type SearchParams = Promise<UrlSearchParamsRecord>;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;

  return <SizeSettingsPage initialPagination={parseUrlPagination(params)} />;
}