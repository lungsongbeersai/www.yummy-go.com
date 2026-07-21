import type { Metadata } from "next";
import { SizeSettingsPage } from "@/features/settings/size/size-page";
import { parseUrlPagination } from "@/lib/url-pagination";

export const metadata: Metadata = {
  title: "ຂະໜາດ",
};

export default async function Page(props: PageProps<"/setting/size">) {
  const params = await props.searchParams;

  return <SizeSettingsPage initialPagination={parseUrlPagination(params)} />;
}