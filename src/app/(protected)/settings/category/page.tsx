import type { Metadata } from "next";
import { CategorySettingsPage } from "@/features/settings/category/category-page";
import { parseUrlPagination } from "@/lib/url-pagination";

export const metadata: Metadata = {
  title: "ໝວດໝູ່",
};

export default async function Page(props: PageProps<"/settings/category">) {
  const params = await props.searchParams;

  return <CategorySettingsPage initialPagination={parseUrlPagination(params)} />;
}