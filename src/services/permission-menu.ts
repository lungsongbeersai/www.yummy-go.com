import { apiRequest } from "@/lib/api";
import { toApiLanguage } from "@/lib/language";
import { requiredText } from "@/services/shared/validators";
import type { ApiDataResponse, ApiListResponse, ApiMessageResponse } from "@/services/shared/types";

const MAIN_MENU_ENDPOINTS = {
  create: "/api/v1/menus_bar/create",
  delete: "/api/v1/menus_bar/delete",
  sort: "/api/v1/menus_bar/sort"
} as const;

const SUBMENU_ENDPOINTS = {
  create: "/api/v1/sub_menu/create",
  delete: "/api/v1/sub_menu/delete",
  fetchAll: "/api/v1/sub_menu/fetch_all",
  sort: "/api/v1/sub_menu/sort"
} as const;

export interface PermissionSubMenu {
  [key: string]: unknown;
  sub_id: string;
  menu_id: string;
  sub_path: string;
  sub_title: string;
  sub_title_eng?: string;
  sub_title_la?: string;
  sub_sort: number;
  sub_status: number;
}

export interface PermissionMainMenu {
  [key: string]: unknown;
  menu_id: string;
  menu_path: string;
  menu_icon: string;
  menu_title: string;
  menu_title_eng?: string;
  menu_title_la?: string;
  menu_badge: number;
  menu_badge_text: string;
  menu_status: number;
  menu_sort: number;
  sub_detail: PermissionSubMenu[];
}

export interface PermissionMenuTree {
  menus: PermissionMainMenu[];
  total: number;
}

export interface CreateMainMenuInput {
  menu_id?: string;
  menu_path: string;
  menu_icon?: string;
  menu_title_eng: string;
  menu_title_la: string;
  menu_badge?: number | string;
  menu_badge_text?: string;
  menu_status?: number | string;
}

export interface CreateSubMenuInput {
  menu_id: string;
  sub_id?: string;
  sub_path: string;
  sub_title_eng: string;
  sub_title_la: string;
  sub_status?: number | string;
}

export type RawPermissionSubMenu = Partial<PermissionSubMenu>;
export type RawPermissionMainMenu = Partial<Omit<PermissionMainMenu, "sub_detail">> & {
  sub_detail?: RawPermissionSubMenu[];
};

function text(value: unknown, fallback = "") {
  const next = String(value ?? "").trim();
  return next || fallback;
}

