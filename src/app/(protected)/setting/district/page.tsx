import type { Metadata } from "next";
import { LocationSettingsPage } from "@/features/settings/location/location-settings-page";
import { parseUrlPagination } from "@/lib/url-pagination";

export const metadata: Metadata = {
  title: "ເມືອງ",
};

export default async function Page(props: PageProps<"/setting/district">) {
  const params = await props.searchParams;

  return <LocationSettingsPage initialPagination={parseUrlPagination(params)} kind="district" />;
}
