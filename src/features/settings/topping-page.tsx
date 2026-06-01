"use client";

import { Utensils } from "lucide-react";
import { useTranslation } from "react-i18next";
import { OptionSettingsPage } from "@/features/settings/option-settings-page";
import type { FetchToppingsParams, SaveToppingInput, Topping } from "@/services/topping";
import { useToppingStore } from "@/stores/topping-store";

const storeScope = (storeUuid: string) => ({ store_uuid_fk: storeUuid });

export function ToppingSettingsPage() {
  const { t } = useTranslation();
  const title = t("settings.modules.topping.title");

  return (
    <OptionSettingsPage<Topping, SaveToppingInput, FetchToppingsParams>
      slug="topping"
      itemLabel={t("nav.topping")}
      title={title}
      description={t("settings.modules.topping.description")}
      idKey="topping_uuid"
      nameKey="topping_name"
      nameLaKey="topping_name_la"
      nameEngKey="topping_name_eng"
      icon={Utensils}
      store={useToppingStore}
      scope={storeScope}
      fields={[
        { name: "topping_name_la", label: t("fields.nameLa"), required: true, fallbackKey: "topping_name" },
        { name: "topping_name_eng", label: t("fields.nameEn") }
      ]}
      columns={[
        { key: "topping_name_la", label: t("fields.nameLa"), className: "text-muted-foreground" },
        { key: "topping_name_eng", label: t("fields.nameEn"), className: "text-muted-foreground" }
      ]}
    />
  );
}
