"use client";

import { Layers } from "lucide-react";
import { useTranslation } from "react-i18next";
import { OptionSettingsPage, type OptionSaveArgs } from "@/features/settings/shared/option-settings-page";
import { buildGroupPayload, groupName, groupValue, missingGroupField } from "@/features/settings/group/group-utils";
import type { UrlPaginationState } from "@/lib/url-pagination";
import type { FetchGroupsParams, Group, SaveGroupInput } from "@/services/group";
import { useGroupStore } from "@/stores/group-store";

function groupSaveArgs({ editing, formData, storeUuid }: OptionSaveArgs<Group>) {
  return {
    editing,
    nameEng: String(formData.get("group_name_eng") ?? "").trim(),
    nameLa: String(formData.get("group_name_la") ?? "").trim(),
    storeUuid
  };
}

export function GroupSettingsPage({ initialPagination }: { initialPagination: UrlPaginationState }) {
  const { t } = useTranslation();

  return (
    <OptionSettingsPage<Group, SaveGroupInput, FetchGroupsParams>
      buildInput={(args) => buildGroupPayload(groupSaveArgs(args))}
      columns={[
        {
          key: "group_name_la",
          label: t("fields.group_name_la"),
          className: "max-w-[18rem] text-muted-foreground",
          render: (row) => <span className="block truncate">{groupValue(row, "group_name_la", "-")}</span>
        },
        {
          key: "group_name_eng",
          label: t("fields.group_name_eng"),
          className: "max-w-[18rem] text-muted-foreground",
          render: (row) => <span className="block truncate">{groupValue(row, "group_name_eng", "-")}</span>
        }
      ]}
      description={t("settings.modules.group.description")}
      fields={[
        { name: "group_name_la", label: t("fields.group_name_la"), required: true, fallbackKey: "group_name" },
        { name: "group_name_eng", label: t("fields.group_name_eng") }
      ]}
      formDescription={t("settings.groupFormHint")}
      formTitle={t("settings.groupDetails")}
      getName={groupName}
      icon={Layers}
      idKey="group_uuid"
      initialPagination={initialPagination}
      itemLabel={t("nav.food_group")}
      listTitle={t("settings.groupList")}
      nameEngKey="group_name_eng"
      nameKey="group_name"
      nameLaKey="group_name_la"
      refreshLabel={t("settings.refreshingGroupList")}
      requiredScopeKey="store_uuid_fk"
      requiredScopeMessage={t("settings.storeRequired")}
      scope={(storeUuid) => ({ store_uuid_fk: storeUuid })}
      slug="group"
      store={useGroupStore}
      tableClassName="min-w-[860px]"
      title={t("settings.modules.group.title")}
      validateInput={(args) => {
        const missing = missingGroupField(groupSaveArgs(args));
        if (missing === "store") return t("settings.storeRequired");
        if (missing === "name") return t("settings.groupNameRequired");
        return null;
      }}
    />
  );
}
