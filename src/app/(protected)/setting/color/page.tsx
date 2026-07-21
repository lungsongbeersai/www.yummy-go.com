import type { Metadata } from "next";
import { ColorSettingsPage } from "@/features/settings/color/color-page";
import { parseUrlPagination } from "@/lib/url-pagination";

export const metadata: Metadata = {
  title: "ສີ",
};

export default async function Page(props: PageProps<"/setting/color">) {
  const params = await props.searchParams;

  return <ColorSettingsPage initialPagination={parseUrlPagination(params)} />;
}