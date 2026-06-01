import { apiRequest } from "@/lib/api";
import { toFormData } from "@/lib/form-data";
import { uploadedUrl } from "@/lib/image";
import { toApiLanguage } from "@/lib/language";
import { requiredUuid } from "@/services/shared/validators";
import { saveProductPayload } from "@/services/product/payload";
import { enabledPatch, notificationPatch, stockModePatch } from "@/services/product/validators";
import type { ApiDataResponse } from "@/services/shared/types";
import type {
  FetchProductsParams,
  Product,
  ProductEnabledPatch,
  ProductNotificationPatch,
  ProductResponse,
  ProductStockModePatch,
  SaveProductInput,
  SizeOption,
  StatusSort,
  UpdateProductEnabledResponse,
  UpdateProductNotificationResponse,
  UpdateProductStockModeResponse
} from "@/services/product/types";

export async function getProducts(params: FetchProductsParams = {}) {
  const query: Record<string, unknown> = {
    search: params.search ?? "",
    page: params.page ?? 1,
    lang: toApiLanguage(params.lang)
  };
  if (params.limit === "All") query.limit = "All";
  else if (params.limit !== null) query.limit = params.limit ?? 20;
  if (params.branch_uuid_fk) query.branch_uuid_fk = params.branch_uuid_fk;
  if (params.cate_uuid_fk !== undefined) query.cate_uuid_fk = params.cate_uuid_fk;
  if (params.status_sort_fk !== undefined) query.status_sort_fk = params.status_sort_fk;

  return apiRequest<ProductResponse>("get", "/api/v1/product/fetch_limit", { params: query });
}

export async function getStatusSorts(lang = "la") {
  const result = await apiRequest<ApiDataResponse<StatusSort[]>>("get", "/api/v1/status/fetch_all", {
    params: { lang: toApiLanguage(lang) }
  });
  return result.data ?? [];
}

export async function getSizesByStatus(store_uuid_fk: string, status_sort_fk: number, lang = "la") {
  const result = await apiRequest<ApiDataResponse<SizeOption[]>>("post", "/api/v1/status/fetch_size", {
    data: { store_uuid_fk, status_sort_fk, lang: toApiLanguage(lang) }
  });
  return result.data ?? [];
}

export async function saveProduct(input: SaveProductInput) {
  const result = await apiRequest<ApiDataResponse<Product>>("post", "/api/v1/product/create", {
    data: toFormData(saveProductPayload(input))
  });
  return result.data;
}

export const updateProductEnabled = (input: ProductEnabledPatch | string, pro_detail_enabled?: number) =>
  apiRequest<UpdateProductEnabledResponse>("patch", "/api/v1/product/update_enabled", {
    data: enabledPatch(input, pro_detail_enabled)
  });

export const updateProductStockMode = (
  input: ProductStockModePatch | string,
  pro_detail_stock?: number
) =>
  apiRequest<UpdateProductStockModeResponse>("patch", "/api/v1/product/update_stock_mode", {
    data: stockModePatch(input, pro_detail_stock)
  });

export const updateProductNotificationEnabled = (
  input: ProductNotificationPatch | string,
  prod_notification?: number
) =>
  apiRequest<UpdateProductNotificationResponse>("patch", "/api/v1/product/notification_enabled", {
    data: notificationPatch(input, prod_notification)
  });

export async function deleteProduct(prod_uuid: string) {
  await apiRequest("delete", "/api/v1/product/delete", {
    data: { prod_uuid: requiredUuid(prod_uuid, "prod_uuid") }
  });
}

export const getProductImageUrl = (filename: string) =>
  filename?.startsWith("#") ? filename : uploadedUrl(filename, "uploaded/products");
