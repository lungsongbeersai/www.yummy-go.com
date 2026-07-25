import type { Metadata } from "next";
import { UnitSettingsPage } from "@/features/settings/unit/unit-page";
import { parseUrlPagination } from "@/lib/url-pagination";

export const metadata: Metadata = {
  title: "ຫົວໜ່ວຍ",
};

export default async function Page(props: PageProps<"/settings/unit">) {
  const params = await props.searchParams;

  return <UnitSettingsPage initialPagination={parseUrlPagination(params)} />;
}