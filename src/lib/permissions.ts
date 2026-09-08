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
const STORE_PERMISSION_MANAGE_STATUSES: number[] = Object.values(ROLE_STATUS);

function roleStatus(status: number | null | undefined) {
  return Number(status ?? 0);
}

export function canViewStoreBranch(status: number | null | undefined) {
  return STORE_BRANCH_VIEW_STATUSES.includes(roleStatus(status));
}

export function canEditStoreBranch(status: number | null | undefined) {
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
  if (slug === "store" || slug === "branch") return canViewStoreBranch(status);
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
