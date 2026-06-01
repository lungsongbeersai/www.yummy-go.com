"use client";

import {
  deleteCategory,
  getCategories,
  saveCategory,
  type Category,
  type FetchCategoriesParams,
  type SaveCategoryInput
} from "@/services/category";
import { createCrudListStore } from "@/stores/crud-list-store";

export const useCategoryStore = createCrudListStore<
  Category,
  SaveCategoryInput,
  FetchCategoriesParams
>({
  idKey: "cate_uuid",
  list: getCategories,
  save: saveCategory,
  remove: deleteCategory
});
