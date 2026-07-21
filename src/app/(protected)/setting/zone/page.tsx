import { ZoneSettingsPage } from "@/features/settings/zone/zone-page";
import { parseUrlPagination } from "@/lib/url-pagination";

export default async function Page(props: PageProps<"/setting/zone">) {
  const params = await props.searchParams;

  return <ZoneSettingsPage initialPagination={parseUrlPagination(params)} />;
}