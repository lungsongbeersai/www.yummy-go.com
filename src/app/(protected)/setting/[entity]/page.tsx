import { notFound } from "next/navigation";
import { SettingsEntityRoute } from "@/features/settings/shared/settings-entity-route";
import { SETTINGS } from "@/features/settings/shared/settings-config";
import { parseUrlPagination } from "@/lib/url-pagination";

export default async function Page(props: PageProps<"/setting/[entity]">) {
  const { entity } = await props.params;
  const query = await props.searchParams;
  const config = SETTINGS[entity];
  if (!config) notFound();
  return <SettingsEntityRoute entity={entity} initialPagination={parseUrlPagination(query)} />;
}
