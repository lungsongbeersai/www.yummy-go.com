import { createCrud } from "@/services/shared/crud";
import type { ApiEntity, ApiListResponse, FetchParams } from "@/services/shared/types";

export interface District extends ApiEntity {
  district_uuid: string;
  district_name?: string;
  district_name_la?: string;
  district_name_eng?: string;
  province_uuid_fk?: string;
  province_name?: string;
  province_name_la?: string;
  province_name_eng?: string;
}
export interface ProvinceGroup extends ApiEntity {
  province_uuid_fk: string;
  province_name?: string;
  province_name_la?: string;
  province_name_eng?: string;
  district_count?: number;
  districts?: District[];
}
export type DistrictResponse = ApiListResponse<District | ProvinceGroup>;
export interface SaveDistrictInput extends ApiEntity {}
export interface FetchDistrictsParams extends FetchParams {}

const crud = createCrud<District>(
  {
    fetch: "/api/v1/district/fetch_limit",
    fetchAll: "/api/v1/district/fetch_limit",
    create: "/api/v1/district/create",
    delete: "/api/v1/district/delete"
  },
  "district_uuid"
);

function isProvinceGroup(row: District | ProvinceGroup): row is ProvinceGroup {
  return Array.isArray((row as ProvinceGroup).districts);
}

function flattenDistricts(rows: Array<District | ProvinceGroup>): District[] {
  return rows.flatMap((row) => {
    if (!isProvinceGroup(row)) return [row as District];
    return (row.districts ?? []).map((district) => ({
      ...district,
      province_uuid_fk: district.province_uuid_fk ?? row.province_uuid_fk,
      province_name: district.province_name ?? row.province_name,
      province_name_la: district.province_name_la ?? row.province_name_la,
      province_name_eng: district.province_name_eng ?? row.province_name_eng
    }));
  });
}

export const getDistricts = async (params: FetchDistrictsParams = {}) => {
  const result = await crud.list(params);
  const raw = result.data as Array<District | ProvinceGroup>;
  const grouped = raw.some(isProvinceGroup);
  const data = flattenDistricts(raw);
  if (!grouped) return { ...result, data };
  const limit = Number(params.limit);
  const total = data.length;
  const totalPages = Number.isFinite(limit) && limit > 0 ? Math.max(1, Math.ceil(total / limit)) : 1;
  return { ...result, data, total, totalPages };
};
export const saveDistrict = (input: SaveDistrictInput) => crud.save(input);
export const deleteDistrict = (district_uuid: string) => crud.delete(district_uuid);
