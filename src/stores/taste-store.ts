"use client";

import {
  deleteTaste,
  getTastes,
  saveTaste,
  type FetchTastesParams,
  type SaveTasteInput,
  type Taste,
} from "@/services/taste";
import { createCrudListStore } from "@/stores/crud-list-store";

export const useTasteStore = createCrudListStore<
  Taste,
  SaveTasteInput,
  FetchTastesParams
>({
  idKey: "taste_uuid",
  list: getTastes,
  save: saveTaste,
  remove: deleteTaste,
});
