"use client";

import { Palette } from "lucide-react";
import { useTranslation } from "react-i18next";
import { OptionSettingsPage } from "@/features/settings/shared/option-settings-page";
import type { Color, FetchColorsParams, SaveColorInput } from "@/services/color";
import { useColorStore } from "@/stores/color-store";

export function ColorSettingsPage() {
  const { t } = useTranslation();
  const title = t("settings.modules.color.title");

  return (
    <OptionSettingsPage<Color, SaveColorInput, FetchColorsParams>
      slug="color"
      itemLabel={t("nav.color")}
      title={title}
      description={t("settings.modules.color.description")}
      idKey="color_uuid"
      nameKey="color_name"
      nameFallbackKey="color_code"
      colorKey="color_code"
      icon={Palette}
      store={useColorStore}
      fields={[
        { name: "color_code", label: t("fields.color_code"), type: "color-code", required: true }
      ]}
      columns={[]}
    />
  );
}
