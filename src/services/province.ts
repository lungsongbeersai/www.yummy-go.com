import { createCrud } from "@/services/shared/crud";
import type { ApiEntity, ApiListResponse, FetchParams } from "@/services/shared/types";

export interface Province extends ApiEntity {
  province_uuid: string;
  province_name?: string;
}
export type ProvinceResponse = ApiListResponse<Province>;
export interface SaveProvinceInput extends ApiEntity {}
export interface FetchProvincesParams extends FetchParams {}

const crud = createCrud<Province>(
  {
    fetch: "/api/v1/province/fetch_limit",
    fetchAll: "/api/v1/province/fetch_all",
    create: "/api/v1/province/create",
    delete: "/api/v1/province/delete"
  },
  "province_uuid"
);

export const getProvinces = (params: FetchProvincesParams = {}) => crud.list(params);
export const getProvinceOptions = (lang = "la") => crud.options({ lang });
export const saveProvince = (input: SaveProvinceInput) => crud.save(input);
export const deleteProvince = (province_uuid: string) => crud.delete(province_uuid);
