import { createCrud } from "@/services/shared/crud";
import type { ApiEntity, ApiListResponse, FetchParams } from "@/services/shared/types";

export interface Taste extends ApiEntity {
  taste_uuid: string;
  store_uuid_fk?: string;
  taste_name?: string;
  taste_name_la?: string;
  taste_name_eng?: string;
  taste_status?: number | string;
  taste_sort?: number | string;
}

export type TasteResponse = ApiListResponse<Taste>;

export interface SaveTasteInput extends ApiEntity {
  taste_uuid?: string;
  store_uuid_fk?: string;
  taste_name_la?: string;
  taste_name_eng?: string;
  taste_status?: number;
  taste_sort?: number;
}

export interface FetchTastesParams extends FetchParams {}

const crud = createCrud<Taste>(
  {
    fetch: "/api/v1/taste/fetch_limit",
    fetchAll: "/api/v1/taste/fetch_all",
    create: "/api/v1/taste/create",
    delete: "/api/v1/taste/delete",
  },
  "taste_uuid",
);

export const getTastes = (params: FetchTastesParams = {}) => crud.list(params);
export const getTasteOptions = (lang = "la", storeUuid?: string) =>
  crud.options({ lang, store_uuid_fk: storeUuid });
export const saveTaste = (input: SaveTasteInput) => crud.save(input);
export const deleteTaste = (taste_uuid: string) => crud.delete(taste_uuid);
