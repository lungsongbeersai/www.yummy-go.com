"use client";

import { LocationSettingsPage } from "@/features/settings/location/location-settings-page";
import { SETTINGS } from "@/features/settings/shared/settings-config";
import { SettingsEntityPage } from "@/features/settings/shared/settings-entity-page";
import { StoreBranchSettingsPage } from "@/features/settings/store-branch/store-branch-settings-page";
import type { UrlPaginationState } from "@/lib/url-pagination";

export function SettingsEntityRoute({ entity, initialPagination }: { entity: string; initialPagination: UrlPaginationState }) {
  const config = SETTINGS[entity];
  if (!config) return null;
  if (entity === "store" || entity === "branch") return <StoreBranchSettingsPage initialPagination={initialPagination} kind={entity} />;
  if (entity === "province" || entity === "district") return <LocationSettingsPage initialPagination={initialPagination} kind={entity} />;
  return <SettingsEntityPage config={config} initialPagination={initialPagination} />;
}
