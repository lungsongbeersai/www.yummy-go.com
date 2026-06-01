"use client";

import {
  deleteUnit,
  getUnits,
  saveUnit,
  type FetchUnitsParams,
  type SaveUnitInput,
  type Unit
} from "@/services/unit";
import { createCrudListStore } from "@/stores/crud-list-store";

export const useUnitStore = createCrudListStore<
  Unit,
  SaveUnitInput,
  FetchUnitsParams
>({
  idKey: "unite_uuid",
  list: getUnits,
  save: saveUnit,
  remove: deleteUnit
});
