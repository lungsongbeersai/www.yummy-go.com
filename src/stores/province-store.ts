"use client";

import {
  deleteProvince,
  getProvinces,
  saveProvince,
  type FetchProvincesParams,
  type Province,
  type SaveProvinceInput
} from "@/services/province";
import { createCrudListStore } from "@/stores/crud-list-store";

export const useProvinceStore = createCrudListStore<
  Province,
  SaveProvinceInput,
  FetchProvincesParams
>({
  idKey: "province_uuid",
  list: getProvinces,
  save: saveProvince,
  remove: deleteProvince
});
