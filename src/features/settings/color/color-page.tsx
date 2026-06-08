"use client";

import { Palette } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ColorCodeBadge, OptionSettingsPage, type OptionSaveArgs } from "@/features/settings/shared/option-settings-page";
import { buildColorPayload, colorCode, colorId, colorName, missingColorField } from "@/features/settings/color/color-utils";
import type { UrlPaginationState } from "@/lib/url-pagination";
import type { Color, FetchColorsParams, SaveColorInput } from "@/services/color";
import { useColorStore } from "@/stores/color-store";

function colorSaveArgs({ editing, formData }: OptionSaveArgs<Color>) {
  return {
    code: String(formData.get("color_code") ?? "").trim(),
    editing
  };
}

export function ColorSettingsPage({ initialPagination }: { initialPagination: UrlPaginationState }) {
  const { t } = useTranslation();

  return (
    <OptionSettingsPage<Color, SaveColorInput, FetchColorsParams>
      buildInput={(args) => buildColorPayload(colorSaveArgs(args))}
      colorKey="color_code"
      columns={[
        {
          key: "color_code",
          label: t("fields.color_code"),
          render: (row) => <ColorCodeBadge code={colorCode(row)} />
        }
      ]}
      description={t("settings.modules.color.description")}
      fields={[
        { name: "color_code", label: t("fields.color_code"), required: true, type: "color-code" }
      ]}
      formDescription={t("settings.colorFormHint")}
      formTitle={t("settings.colorDetails")}
      getName={colorName}
      getSubtitle={(row) => [colorCode(row), colorId(row)].filter(Boolean).join(" / ") || "-"}
      icon={Palette}
      idKey="color_uuid"
      initialPagination={initialPagination}
      itemLabel={t("nav.color")}
      listTitle={t("settings.colorList")}
      nameKey="color_name"
      refreshLabel={t("settings.refreshingColorList")}
      renderBadges={(row) => <ColorCodeBadge code={colorCode(row)} />}
      slug="color"
      store={useColorStore}
      tableClassName="min-w-[820px]"
      title={t("settings.modules.color.title")}
      validateInput={(args) => {
        const missing = missingColorField(colorSaveArgs(args));
        if (missing === "code") return t("settings.colorCodeRequired");
        return null;
      }}
    />
  );
}
