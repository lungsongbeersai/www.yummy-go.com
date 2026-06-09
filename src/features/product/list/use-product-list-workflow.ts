"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useReducedMotion } from "motion/react";
import { useTranslation } from "react-i18next";
import { useUrlPagination } from "@/hooks/use-url-pagination";
import { pageLimitSize } from "@/lib/pagination";
import { samePageLimit, type UrlPaginationState } from "@/lib/url-pagination";
import type { Category } from "@/services/category";
import type { Product, ProductDetail } from "@/services/product";
import { useAppStore } from "@/stores/app-store";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useProductStore } from "@/stores/product-store";
import { useReferenceStore } from "@/stores/reference-store";
import { useToastStore } from "@/stores/toast-store";
import {
  categoryUuid,
  detailStockSummary,
  productDetails,
  productDetailUuid,
  statusSortLabel,
  statusSortValue
} from "./product-list-utils";
import type { ProductStatusKey, ProductStockModeValue, ProductTableRow } from "./product-list-types";

const DEFAULT_STATUS_SORT = "1";
const EMPTY_CATEGORIES: Category[] = [];

export const ALL_CATEGORIES_VALUE = "__all_categories__";

export function useProductListWorkflow(initialPagination: UrlPaginationState) {
  const { t } = useTranslation();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const user = useAuthStore((state) => state.user);
  const storeUuid = authStoreUuid(user);
  const language = useAppStore((state) => state.language);
  const showToast = useToastStore((state) => state.show);
  const rows = useProductStore((state) => state.rows);
  const total = useProductStore((state) => state.total);
  const totalPages = useProductStore((state) => state.totalPages);
  const statusSorts = useProductStore((state) => state.statusSorts);
  const search = useProductStore((state) => state.search);
  const cateUuidFk = useProductStore((state) => state.cateUuidFk);
  const storePageLimit = useProductStore((state) => state.pageLimit);
  const loading = useProductStore((state) => state.loading);
  const setSearch = useProductStore((state) => state.setSearch);
  const setCateUuidFk = useProductStore((state) => state.setCateUuidFk);
  const setPageLimit = useProductStore((state) => state.setPageLimit);
  const loadProducts = useProductStore((state) => state.load);
  const loadStatusSorts = useProductStore((state) => state.loadStatusSorts);
  const removeProduct = useProductStore((state) => state.remove);
  const updateProductNotification = useProductStore((state) => state.updateProductNotification);
  const updateDetailEnabledState = useProductStore((state) => state.updateDetailEnabled);
  const updateDetailStock = useProductStore((state) => state.updateDetailStock);
  const updateDetailsStock = useProductStore((state) => state.updateDetailsStock);
  const categories = (useReferenceStore((state) => state.options.categories) ?? EMPTY_CATEGORIES) as Category[];
  const categoryLoading = Boolean(useReferenceStore((state) => state.loadingKeys.categories));
  const loadCategories = useReferenceStore((state) => state.loadCategories);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [collapsedProducts, setCollapsedProducts] = useState<Set<string>>(() => new Set());
  const [pendingKeys, setPendingKeys] = useState<Set<ProductStatusKey>>(() => new Set());
  const [pendingBulkStockModes, setPendingBulkStockModes] = useState<Record<string, ProductStockModeValue>>({});
  const [selectedRows, setSelectedRows] = useState<Set<string>>(() => new Set());
  const [statusSortFk, setStatusSortFk] = useState(DEFAULT_STATUS_SORT);
  const {
    changeLimit,
    goToPage,
    limit: pageLimit,
    page,
    resetPage
  } = useUrlPagination({ initialPagination });

  const detailMotion = useMemo(
    () => ({
      initial: reduceMotion ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: -4, scale: 0.985 },
      animate: { opacity: 1, y: 0, scale: 1 },
      exit: reduceMotion ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: -4, scale: 0.985 },
      transition: { duration: reduceMotion ? 0 : 0.14, ease: "easeOut" as const }
    }),
    [reduceMotion]
  );

  const statusTabs = useMemo(() => {
    const fallbackTabs = [
      { value: "1", label: t("product.statusSort.general") },
      { value: "2", label: t("product.statusSort.foodSet") },
      { value: "3", label: t("product.statusSort.promotion") }
    ];
    const apiTabs = statusSorts
      .map((status, index) => {
        const value = statusSortValue(status, index + 1);
        if (!value) return null;
        return { value, label: statusSortLabel(status, language, fallbackTabs, value) };
      })
      .filter((tab): tab is { value: string; label: string } => Boolean(tab));

    return apiTabs.length ? apiTabs : fallbackTabs;
  }, [language, statusSorts, t]);

  const categoryOptions = useMemo(() => categories.filter((category) => categoryUuid(category)), [categories]);
  const activeStatusLabel = statusTabs.find((tab) => tab.value === statusSortFk)?.label ?? statusSortFk;
  const activePageLimit = pageLimitSize(pageLimit, rows.length);
  const pageStart = rows.length ? (page - 1) * activePageLimit + 1 : 0;
  const pageEnd = rows.length ? pageStart + rows.length - 1 : 0;
  const filteredRows = useMemo<ProductTableRow[]>(
    () => rows.map((row, index) => ({ ...row, row_number: pageStart + index })),
    [pageStart, rows]
  );
  const detailProductIds = useMemo(
    () => filteredRows.filter((row) => productDetails(row).length > 0).map((row) => row.prod_uuid),
    [filteredRows]
  );
  const visibleProductIds = useMemo(
    () => filteredRows.map((row) => row.prod_uuid).filter(Boolean),
    [filteredRows]
  );
  const allSelected = visibleProductIds.length > 0 && visibleProductIds.every((id) => selectedRows.has(id));
  const allDetailsExpanded = detailProductIds.length > 0 && detailProductIds.every((id) => !collapsedProducts.has(id));
  const canGoBack = page > 1 && !loading;
  const canGoNext = page < Math.max(1, totalPages) && !loading;

  const load = useCallback(async () => {
    if (!user?.branch_uuid) return;

    try {
      await loadProducts({
        search,
        page,
        limit: pageLimit,
        lang: language,
        branch_uuid_fk: user.branch_uuid,
        cate_uuid_fk: cateUuidFk,
        status_sort_fk: Number(statusSortFk)
      });
    } catch (error) {
      showToast({
        title: t("product.loadFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error"
      });
    }
  }, [cateUuidFk, language, loadProducts, page, pageLimit, search, showToast, statusSortFk, t, user?.branch_uuid]);

  useEffect(() => {
    loadStatusSorts(language).catch((error) => {
      showToast({
        title: t("product.loadFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error"
      });
    });
  }, [language, loadStatusSorts, showToast, t]);

  useEffect(() => {
    if (!storeUuid) return;
    loadCategories(language, storeUuid).catch((error) => {
      showToast({
        title: t("product.loadFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error"
      });
    });
  }, [language, loadCategories, showToast, storeUuid, t]);

  useEffect(() => {
    if (!samePageLimit(storePageLimit, pageLimit)) setPageLimit(pageLimit);
  }, [pageLimit, setPageLimit, storePageLimit]);

  useEffect(() => {
    void load();
    // Search is applied by Enter/Search so typing does not refetch every character.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cateUuidFk, language, page, pageLimit, statusSortFk, user?.branch_uuid]);

  useEffect(() => {
    const visible = new Set(detailProductIds);
    setCollapsedProducts((current) => {
      const next = new Set([...current].filter((id) => visible.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [detailProductIds]);

  useEffect(() => {
    const visible = new Set(visibleProductIds);
    setSelectedRows((current) => {
      const next = new Set([...current].filter((id) => visible.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [visibleProductIds]);

  function applyFilters() {
    if (page === 1) void load();
    else resetPage();
  }

  function changeStatusSort(value: string) {
    if (value === statusSortFk) return;
    setStatusSortFk(value);
    resetPage();
  }

  function changeCategory(value: string) {
    const nextCategory = value === ALL_CATEGORIES_VALUE ? "" : value;
    if (nextCategory === cateUuidFk) return;
    setCateUuidFk(nextCategory);
    resetPage();
  }

  function changePageLimit(value: string) {
    const nextLimit = value === "All" ? "All" : Number(value);
    if ((nextLimit !== "All" && !Number.isFinite(nextLimit)) || nextLimit === pageLimit) return;
    setPageLimit(nextLimit);
    changeLimit(nextLimit);
  }

  function toggleProductDetails(prodUuid: string) {
    setCollapsedProducts((current) => {
      const next = new Set(current);
      if (next.has(prodUuid)) next.delete(prodUuid);
      else next.add(prodUuid);
      return next;
    });
  }

  function toggleAllDetails() {
    setCollapsedProducts((current) => {
      const next = new Set(current);
      if (allDetailsExpanded) detailProductIds.forEach((id) => next.add(id));
      else detailProductIds.forEach((id) => next.delete(id));
      return next;
    });
  }

  function toggleSelected(id: string, checked: boolean) {
    if (!id) return;
    setSelectedRows((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAllSelected(checked: boolean) {
    setSelectedRows((current) => {
      const next = new Set(current);
      visibleProductIds.forEach((id) => {
        if (checked) next.add(id);
        else next.delete(id);
      });
      return next;
    });
  }

  function clearSelection() {
    setSelectedRows(new Set());
  }

  async function remove(row: Product) {
    try {
      await removeProduct(row.prod_uuid);
      showToast({ title: t("product.deleted"), tone: "success" });
      setDeleteTarget(null);
      setSelectedRows((current) => {
        const next = new Set(current);
        next.delete(row.prod_uuid);
        return next;
      });
      if (rows.length === 1 && page > 1) goToPage(page - 1);
    } catch (error) {
      showToast({
        title: t("settings.deleteFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error"
      });
    }
  }

  async function runStatusUpdate(key: ProductStatusKey, action: () => Promise<void>) {
    setPendingKeys((current) => {
      const next = new Set(current);
      next.add(key);
      return next;
    });
    try {
      await action();
      showToast({ title: t("product.saved"), tone: "success" });
    } catch (error) {
      showToast({
        title: t("settings.saveFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error"
      });
    } finally {
      setPendingKeys((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  }

  function editProduct(row: ProductTableRow) {
    router.push(`/product/form?prod_uuid=${encodeURIComponent(row.prod_uuid)}`);
  }

  function updateNotification(row: Product, checked: boolean) {
    const prodUuid = String(row.prod_uuid ?? "");
    if (!prodUuid) return;
    void runStatusUpdate(`notification:${prodUuid}`, () => updateProductNotification(prodUuid, checked ? 1 : 2));
  }

  function updateDetailEnabled(detail: ProductDetail, checked: boolean) {
    const detailUuid = productDetailUuid(detail);
    if (!detailUuid) return;
    void runStatusUpdate(`enabled:${detailUuid}`, () => updateDetailEnabledState(detailUuid, checked ? 1 : 2));
  }

  function updateDetailStockMode(detail: ProductDetail, value: string) {
    const detailUuid = productDetailUuid(detail);
    if (!detailUuid) return;
    void runStatusUpdate(`stock:${detailUuid}`, () => updateDetailStock(detailUuid, Number(value)));
  }

  function updateAllDetailStockModes(row: ProductTableRow, nextStockMode: ProductStockModeValue) {
    const details = productDetails(row);
    if (!details.length) return;

    const summary = detailStockSummary(details);
    const currentMode = summary === "deduct" ? 1 : summary === "noDeduct" ? 2 : null;
    if (currentMode === nextStockMode) return;

    setPendingBulkStockModes((current) => ({ ...current, [row.prod_uuid]: nextStockMode }));
    void runStatusUpdate(
      `stock-all:${row.prod_uuid}`,
      () =>
        updateDetailsStock(
          details.map((detail) => ({
            pro_detail_uuid: productDetailUuid(detail),
            pro_detail_stock: nextStockMode
          }))
        )
    ).finally(() => {
      setPendingBulkStockModes((current) => {
        const next = { ...current };
        delete next[row.prod_uuid];
        return next;
      });
    });
  }

  return {
    t,
    language,
    rows,
    total,
    totalPages,
    search,
    setSearch,
    cateUuidFk,
    categoryLoading,
    categoryOptions,
    pageLimit,
    statusSortFk,
    statusTabs,
    activeStatusLabel,
    loading,
    filteredRows,
    selectedRows,
    deleteTarget,
    setDeleteTarget,
    collapsedProducts,
    pendingKeys,
    pendingBulkStockModes,
    pageStart,
    pageEnd,
    page,
    canGoBack,
    canGoNext,
    allSelected,
    allDetailsExpanded,
    detailProductIds,
    detailMotion,
    applyFilters,
    changeStatusSort,
    changeCategory,
    changePageLimit,
    toggleProductDetails,
    toggleAllDetails,
    toggleSelected,
    toggleAllSelected,
    clearSelection,
    remove,
    editProduct,
    updateNotification,
    updateDetailEnabled,
    updateDetailStockMode,
    updateAllDetailStockModes,
    goToPage
  };
}

export type ProductListWorkflow = ReturnType<typeof useProductListWorkflow>;
