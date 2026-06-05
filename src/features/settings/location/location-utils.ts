import type { District, SaveDistrictInput } from "@/services/district";
import type { Province, SaveProvinceInput } from "@/services/province";
import type { ApiEntity } from "@/services/shared/types";

export type LocationKind = "province" | "district";
export type LocationRow = ApiEntity;

export interface DistrictGroup {
  provinceId: string;
  provinceName: string;
  districts: Array<{ row: LocationRow; index: number }>;
}

export interface NumberedDistrictGroup extends Omit<DistrictGroup, "districts"> {
  districts: Array<{ row: LocationRow; rowNumber: number }>;
}

export function locationValue(row: ApiEntity | null | undefined, key: string, fallback = "") {
  const raw = row?.[key];
  if (raw === null || raw === undefined || raw === "") return fallback;
  return String(raw);
}

export function locationId(row: ApiEntity | null | undefined, kind: LocationKind) {
  return locationValue(row, kind === "province" ? "province_uuid" : "district_uuid");
}

export function locationName(row: ApiEntity | null | undefined, kind: LocationKind) {
  const prefix = kind === "province" ? "province" : "district";
  return locationValue(row, `${prefix}_name`, locationValue(row, `${prefix}_name_la`, locationValue(row, `${prefix}_name_eng`, "-")));
}

export function provinceLabel(row: ApiEntity | null | undefined) {
  return locationValue(row, "province_name", locationValue(row, "province_name_la", locationValue(row, "province_name_eng", "-")));
}

export function groupDistrictRows(rows: LocationRow[], provinceById: Map<string, LocationRow>): DistrictGroup[] {
  const groups = new Map<string, DistrictGroup>();

  rows.forEach((row, index) => {
    const provinceId = locationValue(row, "province_uuid_fk") || "__unknown__";
    const province = provinceById.get(provinceId);
    const group = groups.get(provinceId) ?? {
      provinceId,
      provinceName: province ? provinceLabel(province) : provinceLabel(row),
      districts: []
    };

    group.districts.push({ row, index });
    groups.set(provinceId, group);
  });

  return Array.from(groups.values());
}

export function buildNumberedDistrictGroups(groups: DistrictGroup[], pageStart: number): NumberedDistrictGroup[] {
  return groups.map((group) => ({
    ...group,
    districts: group.districts.map(({ row, index }) => ({ row, rowNumber: pageStart + index }))
  }));
}

export type DistrictMissingField = "province" | "name" | null;
export type ProvinceMissingField = "name" | null;

export function missingDistrictField({
  nameLa,
  provinceUuid
}: {
  nameLa: string;
  provinceUuid: string;
}): DistrictMissingField {
  if (!provinceUuid.trim()) return "province";
  if (!nameLa.trim()) return "name";
  return null;
}

export function missingProvinceField({ nameLa }: { nameLa: string }): ProvinceMissingField {
  if (!nameLa.trim()) return "name";
  return null;
}

export function buildDistrictPayload({
  editing,
  nameEng,
  nameLa,
  provinceUuid
}: {
  editing: District | LocationRow | null;
  nameEng: string;
  nameLa: string;
  provinceUuid: string;
}): SaveDistrictInput {
  const payload: SaveDistrictInput = {
    province_uuid_fk: provinceUuid.trim(),
    district_name_la: nameLa.trim(),
    district_name_eng: nameEng.trim()
  };
  const id = locationId(editing, "district");
  if (id) payload.district_uuid = id;
  return payload;
}

export function buildProvincePayload({
  editing,
  nameEng,
  nameLa
}: {
  editing: Province | LocationRow | null;
  nameEng: string;
  nameLa: string;
}): SaveProvinceInput {
  const payload: SaveProvinceInput = {
    province_name_la: nameLa.trim(),
    province_name_eng: nameEng.trim()
  };
  const id = locationId(editing, "province");
  if (id) payload.province_uuid = id;
  return payload;
}
