import type { Category, CategoryVisibility, CategoryVisibilityRole, SaveCategoryInput } from "@/services/category";
import type { Group } from "@/services/group";

export interface GroupOption {
  label: string;
  value: string;
}

export function categoryValue(row: Category | Group | null | undefined, key: string, fallback = "") {
  const raw = row?.[key];
  if (raw === null || raw === undefined || raw === "") return fallback;
  return String(raw);
}

export function categoryId(row: Category | null | undefined) {
  return categoryValue(row, "cate_uuid");
}

export function categoryGroupId(row: Category | null | undefined) {
  return categoryValue(row, "group_uuid_fk", categoryValue(row, "group_uuid"));
}

export function categoryName(row: Category | null | undefined) {
  return categoryValue(row, "cate_name", categoryValue(row, "cate_name_la", categoryValue(row, "cate_name_eng", "-")));
}

export function groupLabel(row: Category | Group | null | undefined) {
  return categoryValue(row, "group_name", categoryValue(row, "group_name_la", categoryValue(row, "group_name_eng", "-")));
}

export function rowStoreUuid(rows: Category[]) {
  return categoryValue(rows[0] ?? null, "store_uuid_fk");
}

export function categoryVisibility(row: Category | null): CategoryVisibility {
  return {
    visibility_all_roles: row?.visibility_all_roles !== false,
    visibility_role_ids: [...new Set(row?.visibility_role_ids ?? [])],
  };
}

export function categoryVisibilityFromFormData(formData: FormData): CategoryVisibility | undefined {
  if (!formData.has("visibility_all_roles")) return undefined;
  const allRoles = formData.get("visibility_all_roles") === "true";
  return {
    visibility_all_roles: allRoles,
    visibility_role_ids: allRoles ? [] : [...new Set(formData.getAll("visibility_role_ids").map(Number))],
  };
}

export function categoryVisibilityRoleLabel(role: CategoryVisibilityRole, language: string) {
  return (language.startsWith("en") ? role.roles_name_eng : role.roles_name_la) ||
    role.roles_name || role.roles_name_la || role.roles_name_eng || String(role.roles_id);
}

export type CategoryMissingField = "store" | "group" | "name" | "icon" | "visibility_roles" | null;

export function missingCategoryField({
  groupUuid,
  icon,
  nameLa,
  storeUuid,
  visibility,
}: {
  groupUuid: string;
  icon: string;
  nameLa: string;
  storeUuid: string;
  visibility?: CategoryVisibility;
}): CategoryMissingField {
  if (!storeUuid.trim()) return "store";
  if (!groupUuid.trim()) return "group";
  if (!nameLa.trim()) return "name";
  if (!icon.trim()) return "icon";
  if (visibility?.visibility_all_roles === false && !visibility.visibility_role_ids.length) return "visibility_roles";
  return null;
}

export function buildCategoryPayload({
  editing,
  groupUuid,
  icon,
  nameEng,
  nameLa,
  storeUuid,
  visibility,
}: {
  editing: Category | null;
  groupUuid: string;
  icon: string;
  nameEng: string;
  nameLa: string;
  storeUuid: string;
  visibility?: CategoryVisibility;
}): SaveCategoryInput {
  const payload: SaveCategoryInput = {
    store_uuid_fk: storeUuid,
    group_uuid_fk: groupUuid.trim(),
    cate_name_la: nameLa.trim(),
    cate_name_eng: nameEng.trim(),
    cate_icon: icon.trim()
  };
  const id = categoryId(editing);
  if (id) payload.cate_uuid = id;
  if (visibility) {
    payload.visibility_all_roles = visibility.visibility_all_roles;
    payload.visibility_role_ids = visibility.visibility_all_roles ? [] : visibility.visibility_role_ids;
  }
  return payload;
}
