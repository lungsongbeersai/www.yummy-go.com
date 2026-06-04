import { notFound } from "next/navigation";
import { SettingsEntityRoute } from "@/features/settings/shared/settings-entity-route";
import { SETTINGS } from "@/features/settings/shared/settings-config";

interface PageProps {
  params: Promise<{ entity: string }>;
}

export function generateStaticParams() {
  return Object.keys(SETTINGS).map((entity) => ({ entity }));
}

export default async function Page({ params }: PageProps) {
  const { entity } = await params;
  const config = SETTINGS[entity];
  if (!config) notFound();
  return <SettingsEntityRoute entity={entity} />;
}
