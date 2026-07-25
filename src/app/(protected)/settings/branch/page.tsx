import type { Metadata } from "next";
import { StoreBranchSettingsPage } from "@/features/settings/store-branch/store-branch-settings-page";
import { parseUrlPagination } from "@/lib/url-pagination";

export const metadata: Metadata = {
  title: "ສາຂາ",
};

export default async function Page(props: PageProps<"/settings/branch">) {
  const params = await props.searchParams;

  return <StoreBranchSettingsPage initialPagination={parseUrlPagination(params)} kind="branch" />;
}
