"use client";

import {
  deleteSetChildOption,
  getSetChildOptions,
  saveSetChildOption,
  type FetchSetChildOptionsParams,
  type SaveSetChildOptionInput,
  type SetChildOption,
} from "@/services/set-child-option";
import { createCrudListStore } from "@/stores/crud-list-store";

export const useSetChildOptionStore = createCrudListStore<
  SetChildOption,
  SaveSetChildOptionInput,
  FetchSetChildOptionsParams
>({
  idKey: "set_child_option_uuid",
  list: getSetChildOptions,
  save: saveSetChildOption,
  remove: deleteSetChildOption,
});
