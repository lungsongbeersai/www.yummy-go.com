import { createCrud } from "@/services/shared/crud";
import type { ApiEntity, ApiListResponse, FetchParams } from "@/services/shared/types";

export interface Size extends ApiEntity {
  size_uuid: string;
  size_name?: string;
  size_name_la?: string;
  size_name_eng?: string;
}
export type SizeResponse = ApiListResponse<Size>;
export interface SaveSizeInput extends ApiEntity {}
export interface FetchSizesParams extends FetchParams {}

const crud = createCrud<Size>(
  {
    fetch: "/api/v1/sizes/fetch_limit",
    fetchAll: "/api/v1/sizes/fetch_all",
    create: "/api/v1/sizes/create",
    delete: "/api/v1/sizes/delete"
  },
  "size_uuid"
);

export const getSizes = (params: FetchSizesParams = {}) => crud.list(params);
export const getSizeOptions = (lang = "la", storeUuid?: string) =>
  crud.options({ lang, store_uuid_fk: storeUuid });
export const saveSize = (input: SaveSizeInput) => crud.save(input);
export const deleteSize = (size_uuid: string) => crud.delete(size_uuid);
