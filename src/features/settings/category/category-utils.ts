import type { Category, SaveCategoryInput } from "@/services/category";
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

export function categoryName(row: Category | null | undefined) {
  return categoryValue(row, "cate_name", categoryValue(row, "cate_name_la", categoryValue(row, "cate_name_eng", "-")));
}

export function groupLabel(row: Category | Group | null | undefined) {
  return categoryValue(row, "group_name", categoryValue(row, "group_name_la", categoryValue(row, "group_name_eng", "-")));
}

export function rowStoreUuid(rows: Category[]) {
  return categoryValue(rows[0] ?? null, "store_uuid_fk");
}

export type CategoryMissingField = "store" | "group" | "name" | "icon" | null;

export function missingCategoryField({
  groupUuid,
  icon,
  nameLa,
  storeUuid
}: {
  groupUuid: string;
  icon: string;
  nameLa: string;
  storeUuid: string;
}): CategoryMissingField {
  if (!storeUuid.trim()) return "store";
  if (!groupUuid.trim()) return "group";
  if (!nameLa.trim()) return "name";
  if (!icon.trim()) return "icon";
  return null;
}

export function buildCategoryPayload({
  editing,
  groupUuid,
  icon,
  nameEng,
  nameLa,
  storeUuid
}: {
  editing: Category | null;
  groupUuid: string;
  icon: string;
  nameEng: string;
  nameLa: string;
  storeUuid: string;
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
  return payload;
}
