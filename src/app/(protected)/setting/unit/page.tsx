import { UnitSettingsPage } from "@/features/settings/unit/unit-page";
import { parseUrlPagination, type UrlSearchParamsRecord } from "@/lib/url-pagination";

type SearchParams = Promise<UrlSearchParamsRecord>;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;

  return <UnitSettingsPage initialPagination={parseUrlPagination(params)} />;
}