"use client";

import { Map } from "lucide-react";
import { useTranslation } from "react-i18next";
import { OptionSettingsPage } from "@/features/settings/option-settings-page";
import type { FetchZonesParams, SaveZoneInput, Zone } from "@/services/zone";
import type { AuthUser } from "@/stores/auth-store";
import { useZoneStore } from "@/stores/zone-store";

const branchScope = (_storeUuid: string, user: AuthUser | null) => ({ branch_uuid_fk: user?.branch_uuid ?? "" });

export function ZoneSettingsPage() {
  const { t } = useTranslation();
  const title = t("settings.modules.zone.title");

  return (
    <OptionSettingsPage<Zone, SaveZoneInput, FetchZonesParams>
      slug="zone"
      itemLabel={t("nav.zone")}
      title={title}
      description={t("settings.modules.zone.description")}
      idKey="zone_uuid"
      nameKey="zone_name"
      nameLaKey="zone_name_la"
      nameEngKey="zone_name_eng"
      icon={Map}
      store={useZoneStore}
      scope={branchScope}
      fields={[
        { name: "zone_name_la", label: t("fields.nameLa"), required: true, fallbackKey: "zone_name" },
        { name: "zone_name_eng", label: t("fields.nameEn") }
      ]}
      columns={[
        { key: "zone_name_la", label: t("fields.nameLa"), className: "text-muted-foreground" },
        { key: "zone_name_eng", label: t("fields.nameEn"), className: "text-muted-foreground" }
      ]}
    />
  );
}
