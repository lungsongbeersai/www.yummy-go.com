import type { Branch, BranchManagementStoreOptions } from "@/services/branch";
import type { CatalogItem, CommercialDocument } from "@/services/commercial";
import { ROLE_STATUS } from "@/lib/permissions";

export function commercialStores(options: BranchManagementStoreOptions) {
  const seen = new Set<string>();
  return options.data.filter((store) => {
    const id = store.store_uuid?.trim();
    if (!id || seen.has(id) || (!options.scope.can_select_store && id !== options.scope.store_uuid)) return false;
    seen.add(id);
    return true;
  });
}

export function commercialBranches(branches: Branch[], storeUuid: string, status: number, ownBranchUuid: string) {
  return branches.filter((branch) =>
    branch.branch_uuid && branch.store_uuid_fk === storeUuid &&
    (status !== ROLE_STATUS.BRANCH_ADMIN || branch.branch_uuid === ownBranchUuid),
  );
}

export function commercialBranchRows<T extends CatalogItem | CommercialDocument>(rows: T[], branchUuid: string) {
  return rows.filter((row) => Boolean(branchUuid) && row.branch_uuid === branchUuid);
}
