import { createCrud } from "@/services/shared/crud";
import type { ApiEntity, ApiListResponse, FetchParams } from "@/services/shared/types";

export interface Currency extends ApiEntity {
  currency_id?: number;
  currency_uuid: string;
  currency_name?: string;
  currency_icon?: string;
  currency_status?: number;
}
export type CurrencyResponse = ApiListResponse<Currency>;
export interface SaveCurrencyInput extends ApiEntity {
  currency_uuid?: string;
  currency_name?: string;
  currency_icon?: string;
  currency_status?: number | string;
}
export interface FetchCurrenciesParams extends FetchParams {}

const crud = createCrud<Currency>(
  {
    fetch: "/api/v1/currency/fetch_all",
    fetchAll: "/api/v1/currency/fetch_all",
    create: "/api/v1/currency/create",
    delete: "/api/v1/currency/delete"
  },
  "currency_uuid"
);

export const getCurrencies = (params: FetchCurrenciesParams = {}) => crud.list(params);
export const getCurrencyOptions = () => crud.options();
export const saveCurrency = (input: SaveCurrencyInput) =>
  crud.save({
    ...input,
    currency_uuid: input.currency_uuid ?? "",
    currency_status: Number(input.currency_status ?? 1)
  });
export const deleteCurrency = (currency_uuid: string) => crud.delete(currency_uuid);
