"use client";

import {
  deleteGroup,
  getGroups,
  saveGroup,
  type FetchGroupsParams,
  type Group,
  type SaveGroupInput
} from "@/services/group";
import { createCrudListStore } from "@/stores/crud-list-store";

export const useGroupStore = createCrudListStore<
  Group,
  SaveGroupInput,
  FetchGroupsParams
>({
  idKey: "group_uuid",
  list: getGroups,
  save: saveGroup,
  remove: deleteGroup
});
