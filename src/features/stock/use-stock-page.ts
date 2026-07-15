"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useUrlPagination } from "@/hooks/use-url-pagination";
import type { UrlPaginationState } from "@/lib/url-pagination";
import type { Category } from "@/services/category";
import type { StockStatus } from "@/services/stock";
import { useAppStore } from "@/stores/app-store";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useReferenceStore } from "@/stores/reference-store";
import { useStockStore } from "@/stores/stock-store";
import {
  categoryOptionName,
  categoryUuid,
} from "@/features/product/list/product-list-utils";
import { STOCK_PAGE_LIMIT_OPTIONS } from "./stock-constants";

const ALL_CATEGORIES = "all";
const STOCK_LIMIT_OPTIONS = [...STOCK_PAGE_LIMIT_OPTIONS];
const EMPTY_CATEGORIES: Category[] = [];

export interface StockCategoryOption {
  label: string;
  value: string;
}

export function useStockPage(initialPagination: UrlPaginationState) {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const branchUuid = user?.branch_uuid ?? "";
  const branchName = user?.branch_name ?? "";
  const storeUuid = authStoreUuid(user);
  const language = useAppStore((state) => state.language);
  const rows = useStockStore((state) => state.rows);
  const total = useStockStore((state) => state.total);
  const totalPages = useStockStore((state) => state.totalPages);
  const loading = useStockStore((state) => state.loading);
  const error = useStockStore((state) => state.error);
  const loadStock = useStockStore((state) => state.load);
  const resetStock = useStockStore((state) => state.reset);
  const categories = (useReferenceStore(
    (state) => state.options.categories,
  ) ?? EMPTY_CATEGORIES) as Category[];
  const categoryLoading = Boolean(
    useReferenceStore((state) => state.loadingKeys.categories),
  );
  const loadCategories = useReferenceStore((state) => state.loadCategories);
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const [status, setStatus] = useState<StockStatus>("all");
  const { changeLimit, goToPage, limit, page, resetPage } = useUrlPagination({
    initialPagination,
    limitOptions: STOCK_LIMIT_OPTIONS,
  });
  const pageLimit =
    typeof limit === "number" ? limit : STOCK_PAGE_LIMIT_OPTIONS[0];
  const safeTotalPages = Math.max(1, totalPages);
  const pageStart = rows.length ? (page - 1) * pageLimit + 1 : 0;
  const pageEnd = rows.length ? pageStart + rows.length - 1 : 0;

  const categoryOptions = useMemo<StockCategoryOption[]>(
    () =>
      categories.flatMap((item) => {
        const value = categoryUuid(item);
        return value
          ? [{ value, label: categoryOptionName(item, language) }]
          : [];
      }),
    [categories, language],
  );

  const load = useCallback(async () => {
    if (!branchUuid) return;

    try {
      await loadStock({
        branch_uuid_fk: branchUuid,
        category_fk: category,
        stock_status: status,
        page,
        limit: pageLimit,
        lang: language,
      });
      const loadedTotalPages = Math.max(
        1,
        useStockStore.getState().totalPages,
      );
      if (page > loadedTotalPages) goToPage(loadedTotalPages);
    } catch {
      // The store keeps the request error so the page can offer an inline retry.
    }
  }, [
    branchUuid,
    category,
    language,
    loadStock,
    goToPage,
    page,
    pageLimit,
    status,
  ]);

  useEffect(() => {
    if (!storeUuid) return;
    void loadCategories(language, storeUuid).catch(() => undefined);
  }, [language, loadCategories, storeUuid]);

  useEffect(() => {
    if (!branchUuid) {
      resetStock();
      return;
    }
    void load();
  }, [branchUuid, load, resetStock]);

  function changeCategory(value: string) {
    if (value === category) return;
    setCategory(value || ALL_CATEGORIES);
    resetPage();
  }

  function changeStatus(value: StockStatus) {
    if (value === status) return;
    setStatus(value);
    resetPage();
  }

  function changePageLimit(value: number) {
    if (value === pageLimit || !STOCK_PAGE_LIMIT_OPTIONS.includes(value)) return;
    changeLimit(value);
  }

  return {
    t,
    branchName,
    branchUuid,
    language,
    rows,
    total,
    totalPages: safeTotalPages,
    loading,
    error,
    category,
    categoryLoading,
    categoryOptions,
    status,
    page,
    pageLimit,
    pageStart,
    pageEnd,
    changeCategory,
    changeStatus,
    changePageLimit,
    goToPage,
    refresh: load,
  };
}

export type StockPageWorkflow = ReturnType<typeof useStockPage>;
