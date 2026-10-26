import type { BranchManagementStore, BranchManagementStoreOptions } from "@/services/branch";

export const BRANCH_ALL_STORES = "all";

export function branchManagementStores(options: BranchManagementStoreOptions | null): BranchManagementStore[] {
  if (!options) return [];
  const seen = new Set<string>();
  const stores = options.data.filter((store) => {
    const uuid = store.store_uuid?.trim();
    if (!uuid || seen.has(uuid) || (!options.scope.can_select_store && uuid !== options.scope.store_uuid)) return false;
    seen.add(uuid);
    return true;
  });
  const ownStore = stores.find((store) => store.store_uuid === options.scope.store_uuid);
  return ownStore ? [ownStore, ...stores.filter((store) => store !== ownStore)] : stores;
}

export function branchManagementStoreUuid(options: BranchManagementStoreOptions | null, selectedStoreUuid: string) {
  if (!options) return "";
  const uuid = options.scope.can_select_store ? selectedStoreUuid || options.scope.store_uuid : options.scope.store_uuid;
  if (uuid === BRANCH_ALL_STORES && options.scope.can_select_store) return BRANCH_ALL_STORES;
  return branchManagementStores(options).some((store) => store.store_uuid === uuid) ? uuid : "";
}

// All is a list scope only. Editing a row always resolves its concrete store
// from the verified option set; creating requires a concrete selected store.
export function branchManagementMutationStoreUuid(
  options: BranchManagementStoreOptions | null,
  selectedStoreUuid: string,
  rowStoreUuid?: string,
) {
  const scope = branchManagementStoreUuid(options, selectedStoreUuid);
  if (!scope) return "";
  if (rowStoreUuid === undefined) return scope === BRANCH_ALL_STORES ? "" : scope;
  if (!rowStoreUuid || rowStoreUuid === BRANCH_ALL_STORES) return "";
  const knownStore = branchManagementStores(options).some((store) => store.store_uuid === rowStoreUuid);
  return knownStore && (scope === BRANCH_ALL_STORES || scope === rowStoreUuid) ? rowStoreUuid : "";
}

export function branchManagementStoreLabel(store: BranchManagementStore, language: string) {
  return (language.startsWith("en") ? store.store_name_eng : store.store_name_la) ||
    store.store_name_la || store.store_name_eng || store.store_uuid;
}
