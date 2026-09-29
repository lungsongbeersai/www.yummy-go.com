import { createCrud } from "@/services/shared/crud";
import type { ApiEntity, ApiListResponse, FetchParams } from "@/services/shared/types";

export interface Position extends ApiEntity {
  position_uuid: string;
  position_code?: string;
  position_name?: string;
  position_name_la?: string;
  position_name_eng?: string;
  position_active?: number;
}

export type PositionResponse = ApiListResponse<Position>;
export interface SavePositionInput extends ApiEntity {}
export interface FetchPositionsParams extends FetchParams {}

const crud = createCrud<Position>(
  {
    fetch: "/api/v1/position/fetch_limit",
    fetchAll: "/api/v1/position/fetch_all",
    create: "/api/v1/position/create",
    delete: "/api/v1/position/delete"
  },
  "position_uuid"
);

export const getPositions = (params: FetchPositionsParams = {}) => crud.list(params);
export const getPositionOptions = (lang = "la") => crud.options({ active_only: 1, lang });
export const getAllPositions = (lang = "la") => crud.options({ lang });
export const savePosition = (input: SavePositionInput) => crud.save(input);
export const deletePosition = (position_uuid: string) => crud.delete(position_uuid);
