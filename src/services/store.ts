import { uploadedUrl } from "@/lib/image";
import { createCrud } from "@/services/shared/crud";
import { apiRequest, ServiceError } from "@/lib/api";
import type { ApiEntity, ApiListResponse, FetchParams } from "@/services/shared/types";

export interface Store extends ApiEntity {
  store_uuid: string;
  store_name?: string;
  store_name_la?: string;
  store_name_eng?: string;
  store_email?: string;
  store_logo?: string;
  store_status?: number;
  store_active?: number;
}
export type StoreResponse = ApiListResponse<Store>;
export interface SaveStoreInput extends ApiEntity {}
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

export const getStores = (params: FetchStoresParams = {}) => crud.list(params);
export const getStoreOptions = (lang = "la") => crud.options({ lang });
export const saveStore = (input: SaveStoreInput) => crud.save(input);
export const deleteStore = (store_uuid: string) => crud.delete(store_uuid);
export const resetStorePassword = async (login_email: string) => {
  if (!login_email.trim()) throw new ServiceError("login_email is required", 400);
  await apiRequest("post", "/api/v1/store/reset_password", { data: { login_email } });
};
export const getStoreLogoUrl = (filename: string) => uploadedUrl(filename, "uploaded/store");
