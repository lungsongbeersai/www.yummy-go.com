"use client";

import { Layers } from "lucide-react";
import { useTranslation } from "react-i18next";
import { OptionSettingsPage } from "@/features/settings/option-settings-page";
import type { FetchGroupsParams, Group, SaveGroupInput } from "@/services/group";
import { useGroupStore } from "@/stores/group-store";

const storeScope = (storeUuid: string) => ({ store_uuid_fk: storeUuid });

export function GroupSettingsPage() {
  const { t } = useTranslation();
  const title = t("settings.modules.group.title");

  return (
    <OptionSettingsPage<Group, SaveGroupInput, FetchGroupsParams>
      slug="group"
      itemLabel={t("nav.food_group")}
      title={title}
      description={t("settings.modules.group.description")}
      idKey="group_uuid"
      nameKey="group_name"
      nameLaKey="group_name_la"
      nameEngKey="group_name_eng"
      icon={Layers}
      tableClassName="min-w-[940px]"
      store={useGroupStore}
      scope={storeScope}
      fields={[
        { name: "group_name_la", label: t("fields.nameLa"), required: true, fallbackKey: "group_name" },
        { name: "group_name_eng", label: t("fields.nameEn") }
      ]}
      columns={[
        { key: "group_name_la", label: t("fields.nameLa"), className: "text-muted-foreground" },
        { key: "group_name_eng", label: t("fields.nameEn"), className: "text-muted-foreground" }
      ]}
    />
  );
}
