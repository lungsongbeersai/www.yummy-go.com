import type { Route } from "next";
import { ROLE_STATUS } from "@/lib/permissions";
import { internalRoute } from "@/lib/routes";
import type { StorePermissionRole, StorePermissionStore } from "@/services/permissions/access";

interface TrialPermissionViewer {
  status?: number;
  store_status?: number;
}

interface TrialPermissionOptions {
  stores: StorePermissionStore[];
  roles: StorePermissionRole[];
}

interface TrialPermissionContext {
  storeUuid: string;
  roleId: number;
}

export const TRIAL_PERMISSION_ROLE_ID = ROLE_STATUS.BRANCH_ADMIN;

export function canConfigureTrialStorePermissions(viewer: TrialPermissionViewer | null | undefined): boolean {
  return viewer?.status === ROLE_STATUS.SUPER_ADMIN && viewer.store_status === 1;
}

export function trialStorePermissionsRoute(storeUuid: string): Route {
  return internalRoute(`/settings/manage-access-permissions?store_uuid=${encodeURIComponent(storeUuid)}&role_id=${TRIAL_PERMISSION_ROLE_ID}`);
}

export function resolveTrialPermissionContext(
  viewer: TrialPermissionViewer | null | undefined,
  storeUuid: string,
  roleId: string | null,
  options: TrialPermissionOptions,
): TrialPermissionContext | null {
  const target = storeUuid.trim().toLowerCase();
  if (!canConfigureTrialStorePermissions(viewer) || !target
    || (roleId !== null && Number(roleId) !== TRIAL_PERMISSION_ROLE_ID)
    || !options.roles.some((role) => role.roles_id === TRIAL_PERMISSION_ROLE_ID)) return null;

  const store = options.stores.find((option) => option.store_uuid.trim().toLowerCase() === target);
  if (!store || store.store_status !== 3) return null;

  return { storeUuid: store.store_uuid, roleId: TRIAL_PERMISSION_ROLE_ID };
}
