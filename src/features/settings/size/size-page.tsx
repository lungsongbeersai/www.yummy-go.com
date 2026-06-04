"use client";

import { Ruler } from "lucide-react";
import { useTranslation } from "react-i18next";
import { OptionSettingsPage } from "@/features/settings/shared/option-settings-page";
import type { FetchSizesParams, SaveSizeInput, Size } from "@/services/size";
import { useSizeStore } from "@/stores/size-store";

const storeScope = (storeUuid: string) => ({ store_uuid_fk: storeUuid });

export function SizeSettingsPage() {
  const { t } = useTranslation();
  const title = t("settings.modules.size.title");

  return (
    <OptionSettingsPage<Size, SaveSizeInput, FetchSizesParams>
      slug="size"
      itemLabel={t("nav.size")}
      title={title}
      description={t("settings.modules.size.description")}
      idKey="size_uuid"
      nameKey="size_name"
      nameLaKey="size_name_la"
      nameEngKey="size_name_eng"
      icon={Ruler}
      store={useSizeStore}
      scope={storeScope}
      fields={[
        { name: "size_name_la", label: t("fields.nameLa"), required: true, fallbackKey: "size_name" },
        { name: "size_name_eng", label: t("fields.nameEn") }
      ]}
      columns={[
        { key: "size_name_la", label: t("fields.nameLa"), className: "text-muted-foreground" },
        { key: "size_name_eng", label: t("fields.nameEn"), className: "text-muted-foreground" }
      ]}
    />
  );
}
