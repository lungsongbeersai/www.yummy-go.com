"use client";

import {
  deleteSize,
  getSizes,
  saveSize,
  type FetchSizesParams,
  type SaveSizeInput,
  type Size
} from "@/services/size";
import { createCrudListStore } from "@/stores/crud-list-store";

export const useSizeStore = createCrudListStore<
  Size,
  SaveSizeInput,
  FetchSizesParams
>({
  idKey: "size_uuid",
  list: getSizes,
  save: saveSize,
  remove: deleteSize
});
