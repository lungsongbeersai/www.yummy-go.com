"use client";

import {
  deleteDistrict,
  getDistricts,
  saveDistrict,
  type District,
  type FetchDistrictsParams,
  type SaveDistrictInput
} from "@/services/district";
import { createCrudListStore } from "@/stores/crud-list-store";

export const useDistrictStore = createCrudListStore<
  District,
  SaveDistrictInput,
  FetchDistrictsParams
>({
  idKey: "district_uuid",
  list: getDistricts,
  save: saveDistrict,
  remove: deleteDistrict
});
