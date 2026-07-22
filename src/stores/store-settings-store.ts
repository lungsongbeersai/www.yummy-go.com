"use client";

import {
  deleteStore,
  getStores,
  saveStore,
  type FetchStoresParams,
  type SaveStoreInput,
  type Store
} from "@/services/store";
import { createCrudListStore } from "@/stores/crud-list-store";

// Backs the store-branch settings screen's "store" tab. Named "*SettingsStore"
// (not "store-store") to stay distinct from the options-oriented branch-store.ts.
export const useStoreSettingsStore = createCrudListStore<
  Store,
  SaveStoreInput,
  FetchStoresParams
>({
  idKey: "store_uuid",
  list: getStores,
  save: saveStore,
  remove: deleteStore
});
