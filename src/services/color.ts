import { createCrud } from "@/services/shared/crud";
import type { ApiEntity, ApiListResponse, FetchParams } from "@/services/shared/types";

export interface Color extends ApiEntity {
  color_uuid: string;
  color_name?: string;
  color_code?: string;
}
export type ColorResponse = ApiListResponse<Color>;
export interface SaveColorInput extends ApiEntity {}
export interface FetchColorsParams extends FetchParams {}

const crud = createCrud<Color>(
  {
    fetch: "/api/v1/colors/fetch_limit",
    fetchAll: "/api/v1/colors/fetch_limit",
    create: "/api/v1/colors/create",
    delete: "/api/v1/colors/delete"
  },
  "color_uuid"
);

export const getColors = (params: FetchColorsParams = {}) => crud.list(params);
export const getColorOptions = async () => (await crud.list({ limit: "All" })).data;
export const saveColor = (input: SaveColorInput) => crud.save(input);
export const deleteColor = (color_uuid: string) => crud.delete(color_uuid);
