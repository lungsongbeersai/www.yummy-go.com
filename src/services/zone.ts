import { createCrud } from "@/services/shared/crud";
import type { ApiEntity, ApiListResponse, FetchParams } from "@/services/shared/types";

export interface Zone extends ApiEntity {
  zone_uuid: string;
  zone_name?: string;
  zone_name_la?: string;
  zone_name_eng?: string;
}
export type ZoneResponse = ApiListResponse<Zone>;
export interface SaveZoneInput extends ApiEntity {}
export interface FetchZonesParams extends FetchParams {}

const crud = createCrud<Zone>(
  {
    fetch: "/api/v1/zone/fetch_limit",
    fetchAll: "/api/v1/zone/fetch_all",
    create: "/api/v1/zone/create",
    delete: "/api/v1/zone/delete"
  },
  "zone_uuid"
);

export const getZones = (params: FetchZonesParams = {}) => crud.list(params);
export const getZoneOptions = (lang = "la", branch_uuid_fk = "") => crud.options({ lang, branch_uuid_fk });
export const saveZone = (input: SaveZoneInput) => crud.save(input);
export const deleteZone = (zone_uuid: string) => crud.delete(zone_uuid);
