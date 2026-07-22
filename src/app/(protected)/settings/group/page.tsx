import type { Metadata } from "next";
import { GroupSettingsPage } from "@/features/settings/group/group-page";
import { parseUrlPagination } from "@/lib/url-pagination";

export const metadata: Metadata = {
  title: "ກຸ່ມອາຫານ",
};

export default async function Page(props: PageProps<"/settings/group">) {
  const params = await props.searchParams;

  return <GroupSettingsPage initialPagination={parseUrlPagination(params)} />;
}