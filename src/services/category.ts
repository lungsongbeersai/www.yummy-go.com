import { apiRequest } from "@/lib/api";
import { createCrud } from "@/services/shared/crud";
import type { ApiEntity, ApiListResponse, FetchParams } from "@/services/shared/types";

export interface Category extends ApiEntity {
  cate_uuid: string;
  cate_name?: string;
  cate_name_la?: string;
  cate_name_eng?: string;
  cate_icon?: string;
  cate_sort?: string | number;
  group_uuid_fk?: string;
  group_name?: string;
  group_name_la?: string;
  group_name_eng?: string;
}
export type CategoryResponse = ApiListResponse<Category>;
export interface SaveCategoryInput extends ApiEntity {}
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
export const saveCategory = (input: SaveCategoryInput) => crud.save(input);
export const deleteCategory = (cate_uuid: string) => crud.delete(cate_uuid);
export const sortCategories = (data: SortCategoryInput) =>
  apiRequest("post", "/api/v1/category/sort", { data });
