import { createCrud } from "@/services/shared/crud";
import type { ApiEntity, ApiListResponse, FetchParams } from "@/services/shared/types";

export interface SetChildOption extends ApiEntity {
  set_child_option_uuid: string;
  store_uuid_fk?: string;
  set_child_option_name?: string;
  set_child_option_name_la?: string;
  set_child_option_name_eng?: string;
  set_child_option_status?: number | string;
  set_child_option_sort?: number | string;
}

export interface SaveSetChildOptionInput extends ApiEntity {
  set_child_option_uuid?: string;
  store_uuid_fk: string;
  set_child_option_name_la: string;
  set_child_option_name_eng: string;
  set_child_option_status?: number;
  set_child_option_sort?: number;
}

export interface FetchSetChildOptionsParams extends FetchParams {}
export type SetChildOptionResponse = ApiListResponse<SetChildOption>;

const crud = createCrud<SetChildOption>(
  {
    fetch: "/api/v1/set-child-option/fetch_limit",
    fetchAll: "/api/v1/set-child-option/fetch_all",
    create: "/api/v1/set-child-option/create",
    delete: "/api/v1/set-child-option/delete",
  },
  "set_child_option_uuid",
);

export const getSetChildOptions = (params: FetchSetChildOptionsParams = {}) =>
  crud.list(params);
export const saveSetChildOption = (input: SaveSetChildOptionInput) => crud.save(input);
export const deleteSetChildOption = (set_child_option_uuid: string) =>
  crud.delete(set_child_option_uuid);
