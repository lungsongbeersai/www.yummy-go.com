import type { SaveSizeInput, Size } from "@/services/size";

export function sizeValue(row: Size | null | undefined, key: string, fallback = "") {
  const raw = row?.[key];
  if (raw === null || raw === undefined || raw === "") return fallback;
  return String(raw);
}

export function sizeId(row: Size | null | undefined) {
  return sizeValue(row, "size_uuid");
}

export function sizeName(row: Size | null | undefined) {
  return sizeValue(row, "size_name", sizeValue(row, "size_name_la", sizeValue(row, "size_name_eng", "-")));
}

export type SizeMissingField = "name" | null;

export function missingSizeField({ nameLa }: { nameLa: string }): SizeMissingField {
  if (!nameLa.trim()) return "name";
  return null;
}

export function buildSizePayload({
  editing,
  nameEng,
  nameLa,
  storeUuid
}: {
  editing: Size | null;
  nameEng: string;
  nameLa: string;
  storeUuid: string;
}): SaveSizeInput {
  return {
    store_uuid_fk: storeUuid,
    size_uuid: sizeId(editing),
    size_name_la: nameLa.trim(),
    size_name_eng: nameEng.trim(),
    status_sort_fk: 1
  };
}
