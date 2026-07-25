import type { Metadata } from "next";
import { ZoneSettingsPage } from "@/features/settings/zone/zone-page";
import { parseUrlPagination } from "@/lib/url-pagination";

export const metadata: Metadata = {
  title: "ໂຊນ",
};

export default async function Page(props: PageProps<"/settings/zone">) {
  const params = await props.searchParams;

  return <ZoneSettingsPage initialPagination={parseUrlPagination(params)} />;
}