import type { SaveZoneInput, Zone } from "@/services/zone";

export function zoneValue(row: Zone | null | undefined, key: string, fallback = "") {
  const raw = row?.[key];
  if (raw === null || raw === undefined || raw === "") return fallback;
  return String(raw);
}

export function zoneId(row: Zone | null | undefined) {
  return zoneValue(row, "zone_uuid");
}

export function zoneName(row: Zone | null | undefined) {
  return zoneValue(row, "zone_name", zoneValue(row, "zone_name_la", zoneValue(row, "zone_name_eng", "-")));
}

export type ZoneMissingField = "branch" | "name" | null;

export function missingZoneField({
  branchUuid,
  nameLa
}: {
  branchUuid: string;
  nameLa: string;
}): ZoneMissingField {
  if (!branchUuid.trim()) return "branch";
  if (!nameLa.trim()) return "name";
  return null;
}

export function buildZonePayload({
  branchUuid,
  editing,
  nameEng,
  nameLa
}: {
  branchUuid: string;
  editing: Zone | null;
  nameEng: string;
  nameLa: string;
}): SaveZoneInput {
  return {
    branch_uuid_fk: branchUuid,
    zone_uuid: zoneId(editing),
    zone_name_la: nameLa.trim(),
    zone_name_eng: nameEng.trim()
  };
}
