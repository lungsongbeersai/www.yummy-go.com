import type { SaveUnitInput, Unit } from "@/services/unit";

export function unitValue(row: Unit | null | undefined, key: string, fallback = "") {
  const raw = row?.[key];
  if (raw === null || raw === undefined || raw === "") return fallback;
  return String(raw);
}

export function unitId(row: Unit | null | undefined) {
  return unitValue(row, "unite_uuid");
}

export function unitName(row: Unit | null | undefined) {
  return unitValue(row, "unite_name", unitValue(row, "unite_name_la", unitValue(row, "unite_name_eng", "-")));
}

export type UnitMissingField = "name" | null;

export function missingUnitField({ nameLa }: { nameLa: string }): UnitMissingField {
  if (!nameLa.trim()) return "name";
  return null;
}

export function buildUnitPayload({
  editing,
  nameEng,
  nameLa,
  storeUuid
}: {
  editing: Unit | null;
  nameEng: string;
  nameLa: string;
  storeUuid: string;
}): SaveUnitInput {
  return {
    store_uuid_fk: storeUuid,
    unite_uuid: unitId(editing),
    unite_name_la: nameLa.trim(),
    unite_name_eng: nameEng.trim()
  };
}
