"use client";

import { Utensils } from "lucide-react";
import { useTranslation } from "react-i18next";
import { OptionSettingsPage, type OptionSaveArgs } from "@/features/settings/shared/option-settings-page";
import { buildToppingPayload, missingToppingField, toppingId, toppingName, toppingValue } from "@/features/settings/topping/topping-utils";
import type { UrlPaginationState } from "@/lib/url-pagination";
import type { FetchToppingsParams, SaveToppingInput, Topping } from "@/services/topping";
import { useToppingStore } from "@/stores/topping-store";

function toppingSaveArgs({ editing, formData, storeUuid }: OptionSaveArgs<Topping>) {
  return {
    editing,
    nameEng: String(formData.get("topping_name_eng") ?? "").trim(),
    nameLa: String(formData.get("topping_name_la") ?? "").trim(),
    storeUuid
  };
}

export function ToppingSettingsPage({ initialPagination }: { initialPagination: UrlPaginationState }) {
  const { t } = useTranslation();

  return (
    <OptionSettingsPage<Topping, SaveToppingInput, FetchToppingsParams>
      buildInput={(args) => buildToppingPayload(toppingSaveArgs(args))}
      columns={[
        {
          key: "topping_name_la",
          label: t("fields.topping_name_la"),
          className: "max-w-[18rem] text-muted-foreground",
          render: (row) => <span className="block truncate">{toppingValue(row, "topping_name_la", "-")}</span>
        },
        {
          key: "topping_name_eng",
          label: t("fields.topping_name_eng"),
          className: "max-w-[18rem] text-muted-foreground",
          render: (row) => <span className="block truncate">{toppingValue(row, "topping_name_eng", "-")}</span>
        }
      ]}
      description={t("settings.modules.topping.description")}
      fields={[
        { name: "topping_name_la", label: t("fields.topping_name_la"), required: true, fallbackKey: "topping_name" },
        { name: "topping_name_eng", label: t("fields.topping_name_eng") }
      ]}
      formDescription={t("settings.toppingFormHint")}
      formTitle={t("settings.toppingDetails")}
      getName={toppingName}
      getSubtitle={(row) => toppingId(row)}
      icon={Utensils}
      idKey="topping_uuid"
      initialPagination={initialPagination}
      itemLabel={t("nav.topping")}
      listTitle={t("settings.toppingList")}
      nameEngKey="topping_name_eng"
      nameKey="topping_name"
      nameLaKey="topping_name_la"
      refreshLabel={t("settings.refreshingToppingList")}
      requiredScopeKey="store_uuid_fk"
      requiredScopeMessage={t("settings.storeRequired")}
      scope={(storeUuid) => ({ store_uuid_fk: storeUuid })}
      slug="topping"
      store={useToppingStore}
      tableClassName="min-w-[860px]"
      title={t("settings.modules.topping.title")}
      validateInput={(args) => {
        const missing = missingToppingField(toppingSaveArgs(args));
        if (missing === "store") return t("settings.storeRequired");
        if (missing === "name") return t("settings.toppingNameRequired");
        return null;
      }}
    />
  );
}
