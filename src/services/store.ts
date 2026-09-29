import { createCrud } from "@/services/shared/crud";
import { apiRequest, ServiceError } from "@/lib/api";
import type { ApiEntity, ApiListResponse, FetchParams } from "@/services/shared/types";
export { getStoreLogoUrl } from "@/lib/image";

export interface Store extends ApiEntity {
  store_uuid: string;
  store_name?: string;
  store_name_la?: string;
  store_name_eng?: string;
  store_email?: string;
  store_logo?: string;
  store_status?: number;
  store_active?: number;
  store_table_status?: number;
  lak_rounding_version?: number;
  deposit_expire_days?: number | null;
  store_opened_on?: string | null;
  annual_due_on?: string | null;
  annual_days_remaining?: number | null;
}
export interface StoreReportSummary extends ApiEntity {
  total: number;
  general: number;
  plc: number;
  test: number;
  active: number;
  inactive: number;
}
export interface StoreResponse extends ApiListResponse<Store> {
  summary?: StoreReportSummary;
}
export interface SaveStoreInput extends ApiEntity {
  store_table_status?: number;
  lak_rounding_version?: number;
  deposit_expire_days?: number | null;
}
export interface FetchStoresParams extends FetchParams {}

const crud = createCrud<Store>(
  {
    fetch: "/api/v1/store/fetch_limit",
    fetchAll: "/api/v1/store/fetch_all",
    create: "/api/v1/store/create",
    delete: "/api/v1/store/delete"
  },
  "store_uuid",
  true
);

export const getStores = (params: FetchStoresParams = {}) => crud.list(params) as Promise<StoreResponse>;
export const getStoreOptions = (lang = "la") => crud.options({ lang });
export const saveStore = (input: SaveStoreInput) => crud.save(input);
export const deleteStore = (store_uuid: string) => crud.delete(store_uuid);
export const resetStorePassword = async (login_email: string) => {
  if (!login_email.trim()) throw new ServiceError("login_email is required", 400);
  await apiRequest("post", "/api/v1/store/reset_password", { data: { login_email } });
};
