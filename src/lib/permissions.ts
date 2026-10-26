export const ROLE_STATUS = {
  SUPER_ADMIN: 1,
  HEAD_OFFICE_ADMIN: 2,
  BRANCH_ADMIN: 3,
  SALES_STAFF: 4,
  ACCOUNTING_STAFF: 5,
  WAREHOUSE_STAFF: 6,
  WAITER: 7
} as const;

export const STORE_BRANCH_VIEW_STATUSES: number[] = [
  ROLE_STATUS.SUPER_ADMIN,
  ROLE_STATUS.HEAD_OFFICE_ADMIN
];
const BRANCH_SETTINGS_STATUSES = [...STORE_BRANCH_VIEW_STATUSES, ROLE_STATUS.BRANCH_ADMIN];
const STORE_PERMISSION_MANAGE_STATUSES = STORE_BRANCH_VIEW_STATUSES;

function roleStatus(status: number | null | undefined) {
  return Number(status ?? 0);
}

export function canViewStoreBranch(status: number | null | undefined) {
  return STORE_BRANCH_VIEW_STATUSES.includes(roleStatus(status));
}

export function canEditStoreBranch(status: number | null | undefined) {
  return canViewStoreBranch(status);
}

export function canViewBranchSettings(status: number | null | undefined) {
  return BRANCH_SETTINGS_STATUSES.includes(roleStatus(status));
}

export function canEditBranchSettings(status: number | null | undefined) {
  return canViewBranchSettings(status);
}

export function canEditBranchSettingsRow(status: number | null | undefined, ownBranchUuid: string, branchUuid: string) {
  if (!branchUuid || !canEditBranchSettings(status)) return false;
  return roleStatus(status) !== ROLE_STATUS.BRANCH_ADMIN || Boolean(ownBranchUuid && ownBranchUuid === branchUuid);
}

export function canManageBranchAccounts(status: number | null | undefined) {
  return canViewBranchSettings(status);
}

export function canManageBankMaster(status: number | null | undefined) {
  return canViewStoreBranch(status);
}

export function canCreateStoreBranch(status: number | null | undefined) {
  return roleStatus(status) === ROLE_STATUS.SUPER_ADMIN;
}

export function canDeleteStoreBranch(status: number | null | undefined) {
  return roleStatus(status) === ROLE_STATUS.SUPER_ADMIN;
}

export function canManageLocationSettings(status: number | null | undefined) {
  return roleStatus(status) === ROLE_STATUS.SUPER_ADMIN;
}

export function canManagePermissionMenu(status: number | null | undefined) {
  return roleStatus(status) === ROLE_STATUS.SUPER_ADMIN;
}

export function canManageStorePermissions(status: number | null | undefined) {
  return STORE_PERMISSION_MANAGE_STATUSES.includes(roleStatus(status));
}

export function canViewSettingModule(slug: string, status: number | null | undefined) {
  if (["branch", "account"].includes(slug)) return canViewBranchSettings(status);
  if (["store", "bank"].includes(slug)) return canViewStoreBranch(status);
  return true;
}

// Waiter (status 7) takes orders only — payment collection and discounting stay
// with roles that are accountable for the till.
export function canManagePayments(status: number | null | undefined) {
  return roleStatus(status) !== ROLE_STATUS.WAITER;
}

export function canManageDiscounts(status: number | null | undefined) {
  return roleStatus(status) !== ROLE_STATUS.WAITER;
}
