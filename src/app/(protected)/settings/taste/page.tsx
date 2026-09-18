import type { Metadata } from "next";
import { TasteSettingsPage } from "@/features/settings/taste/taste-page";
import { parseUrlPagination } from "@/lib/url-pagination";

export const metadata: Metadata = {
  title: "ລົດຊາດ",
};

export default async function Page(props: PageProps<"/settings/taste">) {
  const params = await props.searchParams;

  return <TasteSettingsPage initialPagination={parseUrlPagination(params)} />;
}
