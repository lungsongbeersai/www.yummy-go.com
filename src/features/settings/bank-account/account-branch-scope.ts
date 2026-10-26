import { canManageBranchAccounts, ROLE_STATUS } from "@/lib/permissions";
import type { Branch } from "@/services/branch";

export function accountBranchOptions(branches: Branch[], status: number | null | undefined, ownBranchUuid: string) {
  if (!canManageBranchAccounts(status)) return [];
  return Number(status) === ROLE_STATUS.BRANCH_ADMIN
    ? branches.filter((branch) => branch.branch_uuid === ownBranchUuid)
    : branches;
}

export function accountBranchUuid(status: number | null | undefined, ownBranchUuid: string, selectedBranchUuid: string) {
  if (!canManageBranchAccounts(status)) return "";
  return (Number(status) === ROLE_STATUS.BRANCH_ADMIN ? ownBranchUuid : selectedBranchUuid).trim();
}

export function accountBelongsToBranch(accountBranchUuid: string, branchUuid: string) {
  return Boolean(branchUuid && accountBranchUuid === branchUuid);
}
