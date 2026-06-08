"use client";

import { Map } from "lucide-react";
import { useTranslation } from "react-i18next";
import { OptionSettingsPage, type OptionSaveArgs } from "@/features/settings/shared/option-settings-page";
import { buildZonePayload, missingZoneField, zoneId, zoneName, zoneValue } from "@/features/settings/zone/zone-utils";
import type { UrlPaginationState } from "@/lib/url-pagination";
import type { FetchZonesParams, SaveZoneInput, Zone } from "@/services/zone";
import { useZoneStore } from "@/stores/zone-store";

function zoneSaveArgs({ editing, formData, scope }: OptionSaveArgs<Zone>) {
  return {
    branchUuid: String(scope.branch_uuid_fk ?? ""),
    editing,
    nameEng: String(formData.get("zone_name_eng") ?? "").trim(),
    nameLa: String(formData.get("zone_name_la") ?? "").trim()
  };
}

export function ZoneSettingsPage({ initialPagination }: { initialPagination: UrlPaginationState }) {
  const { t } = useTranslation();

  return (
    <OptionSettingsPage<Zone, SaveZoneInput, FetchZonesParams>
      buildInput={(args) => buildZonePayload(zoneSaveArgs(args))}
      columns={[
        {
          key: "zone_name_la",
          label: t("fields.zone_name_la"),
          className: "max-w-[18rem] text-muted-foreground",
          render: (row) => <span className="block truncate">{zoneValue(row, "zone_name_la", "-")}</span>
        },
        {
          key: "zone_name_eng",
          label: t("fields.zone_name_eng"),
          className: "max-w-[18rem] text-muted-foreground",
          render: (row) => <span className="block truncate">{zoneValue(row, "zone_name_eng", "-")}</span>
        }
      ]}
      description={t("settings.modules.zone.description")}
      fields={[
        { name: "zone_name_la", label: t("fields.zone_name_la"), required: true, fallbackKey: "zone_name" },
        { name: "zone_name_eng", label: t("fields.zone_name_eng") }
      ]}
      formDescription={t("settings.zoneFormHint")}
      formTitle={t("settings.zoneDetails")}
      getName={zoneName}
      getSubtitle={(row) => zoneId(row)}
      icon={Map}
      idKey="zone_uuid"
      initialPagination={initialPagination}
      itemLabel={t("nav.zone")}
      listTitle={t("settings.zoneList")}
      nameEngKey="zone_name_eng"
      nameKey="zone_name"
      nameLaKey="zone_name_la"
      refreshLabel={t("settings.refreshingZoneList")}
      requiredScopeKey="branch_uuid_fk"
      requiredScopeMessage={t("settings.branchRequired")}
      scope={(_, user) => ({ branch_uuid_fk: user?.branch_uuid ?? "" })}
      slug="zone"
      store={useZoneStore}
      tableClassName="min-w-[860px]"
      title={t("settings.modules.zone.title")}
      validateInput={(args) => {
        const missing = missingZoneField(zoneSaveArgs(args));
        if (missing === "branch") return t("settings.branchRequired");
        if (missing === "name") return t("settings.zoneNameRequired");
        return null;
      }}
    />
  );
}
