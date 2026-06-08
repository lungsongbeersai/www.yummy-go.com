import { CategorySettingsPage } from "@/features/settings/category/category-page";
import { parseUrlPagination, type UrlSearchParamsRecord } from "@/lib/url-pagination";

type SearchParams = Promise<UrlSearchParamsRecord>;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;

  return <CategorySettingsPage initialPagination={parseUrlPagination(params)} />;
}