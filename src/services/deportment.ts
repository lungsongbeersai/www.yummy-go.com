import { createCrud } from "@/services/shared/crud";
import type { ApiEntity, ApiListResponse, FetchParams } from "@/services/shared/types";

export interface Deportment extends ApiEntity {
  deportment_uuid: string;
  deportment_code?: string;
  deportment_name?: string;
  deportment_name_la?: string;
  deportment_name_eng?: string;
  deportment_active?: number;
}

export type DeportmentResponse = ApiListResponse<Deportment>;
export interface SaveDeportmentInput extends ApiEntity {}
export interface FetchDeportmentsParams extends FetchParams {}

const crud = createCrud<Deportment>(
  {
    fetch: "/api/v1/deportment/fetch_limit",
    fetchAll: "/api/v1/deportment/fetch_all",
    create: "/api/v1/deportment/create",
    delete: "/api/v1/deportment/delete"
  },
  "deportment_uuid"
);

export const getDeportments = (params: FetchDeportmentsParams = {}) => crud.list(params);
export const getDeportmentOptions = (lang = "la") => crud.options({ active_only: 1, lang });
export const saveDeportment = (input: SaveDeportmentInput) => crud.save(input);
export const deleteDeportment = (deportment_uuid: string) => crud.delete(deportment_uuid);
