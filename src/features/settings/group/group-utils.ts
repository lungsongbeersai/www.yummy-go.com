import type { Group, SaveGroupInput } from "@/services/group";

export function groupValue(row: Group | null | undefined, key: string, fallback = "") {
  const raw = row?.[key];
  if (raw === null || raw === undefined || raw === "") return fallback;
  return String(raw);
}

export function groupId(row: Group | null | undefined) {
  return groupValue(row, "group_uuid");
}

export function groupName(row: Group | null | undefined) {
  return groupValue(row, "group_name", groupValue(row, "group_name_la", groupValue(row, "group_name_eng", "-")));
}

export type GroupMissingField = "store" | "name" | null;

export function missingGroupField({ nameLa, storeUuid }: { nameLa: string; storeUuid: string }): GroupMissingField {
  if (!storeUuid.trim()) return "store";
  if (!nameLa.trim()) return "name";
  return null;
}

export function buildGroupPayload({
  editing,
  nameEng,
  nameLa,
  storeUuid
}: {
  editing: Group | null;
  nameEng: string;
  nameLa: string;
  storeUuid: string;
}): SaveGroupInput {
  const payload: SaveGroupInput = {
    store_uuid_fk: storeUuid,
    group_name_la: nameLa.trim(),
    group_name_eng: nameEng.trim()
  };
  const id = groupId(editing);
  if (id) payload.group_uuid = id;
  return payload;
}
