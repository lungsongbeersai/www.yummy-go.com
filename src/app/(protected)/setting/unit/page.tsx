import { UnitSettingsPage } from "@/features/settings/unit/unit-page";
import { parseUrlPagination } from "@/lib/url-pagination";

export default async function Page(props: PageProps<"/setting/unit">) {
  const params = await props.searchParams;

  return <UnitSettingsPage initialPagination={parseUrlPagination(params)} />;
}