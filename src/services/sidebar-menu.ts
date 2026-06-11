import type { MenuItem } from "@/config/menu";
import { apiRequest, ServiceError } from "@/lib/api";
import { normalizeMenuIconName } from "@/lib/menu-icons";
import { toApiLanguage } from "@/lib/language";
import { requiredText } from "@/services/shared/validators";

const SIDEBAR_MENU_ENDPOINT = "/api/v1/permission/menu";
const PLC_ROLE_STATUS = 1;

export interface SidebarPermissionMenuItem {
  badgeText?: string;
  children?: SidebarPermissionMenuItem[];
  disabled?: boolean;
  iconName?: string;
  label: string;
  path?: string;
  source: "permission-api";
  title: string;
}

export interface SidebarPermissionMenuParams {
  companyUuid: string;
  lang?: string;
  roleId: number;
}

interface SidebarPermissionMenuResponse {
  data?: RawSidebarPermissionRole[] | RawSidebarPermissionRole;
  lang?: string;
  roles?: RawSidebarPermissionRole[];
  status?: string;
}

interface RawSidebarPermissionRole {
  menus?: RawSidebarPermissionMenu[] | null;
  role_id?: number | string;
  role_name?: string;
  roles_name?: string;
  roles_name_eng?: string;
}

interface RawSidebarPermissionMenu {
  menu_badge_show?: boolean | number | string;
  menu_badge_text?: string | null;
  menu_icon?: string | null;
  menu_id?: string | null;
  menu_is_dropdown?: boolean | number | string;
  menu_path?: string | null;
  menu_sort?: number | string | null;
  menu_title?: string | null;
  menu_type?: string | null;
  sub_detail?: RawSidebarPermissionSubMenu[] | null;
}

interface RawSidebarPermissionSubMenu {
  checked?: boolean | number | string;
  menu_id?: string | null;
  sub_id?: string | null;
  sub_path?: string | null;
  sub_sort?: number | string | null;
  sub_status?: number | string | null;
  sub_title?: string | null;
}

function text(value: unknown, fallback = "") {
  const next = String(value ?? "").trim();
  return next || fallback;
}

function numberValue(value: unknown, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function requiredNumber(value: unknown, field: string) {
  const next = Number(value);
  if (!Number.isFinite(next)) throw new ServiceError(`${field} is required`, 400);
  return next;
}

function booleanValue(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "1" || normalized === "true";
}

function subStatusValue(value: unknown) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return 1;
  const next = Number(normalized);
  return Number.isFinite(next) ? next : 1;
}

function responseRoles(response: SidebarPermissionMenuResponse) {
  if (Array.isArray(response.roles)) return response.roles;
  if (Array.isArray(response.data)) return response.data;
  return response.data ? [response.data] : [];
}

function sortByOrder<T>(
  items: T[],
  getSort: (item: T) => number,
  getLabel: (item: T) => string
) {
  return [...items].sort((a, b) => getSort(a) - getSort(b) || getLabel(a).localeCompare(getLabel(b)));
}

function canShowSubMenu(submenu: RawSidebarPermissionSubMenu, roleId: number) {
  if (!booleanValue(submenu.checked)) return false;
  return subStatusValue(submenu.sub_status) !== 2 || roleId === PLC_ROLE_STATUS;
}

function normalizeSubMenu(
  submenu: RawSidebarPermissionSubMenu,
  roleId: number
): SidebarPermissionMenuItem | null {
  if (!canShowSubMenu(submenu, roleId)) return null;

  const path = text(submenu.sub_path);
  const label = text(submenu.sub_title, path);
  const title = text(submenu.sub_id, path || label);
  if (!path && !label) return null;

  return {
    label,
    path,
    source: "permission-api",
    title
  };
}

function normalizeMenu(menu: RawSidebarPermissionMenu, roleId: number): SidebarPermissionMenuItem | null {
  const path = text(menu.menu_path);
  const label = text(menu.menu_title, path);
  const title = text(menu.menu_id, path || label);
  if (!path && !label) return null;

  const children = sortByOrder(
    Array.isArray(menu.sub_detail)
      ? menu.sub_detail
        .map((submenu) => normalizeSubMenu(submenu, roleId))
        .filter((item): item is SidebarPermissionMenuItem => Boolean(item))
      : [],
    (item) => {
      const raw = Array.isArray(menu.sub_detail)
        ? menu.sub_detail.find((submenu) => text(submenu.sub_id, text(submenu.sub_path)) === item.title)
        : null;
      return numberValue(raw?.sub_sort);
    },
    (item) => item.label
  );
  const dropdown = booleanValue(menu.menu_is_dropdown)
    || text(menu.menu_type).toLowerCase() === "dropdown"
    || children.length > 0;
  const badgeText = booleanValue(menu.menu_badge_show) ? text(menu.menu_badge_text) : "";

  return {
    ...(badgeText ? { badgeText } : {}),
    ...(dropdown && children.length ? { children } : {}),
    iconName: normalizeMenuIconName(menu.menu_icon),
    label,
    path,
    source: "permission-api",
    title
  };
}

export function buildSidebarPermissionMenuParams(params: SidebarPermissionMenuParams) {
  return {
    company_uuid_fk: requiredText(params.companyUuid, "company_uuid_fk"),
    lang: toApiLanguage(params.lang),
    role_id: requiredNumber(params.roleId, "role_id")
  };
}

export function normalizeSidebarPermissionMenuResponse(
  response: SidebarPermissionMenuResponse,
  roleId: number
) {
  const roles = responseRoles(response);
  const selectedRole = roles.find((role) => numberValue(role.role_id) === Number(roleId)) ?? roles[0];
  const menus = Array.isArray(selectedRole?.menus) ? selectedRole.menus : [];

  return sortByOrder(
    menus.map((menu) => normalizeMenu(menu, roleId)).filter((item): item is SidebarPermissionMenuItem => Boolean(item)),
    (item) => {
      const raw = menus.find((menu) => text(menu.menu_id, text(menu.menu_path)) === item.title);
      return numberValue(raw?.menu_sort);
    },
    (item) => item.label
  );
}

export function sidebarPermissionMenuItemsToMenuItems(
  items: SidebarPermissionMenuItem[]
): MenuItem[] {
  return items.map((item) => ({
    badgeText: item.badgeText,
    children: item.children?.length ? sidebarPermissionMenuItemsToMenuItems(item.children) : undefined,
    disabled: item.disabled,
    iconName: item.iconName,
    label: item.label,
    path: item.path,
    source: item.source,
    title: item.title
  }));
}

export async function fetchSidebarPermissionMenu(params: SidebarPermissionMenuParams) {
  const requestParams = buildSidebarPermissionMenuParams(params);
  const result = await apiRequest<SidebarPermissionMenuResponse>(
    "get",
    SIDEBAR_MENU_ENDPOINT,
    { params: requestParams },
    "Failed to fetch sidebar menu"
  );
  return normalizeSidebarPermissionMenuResponse(result, requestParams.role_id);
}
