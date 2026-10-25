import { apiRequest } from "@/lib/api";
import { createCrud } from "@/services/shared/crud";
import { toApiLanguage } from "@/lib/language";
import type { ApiDataResponse, ApiEntity, ApiListResponse, FetchParams } from "@/services/shared/types";

export interface CategoryVisibility {
  visibility_all_roles: boolean;
  visibility_role_ids: number[];
}

export interface CategoryVisibilityRole extends ApiEntity {
  roles_id: number;
  roles_name?: string;
  roles_name_la?: string;
  roles_name_eng?: string;
}

export interface Category extends ApiEntity {
  cate_uuid: string;
  cate_name?: string;
  cate_name_la?: string;
  cate_name_eng?: string;
  cate_icon?: string;
  cate_sort?: string | number;
  group_uuid_fk?: string;
  group_uuid?: string;
  group_name?: string;
  group_name_la?: string;
  group_name_eng?: string;
  visibility_all_roles?: boolean;
  visibility_role_ids?: number[];
}
export type CategoryResponse = ApiListResponse<Category>;
export interface SaveCategoryInput extends ApiEntity {
  cate_uuid?: string;
  store_uuid_fk: string;
  group_uuid_fk: string;
  cate_name_la: string;
  cate_name_eng: string;
  cate_icon: string;
  visibility_all_roles?: boolean;
  visibility_role_ids?: number[];
}
export interface FetchCategoriesParams extends FetchParams {}
export interface SortCategoryItem { cate_uuid: string; cate_sort: number }
export interface SortCategoryInput { store_uuid_fk: string; items: SortCategoryItem[] }

const crud = createCrud<Category>(
  {
    fetch: "/api/v1/category/fetch_limit",
    fetchAll: "/api/v1/category/fetch_limit",
    create: "/api/v1/category/create",
    delete: "/api/v1/category/delete"
  },
  "cate_uuid"
);

export const getCategories = (params: FetchCategoriesParams = {}) => crud.list({ orderBy: "1", ...params });
export const getCategoryOptions = async (lang = "la", storeUuid?: string) =>
  (await getCategories({ lang, limit: "All", store_uuid_fk: storeUuid })).data;
export const getProductCategoryOptions = async (lang = "la", storeUuid?: string) =>
  (await getCategories({ lang, limit: "All", store_uuid_fk: storeUuid, management_view: "product" })).data;
export const saveCategory = (input: SaveCategoryInput) => crud.save(input);
export const deleteCategory = (cate_uuid: string) => crud.delete(cate_uuid);
export const sortCategories = (data: SortCategoryInput) =>
  apiRequest("post", "/api/v1/category/sort", { data });

export async function getCategoryVisibilityRoles(storeUuid: string, lang = "la") {
  const result = await apiRequest<ApiDataResponse<CategoryVisibilityRole[]>>(
    "get", "/api/v1/category/visibility-roles", {
      params: { store_uuid_fk: storeUuid, lang: toApiLanguage(lang) },
    },
  );
  return result.data ?? [];
}
