import { createCrud } from "@/services/shared/crud";
import type { ApiEntity, ApiListResponse, FetchParams } from "@/services/shared/types";

export interface Sauce extends ApiEntity {
  sauce_uuid: string;
  store_uuid_fk?: string;
  sauce_name?: string;
  sauce_name_la?: string;
  sauce_name_eng?: string;
  sauce_status?: number | string;
  sauce_sort?: number | string;
}

export type SauceResponse = ApiListResponse<Sauce>;
export interface FetchSaucesParams extends FetchParams {}
export interface SaveSauceInput extends ApiEntity {
  sauce_uuid?: string;
  store_uuid_fk?: string;
  sauce_name_la?: string;
  sauce_name_eng?: string;
  sauce_status?: number;
  sauce_sort?: number;
}

const crud = createCrud<Sauce>(
  {
    fetch: "/api/v1/sauce/fetch_limit",
    fetchAll: "/api/v1/sauce/fetch_all",
    create: "/api/v1/sauce/create",
    delete: "/api/v1/sauce/delete",
  },
  "sauce_uuid",
);

export const getSauces = (params: FetchSaucesParams = {}) => crud.list(params);
export const getSauceOptions = (lang = "la", storeUuid?: string) =>
  crud.options({ lang, store_uuid_fk: storeUuid });
export const saveSauce = (input: SaveSauceInput) => crud.save(input);
export const deleteSauce = (sauceUuid: string) => crud.delete(sauceUuid);
