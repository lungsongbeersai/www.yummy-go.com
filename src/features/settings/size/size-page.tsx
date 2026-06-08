"use client";

import { Ruler } from "lucide-react";
import { useTranslation } from "react-i18next";
import { OptionSettingsPage, type OptionSaveArgs } from "@/features/settings/shared/option-settings-page";
import { buildSizePayload, missingSizeField, sizeId, sizeName, sizeValue } from "@/features/settings/size/size-utils";
import type { UrlPaginationState } from "@/lib/url-pagination";
import type { FetchSizesParams, SaveSizeInput, Size } from "@/services/size";
import { useSizeStore } from "@/stores/size-store";

function sizeSaveArgs({ editing, formData, storeUuid }: OptionSaveArgs<Size>) {
  return {
    editing,
    nameEng: String(formData.get("size_name_eng") ?? "").trim(),
    nameLa: String(formData.get("size_name_la") ?? "").trim(),
    storeUuid
  };
}

export function SizeSettingsPage({ initialPagination }: { initialPagination: UrlPaginationState }) {
  const { t } = useTranslation();

  return (
    <OptionSettingsPage<Size, SaveSizeInput, FetchSizesParams>
      buildInput={(args) => buildSizePayload(sizeSaveArgs(args))}
      columns={[
        {
          key: "size_name_la",
          label: t("fields.size_name_la"),
          className: "max-w-[18rem] text-muted-foreground",
          render: (row) => <span className="block truncate">{sizeValue(row, "size_name_la", "-")}</span>
        },
        {
          key: "size_name_eng",
          label: t("fields.size_name_eng"),
          className: "max-w-[18rem] text-muted-foreground",
          render: (row) => <span className="block truncate">{sizeValue(row, "size_name_eng", "-")}</span>
        }
      ]}
      description={t("settings.modules.size.description")}
      fields={[
        { name: "size_name_la", label: t("fields.size_name_la"), required: true, fallbackKey: "size_name" },
        { name: "size_name_eng", label: t("fields.size_name_eng") }
      ]}
      formDescription={t("settings.sizeFormHint")}
      formTitle={t("settings.sizeDetails")}
      getName={sizeName}
      getSubtitle={(row) => sizeId(row)}
      icon={Ruler}
      idKey="size_uuid"
      initialPagination={initialPagination}
      itemLabel={t("nav.size")}
      listTitle={t("settings.sizeList")}
      nameEngKey="size_name_eng"
      nameKey="size_name"
      nameLaKey="size_name_la"
      refreshLabel={t("settings.refreshingSizeList")}
      scope={(storeUuid) => ({ store_uuid_fk: storeUuid })}
      slug="size"
      store={useSizeStore}
      tableClassName="min-w-[860px]"
      title={t("settings.modules.size.title")}
      validateInput={(args) => {
        const missing = missingSizeField({ nameLa: sizeSaveArgs(args).nameLa });
        if (missing === "name") return t("settings.sizeNameRequired");
        return null;
      }}
    />
  );
}
