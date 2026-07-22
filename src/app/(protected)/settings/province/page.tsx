import type { Metadata } from "next";
import { LocationSettingsPage } from "@/features/settings/location/location-settings-page";
import { parseUrlPagination } from "@/lib/url-pagination";

export const metadata: Metadata = {
  title: "ແຂວງ",
};

export default async function Page(props: PageProps<"/settings/province">) {
  const params = await props.searchParams;

  return <LocationSettingsPage initialPagination={parseUrlPagination(params)} kind="province" />;
}
