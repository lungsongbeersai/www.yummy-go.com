import { apiRequest, ServiceError } from "@/lib/api";
import { toApiLanguage } from "@/lib/language";
import { createCrud } from "@/services/shared/crud";
import type { ApiEntity, ApiListResponse, FetchParams } from "@/services/shared/types";

export interface Exchange extends ApiEntity {
  ex_id?: number;
  ex_uuid: string;
  currency_uuid_fk?: string;
  currency_name?: string;
  currency_icon?: string;
  branch_uuid_fk?: string;
  store_uuid_fk?: string;
  ex_price?: number | string;
  ex_status?: number | string;
}
export type ExchangeResponse = ApiListResponse<Exchange>;
export interface SaveExchangeInput extends ApiEntity {}
export interface FetchExchangesParams extends FetchParams {}
export interface FetchAllExchangesParams extends FetchParams {
  store_uuid_fk: string;
}

const crud = createCrud<Exchange>(
  {
    fetch: "/api/v1/exchange/fetch_limit",
    fetchAll: "/api/v1/exchange/fetch_all",
    create: "/api/v1/exchange/create",
    delete: "/api/v1/exchange/delete"
  },
  "ex_uuid"
);

export const getExchanges = (params: FetchExchangesParams = {}) => crud.list(params);
export async function getAllExchanges(params: FetchAllExchangesParams) {
  if (!params.store_uuid_fk?.trim()) throw new ServiceError("store_uuid_fk is required", 400);
  return apiRequest<ExchangeResponse>("get", "/api/v1/exchange/fetch_all", {
    params: {
      store_uuid_fk: params.store_uuid_fk,
      lang: toApiLanguage(params.lang)
    }
  });
}
export const saveExchange = (input: SaveExchangeInput) => crud.save(input);
export const deleteExchange = (ex_uuid: string) => crud.delete(ex_uuid);
