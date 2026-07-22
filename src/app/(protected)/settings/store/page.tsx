import type { Metadata } from "next";
import { StoreBranchSettingsPage } from "@/features/settings/store-branch/store-branch-settings-page";
import { parseUrlPagination } from "@/lib/url-pagination";

export const metadata: Metadata = {
  title: "ຮ້ານ",
};

export default async function Page(props: PageProps<"/settings/store">) {
  const params = await props.searchParams;

  return <StoreBranchSettingsPage initialPagination={parseUrlPagination(params)} kind="store" />;
}
