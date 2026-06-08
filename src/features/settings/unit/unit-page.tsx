"use client";

import { Box } from "lucide-react";
import { useTranslation } from "react-i18next";
import { OptionSettingsPage, type OptionSaveArgs } from "@/features/settings/shared/option-settings-page";
import { buildUnitPayload, missingUnitField, unitId, unitName, unitValue } from "@/features/settings/unit/unit-utils";
import type { UrlPaginationState } from "@/lib/url-pagination";
import type { FetchUnitsParams, SaveUnitInput, Unit } from "@/services/unit";
import { useUnitStore } from "@/stores/unit-store";

function unitSaveArgs({ editing, formData, storeUuid }: OptionSaveArgs<Unit>) {
  return {
    editing,
    nameEng: String(formData.get("unite_name_eng") ?? "").trim(),
    nameLa: String(formData.get("unite_name_la") ?? "").trim(),
    storeUuid
  };
}

export function UnitSettingsPage({ initialPagination }: { initialPagination: UrlPaginationState }) {
  const { t } = useTranslation();

  return (
    <OptionSettingsPage<Unit, SaveUnitInput, FetchUnitsParams>
      buildInput={(args) => buildUnitPayload(unitSaveArgs(args))}
      columns={[
        {
          key: "unite_name_la",
          label: t("fields.unite_name_la"),
          className: "max-w-[18rem] text-muted-foreground",
          render: (row) => <span className="block truncate">{unitValue(row, "unite_name_la", "-")}</span>
        },
        {
          key: "unite_name_eng",
          label: t("fields.unite_name_eng"),
          className: "max-w-[18rem] text-muted-foreground",
          render: (row) => <span className="block truncate">{unitValue(row, "unite_name_eng", "-")}</span>
        }
      ]}
      description={t("settings.modules.unit.description")}
      fields={[
        { name: "unite_name_la", label: t("fields.unite_name_la"), required: true, fallbackKey: "unite_name" },
        { name: "unite_name_eng", label: t("fields.unite_name_eng") }
      ]}
      formDescription={t("settings.unitFormHint")}
      formTitle={t("settings.unitDetails")}
      getName={unitName}
      getSubtitle={(row) => unitId(row)}
      icon={Box}
      idKey="unite_uuid"
      initialPagination={initialPagination}
      itemLabel={t("nav.unit")}
      listTitle={t("settings.unitList")}
      nameEngKey="unite_name_eng"
      nameKey="unite_name"
      nameLaKey="unite_name_la"
      refreshLabel={t("settings.refreshingUnitList")}
      scope={(storeUuid) => ({ store_uuid_fk: storeUuid })}
      slug="unit"
      store={useUnitStore}
      tableClassName="min-w-[860px]"
      title={t("settings.modules.unit.title")}
      validateInput={(args) => {
        const missing = missingUnitField({ nameLa: unitSaveArgs(args).nameLa });
        if (missing === "name") return t("settings.unitNameRequired");
        return null;
      }}
    />
  );
}
