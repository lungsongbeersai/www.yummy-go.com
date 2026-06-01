import { createCrud } from "@/services/shared/crud";
import type { ApiEntity, ApiListResponse, FetchParams } from "@/services/shared/types";

export interface Group extends ApiEntity {
  group_uuid: string;
  group_name?: string;
  group_name_la?: string;
  group_name_eng?: string;
}
export type GroupResponse = ApiListResponse<Group>;
export interface SaveGroupInput extends ApiEntity {}
export interface FetchGroupsParams extends FetchParams {}

const crud = createCrud<Group>(
  {
    fetch: "/api/v1/groups/fetch_limit",
    fetchAll: "/api/v1/groups/fetch_all",
    create: "/api/v1/groups/create",
    delete: "/api/v1/groups/delete"
  },
  "group_uuid"
);

export const getGroups = (params: FetchGroupsParams = {}) => crud.list(params);
export const getGroupOptions = (lang = "la", store_uuid_fk = "") =>
  crud.options({ lang, store_uuid_fk });
export const saveGroup = (input: SaveGroupInput) => crud.save(input);
export const deleteGroup = (group_uuid: string) => crud.delete(group_uuid);
