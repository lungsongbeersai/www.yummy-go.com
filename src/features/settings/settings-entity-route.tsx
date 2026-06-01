"use client";

import { LocationSettingsPage } from "@/features/settings/location-settings-page";
import { SETTINGS } from "@/features/settings/settings-config";
import { SettingsEntityPage } from "@/features/settings/settings-entity-page";
import { StoreBranchSettingsPage } from "@/features/settings/store-branch-settings-page";

export function SettingsEntityRoute({ entity }: { entity: string }) {
  const config = SETTINGS[entity];
  if (!config) return null;
  if (entity === "store" || entity === "branch") return <StoreBranchSettingsPage kind={entity} />;
  if (entity === "province" || entity === "district") return <LocationSettingsPage kind={entity} />;
  return <SettingsEntityPage config={config} />;
}