function numberValue(value: unknown, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

export function permissionMenuBadgeValue(value: unknown) {
  return Number(value) === 1 ? 1 : 2;
}

export function normalizePermissionSubMenu(submenu: RawPermissionSubMenu, menuId = ""): PermissionSubMenu {
  const titleLa = text(submenu.sub_title_la);
  const titleEng = text(submenu.sub_title_eng);

  return {
    menu_id: text(submenu.menu_id, menuId),
    sub_id: text(submenu.sub_id),
    sub_path: text(submenu.sub_path),
    sub_sort: numberValue(submenu.sub_sort),
    sub_status: numberValue(submenu.sub_status, 1),
    sub_title: text(submenu.sub_title, titleLa || titleEng),
    sub_title_eng: titleEng,
    sub_title_la: titleLa
  };
}

export function sortPermissionSubMenuRows(submenus: PermissionSubMenu[]) {
  return [...submenus].sort((a, b) => a.sub_sort - b.sub_sort || a.sub_title.localeCompare(b.sub_title));
}

export function normalizePermissionMainMenu(menu: RawPermissionMainMenu): PermissionMainMenu {
  const menuId = text(menu.menu_id);
  const titleLa = text(menu.menu_title_la);
  const titleEng = text(menu.menu_title_eng);
  const submenus = Array.isArray(menu.sub_detail)
    ? menu.sub_detail.map((submenu) => normalizePermissionSubMenu(submenu, menuId))
    : [];

  return {
    menu_badge: permissionMenuBadgeValue(menu.menu_badge),
    menu_badge_text: text(menu.menu_badge_text),
    menu_icon: text(menu.menu_icon, "fa fa-file"),
    menu_id: menuId,
    menu_path: text(menu.menu_path),
    menu_sort: numberValue(menu.menu_sort),
    menu_status: numberValue(menu.menu_status, 1),
    menu_title: text(menu.menu_title, titleLa || titleEng),
    menu_title_eng: titleEng,
    menu_title_la: titleLa,
    sub_detail: sortPermissionSubMenuRows(submenus)
  };
}

export function normalizePermissionMenuTreeResponse(
  result: Pick<ApiListResponse<RawPermissionMainMenu>, "data" | "total">
): PermissionMenuTree {
  const menus = (Array.isArray(result.data) ? result.data : [])
    .map(normalizePermissionMainMenu)
    .sort((a, b) => a.menu_sort - b.menu_sort || a.menu_title.localeCompare(b.menu_title));

  return {
    menus,
    total: Number(result.total ?? menus.length)
  };
}

export function buildCreateMainMenuPayload(input: CreateMainMenuInput) {
  const menuBadge = permissionMenuBadgeValue(input.menu_badge);

  return {
    menu_id: text(input.menu_id),
    menu_badge: menuBadge,
    menu_badge_text: menuBadge === 1 ? text(input.menu_badge_text) : "",
    menu_icon: text(input.menu_icon, "fa fa-file"),
    menu_path: requiredText(input.menu_path, "menu_path"),
    menu_status: numberValue(input.menu_status, 1),
    menu_title_eng: requiredText(input.menu_title_eng, "menu_title_eng"),
    menu_title_la: requiredText(input.menu_title_la, "menu_title_la")
  };
}

export function buildCreateSubMenuPayload(input: CreateSubMenuInput) {
  return {
    menu_id: requiredText(input.menu_id, "menu_id"),
    sub_id: text(input.sub_id),
    sub_path: requiredText(input.sub_path, "sub_path"),
    sub_status: numberValue(input.sub_status, 1),
    sub_title_eng: requiredText(input.sub_title_eng, "sub_title_eng"),
    sub_title_la: requiredText(input.sub_title_la, "sub_title_la")
  };
}

export async function fetchPermissionMenuTree(lang?: string): Promise<PermissionMenuTree> {
  const apiLang = toApiLanguage(lang);
  const result = await apiRequest<ApiListResponse<RawPermissionMainMenu>>(
    "get",
    SUBMENU_ENDPOINTS.fetchAll,
    { params: { lang: apiLang } },
    "Failed to fetch menu data"
  );
  return normalizePermissionMenuTreeResponse(result);
}

export async function createPermissionMainMenu(input: CreateMainMenuInput) {
  const payload = buildCreateMainMenuPayload(input);
  const result = await apiRequest<ApiDataResponse<PermissionMainMenu>>(
    "post",
    MAIN_MENU_ENDPOINTS.create,
    { data: payload },
    "Failed to create menu"
  );
  return result.data ? normalizePermissionMainMenu(result.data) : null;
}

export async function deletePermissionMainMenu(menuId: string) {
  await apiRequest<ApiMessageResponse>(
    "delete",
    MAIN_MENU_ENDPOINTS.delete,
    { data: { menu_id: requiredText(menuId, "menu_id") } },
    "Failed to delete menu"
  );
}

export function buildMainMenuSortPayload(menus: Pick<PermissionMainMenu, "menu_id">[]) {
  return {
    items: menus.map((menu, index) => ({
      menu_id: requiredText(menu.menu_id, "menu_id"),
      menu_sort: index + 1
    }))
  };
}

export async function sortPermissionMainMenus(menus: Pick<PermissionMainMenu, "menu_id">[]) {
  await apiRequest<ApiMessageResponse>(
    "post",
    MAIN_MENU_ENDPOINTS.sort,
    { data: buildMainMenuSortPayload(menus) },
    "Failed to sort menus"
  );
}

export async function createPermissionSubMenu(input: CreateSubMenuInput) {
  const payload = buildCreateSubMenuPayload(input);
  const result = await apiRequest<ApiDataResponse<PermissionSubMenu>>(
    "post",
    SUBMENU_ENDPOINTS.create,
    { data: payload },
    "Failed to create submenu"
  );
  return result.data ? normalizePermissionSubMenu(result.data, payload.menu_id) : null;
}

export async function deletePermissionSubMenu(subId: string) {
  await apiRequest<ApiMessageResponse>(
    "delete",
    SUBMENU_ENDPOINTS.delete,
    { data: { sub_id: requiredText(subId, "sub_id") } },
    "Failed to delete submenu"
  );
}

export function buildSubMenuSortPayload(menuId: string, submenus: Pick<PermissionSubMenu, "sub_id">[]) {
  return {
    menu_id: requiredText(menuId, "menu_id"),
    items: submenus.map((submenu, index) => ({
      sub_id: requiredText(submenu.sub_id, "sub_id"),
      sub_sort: index + 1
    }))
  };
}

export async function sortPermissionSubMenus(menuId: string, submenus: Pick<PermissionSubMenu, "sub_id">[]) {
  await apiRequest<ApiMessageResponse>(
    "post",
    SUBMENU_ENDPOINTS.sort,
    { data: buildSubMenuSortPayload(menuId, submenus) },
    "Failed to sort submenus"
  );
}
