import { createCrud } from "@/services/shared/crud";
import type { ApiEntity, ApiListResponse, FetchParams } from "@/services/shared/types";

export interface Topping extends ApiEntity {
  topping_uuid: string;
  store_uuid_fk?: string;
  topping_name?: string;
  topping_name_la?: string;
  topping_name_eng?: string;
}
export type ToppingResponse = ApiListResponse<Topping>;
export interface SaveToppingInput extends ApiEntity {
  topping_uuid?: string;
  store_uuid_fk?: string;
  topping_name_la?: string;
  topping_name_eng?: string;
}
export interface FetchToppingsParams extends FetchParams {}

const crud = createCrud<Topping>(
  {
    fetch: "/api/v1/topping/fetch_limit",
    fetchAll: "/api/v1/topping/fetch_all",
    create: "/api/v1/topping/create",
    delete: "/api/v1/topping/delete"
  },
  "topping_uuid"
);

export const getToppings = (params: FetchToppingsParams = {}) => crud.list(params);
export const getToppingOptions = (lang = "la", storeUuid?: string) =>
  crud.options({ lang, store_uuid_fk: storeUuid });
export const saveTopping = (input: SaveToppingInput) => crud.save(input);
export const deleteTopping = (topping_uuid: string) => crud.delete(topping_uuid);
