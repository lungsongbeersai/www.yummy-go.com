import type { BranchManagementStore, BranchManagementStoreOptions } from "@/services/branch";

export function branchManagementStores(options: BranchManagementStoreOptions | null): BranchManagementStore[] {
  if (!options) return [];
  const seen = new Set<string>();
  return options.data.filter((store) => {
    const uuid = store.store_uuid?.trim();
    if (!uuid || seen.has(uuid) || (!options.scope.can_select_store && uuid !== options.scope.store_uuid)) return false;
    seen.add(uuid);
    return true;
  });
}

export function branchManagementStoreUuid(options: BranchManagementStoreOptions | null, selectedStoreUuid: string) {
  if (!options) return "";
  const uuid = options.scope.can_select_store ? selectedStoreUuid : options.scope.store_uuid;
  return branchManagementStores(options).some((store) => store.store_uuid === uuid) ? uuid : "";
}

export function branchManagementStoreLabel(store: BranchManagementStore, language: string) {
  return (language.startsWith("en") ? store.store_name_eng : store.store_name_la) ||
    store.store_name_la || store.store_name_eng || store.store_uuid;
}
