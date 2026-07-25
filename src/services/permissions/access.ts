import { ServiceError, apiRequest } from "@/lib/api";
import { toApiLanguage } from "@/lib/language";
import { booleanFlag, numberValue, text } from "@/services/shared/normalize";
import { requiredText } from "@/services/shared/validators";
import type { ApiDataResponse, ApiListResponse } from "@/services/shared/types";

const ENDPOINTS = {
  fetch: "/api/v1/permission/fetch",
  save: "/api/v1/permission/save",
  stores: "/api/v1/permission/stores",
  tree: "/api/v1/permission/tree"
} as const;

interface StorePermissionOptionsData {
  stores?: RawStore[] | null;
  roles?: RawRole[] | null;
}

export interface StorePermissionStore {
  [key: string]: unknown;
  store_uuid: string;
  store_name: string;
  store_name_la?: string;
  store_name_eng?: string;
  store_status?: number;
  store_active?: number;
}

export interface StorePermissionRole {
  [key: string]: unknown;
  role_name: string;
  roles_id: number;
}

export interface StorePermissionOptions {
  stores: StorePermissionStore[];
  roles: StorePermissionRole[];
}

export interface StorePermissionSubMenu {
  [key: string]: unknown;
  checked: boolean;
  sub_id: string;
  sub_path: string;
  sub_sort: number;
  sub_status: number;
  sub_title: string;
  sub_title_eng?: string;
  sub_title_la?: string;
}

export interface StorePermissionMenu {
  [key: string]: unknown;
  menu_badge: number;
  menu_icon: string;
  menu_id: string;
  menu_path: string;
  menu_sort: number;
  menu_status: number;
  menu_title: string;
  sub_detail: StorePermissionSubMenu[];
}

export interface StorePermissionRoleTree {
  [key: string]: unknown;
  menus: StorePermissionMenu[];
  role_id: number;
  role_name: string;
  roles_name: string;
  roles_name_eng: string;
}

export interface StorePermissionTree {
  [key: string]: unknown;
  company_uuid_fk: string;
  roles: StorePermissionRoleTree[];
  store_active: number;
  store_name: string;
  store_name_eng: string;
  store_name_la: string;
  store_status: number;
}

export interface StorePermissionSaveInput {
  company_uuid_fk: string;
  role_id: number;
  sub_id_list: string[];
}

type RawStore = Partial<StorePermissionStore>;
type RawRole = Partial<StorePermissionRole>;
type RawSubMenu = Partial<Omit<StorePermissionSubMenu, "checked">> & {
  checked?: unknown;
};
type RawMenu = Partial<Omit<StorePermissionMenu, "sub_detail">> & {
  sub_detail?: RawSubMenu[] | string | null;
};
type RawRoleTree = Partial<Omit<StorePermissionRoleTree, "menus">> & {
  menus?: RawMenu[] | null;
};
type RawTree = Partial<Omit<StorePermissionTree, "roles">> & {
  roles?: RawRoleTree[] | null;
};

// คงชื่อ export เดิมไว้ให้ store/test ที่อ้างอิงอยู่ — ตัว logic ย้ายไป shared/normalize
export const storePermissionCheckedValue = booleanFlag;

function requiredNumber(value: unknown, field: string) {
  const next = Number(value);

  if (!Number.isFinite(next)) {
    throw new ServiceError(`${field} is required`, 400);
  }

  return next;
}

function responseRows<T>(data: T[] | T | null | undefined): T[] {
  if (Array.isArray(data)) return data;
  return data ? [data] : [];
}

function normalizeStore(store: RawStore): StorePermissionStore {
  const nameLa = text(store.store_name_la);
  const nameEng = text(store.store_name_eng);

  return {
    store_uuid: text(store.store_uuid),
    store_name: text(store.store_name, nameLa || nameEng),
    store_name_la: nameLa,
    store_name_eng: nameEng,
    store_status: numberValue(store.store_status, 2),
    store_active: numberValue(store.store_active, 1)
  };
}

function normalizeRole(role: RawRole): StorePermissionRole {
  return {
    role_name: text(role.role_name),
    roles_id: numberValue(role.roles_id)
  };
}

function normalizeSubMenu(submenu: RawSubMenu): StorePermissionSubMenu {
  const titleLa = text(submenu.sub_title_la);
  const titleEng = text(submenu.sub_title_eng);

  return {
    checked: storePermissionCheckedValue(submenu.checked),
    sub_id: text(submenu.sub_id),
    sub_path: text(submenu.sub_path),
    sub_sort: numberValue(submenu.sub_sort),
    sub_status: numberValue(submenu.sub_status, 1),
    sub_title: text(submenu.sub_title, titleLa || titleEng),
    sub_title_eng: titleEng,
    sub_title_la: titleLa
  };
}

