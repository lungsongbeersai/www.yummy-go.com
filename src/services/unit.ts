import { createCrud } from "@/services/shared/crud";
import type { ApiEntity, ApiListResponse, FetchParams } from "@/services/shared/types";

export interface Unit extends ApiEntity {
  unite_uuid: string;
  unite_name?: string;
  unite_name_la?: string;
  unite_name_eng?: string;
}
export type UnitResponse = ApiListResponse<Unit>;
export interface SaveUnitInput extends ApiEntity {}
export interface FetchUnitsParams extends FetchParams {}

const crud = createCrud<Unit>(
  {
    fetch: "/api/v1/unite/fetch_limit",
    fetchAll: "/api/v1/unite/fetch_all",
    create: "/api/v1/unite/create",
    delete: "/api/v1/unite/delete"
  },
  "unite_uuid"
);

export const getUnits = (params: FetchUnitsParams = {}) => crud.list(params);
export const getUnitOptions = (lang = "la", storeUuid?: string) =>
  crud.options({ lang, store_uuid_fk: storeUuid });
export const saveUnit = (input: SaveUnitInput) => crud.save(input);
export const deleteUnit = (unite_uuid: string) => crud.delete(unite_uuid);
