import { notFound } from "next/navigation";
import { SettingsEntityRoute } from "@/features/settings/shared/settings-entity-route";
import { SETTINGS } from "@/features/settings/shared/settings-config";
import { parseUrlPagination, type UrlSearchParamsRecord } from "@/lib/url-pagination";

interface PageProps {
  params: Promise<{ entity: string }>;
  searchParams: Promise<UrlSearchParamsRecord>;
}

export function generateStaticParams() {
  return Object.keys(SETTINGS).map((entity) => ({ entity }));
}

export default async function Page({ params, searchParams }: PageProps) {
  const { entity } = await params;
  const query = await searchParams;
  const config = SETTINGS[entity];
  if (!config) notFound();
  return <SettingsEntityRoute entity={entity} initialPagination={parseUrlPagination(query)} />;
}
