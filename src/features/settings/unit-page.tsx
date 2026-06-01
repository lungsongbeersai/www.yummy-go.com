"use client";

import { Box } from "lucide-react";
import { useTranslation } from "react-i18next";
import { OptionSettingsPage } from "@/features/settings/option-settings-page";
import type { FetchUnitsParams, SaveUnitInput, Unit } from "@/services/unit";
import { useUnitStore } from "@/stores/unit-store";

const storeScope = (storeUuid: string) => ({ store_uuid_fk: storeUuid });

export function UnitSettingsPage() {
  const { t } = useTranslation();
  const title = t("settings.modules.unit.title");

  return (
    <OptionSettingsPage<Unit, SaveUnitInput, FetchUnitsParams>
      slug="unit"
      itemLabel={t("nav.unit")}
      title={title}
      description={t("settings.modules.unit.description")}
      idKey="unite_uuid"
      nameKey="unite_name"
      nameLaKey="unite_name_la"
      nameEngKey="unite_name_eng"
      icon={Box}
      store={useUnitStore}
      scope={storeScope}
      fields={[
        { name: "unite_name_la", label: t("fields.nameLa"), required: true, fallbackKey: "unite_name" },
        { name: "unite_name_eng", label: t("fields.nameEn") }
      ]}
      columns={[
        { key: "unite_name_la", label: t("fields.nameLa"), className: "text-muted-foreground" },
        { key: "unite_name_eng", label: t("fields.nameEn"), className: "text-muted-foreground" }
      ]}
    />
  );
}
