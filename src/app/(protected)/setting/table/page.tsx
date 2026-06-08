import { TableSettingsPage } from "@/features/settings/table/table-page";
import { parseUrlPagination, type UrlSearchParamsRecord } from "@/lib/url-pagination";

type SearchParams = Promise<UrlSearchParamsRecord>;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;

  return <TableSettingsPage initialPagination={parseUrlPagination(params)} />;
}