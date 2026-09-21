"use client";

import {
  deleteSauce,
  getSauces,
  saveSauce,
  type FetchSaucesParams,
  type SaveSauceInput,
  type Sauce,
} from "@/services/sauce";
import { createCrudListStore } from "@/stores/crud-list-store";

export const useSauceStore = createCrudListStore<
  Sauce,
  SaveSauceInput,
  FetchSaucesParams
>({
  idKey: "sauce_uuid",
  list: getSauces,
  save: saveSauce,
  remove: deleteSauce,
});
