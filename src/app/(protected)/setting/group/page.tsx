import { GroupSettingsPage } from "@/features/settings/group/group-page";
import { parseUrlPagination, type UrlSearchParamsRecord } from "@/lib/url-pagination";

type SearchParams = Promise<UrlSearchParamsRecord>;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;

  return <GroupSettingsPage initialPagination={parseUrlPagination(params)} />;
}