function normalizeMenu(menu: RawMenu): StorePermissionMenu {
  const submenus = Array.isArray(menu.sub_detail)
    ? menu.sub_detail.map(normalizeSubMenu)
    : [];

  return {
    menu_badge: numberValue(menu.menu_badge),
    menu_icon: text(menu.menu_icon, "fa fa-file"),
    menu_id: text(menu.menu_id),
    menu_path: text(menu.menu_path),
    menu_sort: numberValue(menu.menu_sort),
    menu_status: numberValue(menu.menu_status, 1),
    menu_title: text(menu.menu_title),
    sub_detail: submenus.sort(
      (a, b) =>
        a.sub_sort - b.sub_sort ||
        a.sub_title.localeCompare(b.sub_title)
    )
  };
}

function normalizeRoleTree(role: RawRoleTree): StorePermissionRoleTree {
  const menus = Array.isArray(role.menus)
    ? role.menus.map(normalizeMenu)
    : [];

  return {
    menus: menus.sort(
      (a, b) =>
        a.menu_sort - b.menu_sort ||
        a.menu_title.localeCompare(b.menu_title)
    ),
    role_id: numberValue(role.role_id),
    role_name: text(
      role.role_name ||
        role.roles_name ||
        role.roles_name_eng
    ),
    roles_name: text(role.roles_name),
    roles_name_eng: text(role.roles_name_eng)
  };
}

export function normalizeStorePermissionTree(
  tree: RawTree
): StorePermissionTree {
  return {
    company_uuid_fk: text(tree.company_uuid_fk),
    roles: Array.isArray(tree.roles)
      ? tree.roles.map(normalizeRoleTree)
      : [],
    store_active: numberValue(tree.store_active, 1),
    store_name: text(
      tree.store_name ||
        tree.store_name_la ||
        tree.store_name_eng
    ),
    store_name_eng: text(tree.store_name_eng),
    store_name_la: text(tree.store_name_la),
    store_status: numberValue(tree.store_status, 2)
  };
}

export function checkedSubmenuIds(
  tree: StorePermissionTree | null
) {
  if (!tree) return [];

  const ids = tree.roles.flatMap((role) =>
    role.menus.flatMap((menu) =>
      menu.sub_detail
        .filter((submenu) => submenu.checked)
        .map((submenu) => submenu.sub_id)
    )
  );

  return Array.from(new Set(ids.filter(Boolean)));
}

export function buildStorePermissionSavePayload(
  input: StorePermissionSaveInput
): StorePermissionSaveInput {
  return {
    company_uuid_fk: requiredText(
      input.company_uuid_fk,
      "company_uuid_fk"
    ),
    role_id: requiredNumber(input.role_id, "role_id"),
    sub_id_list: Array.isArray(input.sub_id_list)
      ? input.sub_id_list.map(String).filter(Boolean)
      : []
  };
}

// Endpoint นี้ส่งทั้ง stores และ roles กลับมาใน request เดียว
// login_uuid ต้องเป็น UUID ของผู้ใช้ที่ล็อกอิน ไม่ใช่ user.status
export async function fetchStorePermissionOptions(
  loginUuid: string,
  lang?: string
): Promise<StorePermissionOptions> {
  const result = await apiRequest<
    ApiDataResponse<StorePermissionOptionsData>
  >(
    "get",
    ENDPOINTS.stores,
    {
      params: {
        login_uuid: requiredText(loginUuid, "login_uuid"),
        lang: toApiLanguage(lang)
      }
    },
    "Failed to fetch permission options"
  );

  const stores = Array.isArray(result.data?.stores)
    ? result.data.stores
        .map(normalizeStore)
        .filter((store) => store.store_uuid)
    : [];

  const roles = Array.isArray(result.data?.roles)
    ? result.data.roles
        .map(normalizeRole)
        .filter((role) => role.roles_id)
    : [];

  return {
    stores,
    roles
  };
}

export async function fetchStorePermissionTree(
  companyUuid: string,
  roleId: number,
  lang?: string
) {
  const result = await apiRequest<
    ApiListResponse<StorePermissionTree>
  >(
    "get",
    ENDPOINTS.tree,
    {
      params: {
        company_uuid_fk: requiredText(
          companyUuid,
          "company_uuid_fk"
        ),
        lang: toApiLanguage(lang),
        role_id: requiredNumber(roleId, "role_id")
      }
    },
    "Failed to fetch permission tree"
  );

  const first = responseRows(result.data)[0];
  return first ? normalizeStorePermissionTree(first) : null;
}

export async function fetchStorePermissionSavedList(
  companyUuid: string,
  viewerRoleId: number,
  lang?: string
) {
  const result = await apiRequest<
    ApiListResponse<StorePermissionTree>
  >(
    "get",
    ENDPOINTS.fetch,
    {
      params: {
        company_uuid_fk: requiredText(
          companyUuid,
          "company_uuid_fk"
        ),
        lang: toApiLanguage(lang),
        role_id: requiredNumber(viewerRoleId, "role_id")
      }
    },
    "Failed to fetch saved permission list"
  );

  const first = responseRows(result.data)[0];
  return first ? normalizeStorePermissionTree(first) : null;
}

export async function saveStorePermissions(
  input: StorePermissionSaveInput
) {
  const payload = buildStorePermissionSavePayload(input);

  await apiRequest<ApiDataResponse<unknown>>(
    "post",
    ENDPOINTS.save,
    { data: payload },
    "Failed to save permissions"
  );
}