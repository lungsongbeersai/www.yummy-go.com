import { TableSettingsPage } from "@/features/settings/table/table-page";
import { parseUrlPagination } from "@/lib/url-pagination";

export default async function Page(props: PageProps<"/setting/table">) {
  const params = await props.searchParams;

  return <TableSettingsPage initialPagination={parseUrlPagination(params)} />;
}