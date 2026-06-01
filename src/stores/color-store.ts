"use client";

import {
  deleteColor,
  getColors,
  saveColor,
  type Color,
  type FetchColorsParams,
  type SaveColorInput
} from "@/services/color";
import { createCrudListStore } from "@/stores/crud-list-store";

export const useColorStore = createCrudListStore<
  Color,
  SaveColorInput,
  FetchColorsParams
>({
  idKey: "color_uuid",
  list: getColors,
  save: saveColor,
  remove: deleteColor
});
