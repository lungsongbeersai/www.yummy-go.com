import { UserSettingsPage } from "@/features/settings/user/user-page";
import { parseUrlPagination, type UrlSearchParamsRecord } from "@/lib/url-pagination";

type SearchParams = Promise<UrlSearchParamsRecord>;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;

  return <UserSettingsPage initialPagination={parseUrlPagination(params)} />;
}