import type { Metadata } from "next";
import { TableSettingsPage } from "@/features/settings/table/table-page";
import { parseUrlPagination } from "@/lib/url-pagination";

export const metadata: Metadata = {
  title: "ໂຕະ",
};

export default async function Page(props: PageProps<"/settings/table">) {
  const params = await props.searchParams;

  return <TableSettingsPage initialPagination={parseUrlPagination(params)} />;
}