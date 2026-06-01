"use client";

import {
  deleteZone,
  getZones,
  saveZone,
  type FetchZonesParams,
  type SaveZoneInput,
  type Zone
} from "@/services/zone";
import { createCrudListStore } from "@/stores/crud-list-store";

export const useZoneStore = createCrudListStore<
  Zone,
  SaveZoneInput,
  FetchZonesParams
>({
  idKey: "zone_uuid",
  list: getZones,
  save: saveZone,
  remove: deleteZone
});
