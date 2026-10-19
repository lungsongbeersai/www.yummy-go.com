"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useResetOnChange, useResetOnDeps } from "@/hooks/use-reset-on-change";
import { arrayMove } from "@dnd-kit/sortable";
import { useReducedMotion } from "motion/react";
import { useTranslation } from "react-i18next";
import { useAppliedSearch } from "@/hooks/use-applied-search";
import { useUrlPagination } from "@/hooks/use-url-pagination";
import { pageLimitSize } from "@/lib/pagination";
import { normalizeProductImportKey } from "@/lib/product-import";
import { samePageLimit, type UrlPaginationState } from "@/lib/url-pagination";
import type { Category } from "@/services/category";
import type { Group } from "@/services/group";
import type { Size } from "@/services/size";
import type { Unit } from "@/services/unit";
import type { Product, ProductDetail } from "@/services/product";
import { useAppStore } from "@/stores/app-store";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useProductStore } from "@/stores/product-store";
import {
  executeProductImportDrafts,
  productMatchesImportPayload,
  productImportResultTone,
} from "@/stores/product-store/import-execution";
import {
  planProductImportReferences,
  type ProductImportReferencePlan,
} from "@/stores/product-store/import-references";
import { productTransferReferenceNames, buildProductTransferSaveInput } from "@/stores/product-store/product-transfer";
import { useToppingStore } from "@/stores/topping-store";
import { useTasteStore } from "@/stores/taste-store";
import { useSetChildOptionStore } from "@/stores/set-child-option-store";
import { useReferenceStore } from "@/stores/reference-store";
import { useToastStore } from "@/stores/toast-store";
import { generateProdCode } from "@/features/product/form/product-form-utils";
import {
  categoryUuid,
  detailStockSummary,
  productDetails,
  productDetailUuid,
  statusSortLabel,
  statusSortValue
} from "./product-list-utils";
import type {
  ProductBulkEditInput,
  ProductStatusKey,
  ProductStockModeValue,
  ProductTableRow
} from "./product-list-types";
import {
  analyzeProductImportWorkbook,
  planProductImportDraftReferences,
  productImportReferenceConflictApplies,
  productImportSummary,
  resolveProductImportDrafts,
  sheetRowsFromAoA,
  type ProductImportDraft,
} from "./product-import-utils";
import {
  parseProductImportWorkbook,
  ProductImportWorkbookError,
} from "./product-import-workbook";
import { exportProductTransfer } from "./product-transfer";
import {
  parseProductTransferArchive,
  ProductTransferArchiveError,
  type ProductTransferManifest,
} from "./product-transfer-archive";

const DEFAULT_STATUS_SORT = "1";
const EMPTY_CATEGORIES: Category[] = [];
const EMPTY_GROUPS: Group[] = [];

interface ProductImportReferenceContext {
  groups: Group[];
  categories: Category[];
  units: Unit[];
  normalSizes: Size[];
  setSizes: Size[];
}

function productImportDraftWillCreate(
  draft: ProductImportDraft,
  plan: ProductImportReferencePlan | null,
) {
  if (!plan) return false;
  const includesName = (names: string[], value: string) => {
    const target = normalizeProductImportKey(value);
    return names.some(
      (name) => normalizeProductImportKey(name) === target,
    );
  };
  if (includesName(plan.createCategories, draft.categoryName)) return true;
  if (includesName(plan.createUnits, draft.unitName)) return true;
  const sizeNames =
    draft.type === "set" ? plan.createSetSizes : plan.createNormalSizes;
  return draft.details.some((detail) =>
    includesName(sizeNames, detail.referenceName),
  );
}

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
  const orderBy = useProductStore((state) => state.orderBy);
  const storePageLimit = useProductStore((state) => state.pageLimit);
  const loading = useProductStore((state) => state.loading);
  const saving = useProductStore((state) => state.saving);
  const setSearch = useProductStore((state) => state.setSearch);
  const setCateUuidFk = useProductStore((state) => state.setCateUuidFk);
  const setOrderBy = useProductStore((state) => state.setOrderBy);
  const setPageLimit = useProductStore((state) => state.setPageLimit);
  const loadProducts = useProductStore((state) => state.load);
  const loadAllProductsForImport = useProductStore(
    (state) => state.loadAllForImport,
  );
  const loadProductImage = useProductStore((state) => state.loadProductImage);
  const loadStatusSorts = useProductStore((state) => state.loadStatusSorts);
  const loadSizesByStatus = useProductStore((state) => state.loadSizesByStatus);
  const ensureImportReferences = useProductStore((state) => state.ensureImportReferences);
  const saveProduct = useProductStore((state) => state.save);
  const removeProduct = useProductStore((state) => state.remove);
  const updateProductNotification = useProductStore((state) => state.updateProductNotification);
  const updateDetailEnabledState = useProductStore((state) => state.updateDetailEnabled);
  const updateDetailStock = useProductStore((state) => state.updateDetailStock);
  const updateDetailsStock = useProductStore((state) => state.updateDetailsStock);
  const updateStatusFields = useProductStore((state) => state.updateStatusFields);
  const sortProductsByCategory = useProductStore((state) => state.sortProductsByCategory);
  const sortProductDetailsByProduct = useProductStore((state) => state.sortProductDetailsByProduct);
  const categories = (useReferenceStore((state) => state.options.categories) ?? EMPTY_CATEGORIES) as Category[];
  const groups = (useReferenceStore((state) => state.options.groups) ?? EMPTY_GROUPS) as Group[];
  const categoryLoading = Boolean(useReferenceStore((state) => state.loadingKeys.categories));
  const loadCategories = useReferenceStore((state) => state.loadCategories);
  const loadGroups = useReferenceStore((state) => state.loadGroups);
  const loadUnits = useReferenceStore((state) => state.loadUnits);
  const loadSizes = useReferenceStore((state) => state.loadSizes);
  const loadToppings = useReferenceStore((state) => state.loadToppings);
  const loadTastes = useReferenceStore((state) => state.loadTastes);
  const saveTopping = useToppingStore((state) => state.save);
  const saveTaste = useTasteStore((state) => state.save);
  const loadSetChildOptions = useSetChildOptionStore((state) => state.load);
  const saveSetChildOption = useSetChildOptionStore((state) => state.save);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [orderEditTarget, setOrderEditTarget] = useState<ProductTableRow | null>(null);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [highlightCategoryFilter, setHighlightCategoryFilter] = useState(false);
  const [highlightSearchFilter, setHighlightSearchFilter] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importBaseDrafts, setImportBaseDrafts] = useState<
    ProductImportDraft[]
  >([]);
  const [importFileName, setImportFileName] = useState("");
  const [importReferenceContext, setImportReferenceContext] =
    useState<ProductImportReferenceContext | null>(null);
  const [importSucceededKeys, setImportSucceededKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [importDefaultGroupName, setImportDefaultGroupName] = useState("");
  const [importing, setImporting] = useState(false);
  const [importParsing, setImportParsing] = useState(false);
  const [transferBundle, setTransferBundle] = useState<{
    manifest: ProductTransferManifest;
    images: Map<string, Uint8Array>;
  } | null>(null);
  const [transferSucceededKeys, setTransferSucceededKeys] = useState<Set<string>>(() => new Set());
  const [transferCodeConflictCount, setTransferCodeConflictCount] = useState(0);
  const [exportingProducts, setExportingProducts] = useState(false);
  const [importResult, setImportResult] = useState("");
  const [importResultTone, setImportResultTone] = useState<
    "success" | "partial" | "error" | ""
  >("");
  const importExecutionLock = useRef(false);
  const [collapsedProducts, setCollapsedProducts] = useState<Set<string>>(() => new Set());
  const [pendingKeys, setPendingKeys] = useState<Set<ProductStatusKey>>(() => new Set());
  const [pendingBulkStockModes, setPendingBulkStockModes] = useState<Record<string, ProductStockModeValue>>({});
  const [selectedRows, setSelectedRows] = useState<Set<string>>(() => new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkEditing, setBulkEditing] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
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
  const { appliedSearch, applySearch } = useAppliedSearch(search);
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
  const selectedProductRows = useMemo(
    () => filteredRows.filter((row) => selectedRows.has(row.prod_uuid)),
    [filteredRows, selectedRows]
  );
  const selectedDetailUuids = useMemo(() => {
    const detailUuids = new Set<string>();
    selectedProductRows.forEach((row) => {
      productDetails(row).forEach((detail) => {
        const detailUuid = productDetailUuid(detail);
        if (detailUuid) detailUuids.add(detailUuid);
      });
    });
    return [...detailUuids];
  }, [selectedProductRows]);
  const allSelected = visibleProductIds.length > 0 && visibleProductIds.every((id) => selectedRows.has(id));
  const allDetailsExpanded = detailProductIds.length > 0 && detailProductIds.every((id) => !collapsedProducts.has(id));
  const canGoBack = page > 1 && !loading;
  const canGoNext = page < Math.max(1, totalPages) && !loading;
  // ลาก-วางเขียน prod_sort = ลำดับ index ในอาเรย์ที่เห็นอยู่เสมอ (ดู withProductSort) — ถ้าอยู่ใน
  // มุมมอง DESC ตำแหน่งบนสุดที่ลากไปวางจะกลายเป็น prod_sort ต่ำสุด ซึ่งพอสลับกลับมา ASC จะโผล่ล่างสุด
  // สวนทางกับที่ลากไว้ จึงเปิดลาก-วางเฉพาะตอนดู ASC เท่านั้น
  const canSortProducts =
    Boolean(cateUuidFk) &&
    !appliedSearch.trim() &&
    orderBy === "ASC" &&
    (pageLimit === "All" || totalPages <= 1) &&
    filteredRows.length > 1 &&
    !loading &&
    !saving;
  const canSortProductDetails = !loading && !saving;

  const branchUuid = user?.branch_uuid ?? "";
  useResetOnDeps([storeUuid, branchUuid], resetImportState);

  async function exportProducts() {
    if (!branchUuid) {
      showToast({ title: t("product.branchRequired"), tone: "error" });
      return;
    }
    if (exportingProducts) return;
    setExportingProducts(true);
    try {
      const products = await loadAllProductsForImport({
        branch_uuid_fk: branchUuid,
        lang: language,
      });
      const result = await exportProductTransfer(products, (product) => {
        const image = String(product.prod_image ?? "").trim();
        const raw = String(product.prod_image_raw ?? "").trim();
        const filename = image && !image.startsWith("#") ? image : raw && !raw.startsWith("#") ? raw : "";
        return filename ? loadProductImage(filename) : Promise.resolve(null);
      });
      const archiveBuffer = new ArrayBuffer(result.bytes.byteLength);
      new Uint8Array(archiveBuffer).set(result.bytes);
      const archive = new Blob([archiveBuffer], { type: "application/zip" });
      const downloadUrl = URL.createObjectURL(archive);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = `yummy-go-products-${new Date().toISOString().slice(0, 10)}.zip`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      showToast({
        title: t("product.transfer.exported", { count: products.length }),
        description: result.imageOmissions
          ? t("product.transfer.imageOmissions", { count: result.imageOmissions })
          : undefined,
        tone: result.imageOmissions ? "info" : "success",
      });
    } catch (error) {
      showToast({
        title: t("product.transfer.exportFailed"),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error",
      });
    } finally {
      setExportingProducts(false);
    }
  }

  const load = useCallback(async () => {
    if (!branchUuid) return;

    try {
      await loadProducts({
        search: appliedSearch,
        page,
        limit: pageLimit,
        lang: language,
        branch_uuid_fk: branchUuid,
        cate_uuid_fk: cateUuidFk,
        orderBy,
        status_sort_fk: Number(statusSortFk)
      });
    } catch (error) {
      showToast({
        title: t("product.loadFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error"
      });
    }
  }, [appliedSearch, branchUuid, cateUuidFk, language, loadProducts, orderBy, page, pageLimit, showToast, statusSortFk, t]);

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
    Promise.all([
      loadGroups(language, storeUuid),
      loadCategories(language, storeUuid),
      loadUnits(language, storeUuid),
      loadSizes(language, storeUuid)
    ]).catch((error) => {
      showToast({
        title: t("product.loadFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error"
      });
    });
  }, [language, loadCategories, loadGroups, loadSizes, loadUnits, showToast, storeUuid, t]);

  useEffect(() => {
    if (!samePageLimit(storePageLimit, pageLimit)) setPageLimit(pageLimit);
  }, [pageLimit, setPageLimit, storePageLimit]);

  useEffect(() => {
    void load();
  }, [load]);

  // สินค้าที่พับไว้อาจหลุดจากรายการหลังกรอง/โหลดใหม่ ต้องตัดออก
  useResetOnChange(detailProductIds, () => {
    const visible = new Set(detailProductIds);
    setCollapsedProducts((current) => {
      const next = new Set([...current].filter((id) => visible.has(id)));
      return next.size === current.size ? current : next;
    });
  });

  // แถวที่เลือกไว้อาจหลุดจากรายการที่มองเห็น ต้องตัดออกจาก selection
  useResetOnChange(visibleProductIds, () => {
    const visible = new Set(visibleProductIds);
    setSelectedRows((current) => {
      const next = new Set([...current].filter((id) => visible.has(id)));
      return next.size === current.size ? current : next;
    });
  });

  useResetOnChange(cateUuidFk, () => {
    if (cateUuidFk) setHighlightCategoryFilter(false);
  });

  useResetOnChange(appliedSearch, () => {
    if (!appliedSearch.trim()) setHighlightSearchFilter(false);
  });

  function applyFilters() {
    applySearch({ page, resetPage, reload: () => void load() });
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

  function changeOrderBy(value: string) {
    if (value !== "ASC" && value !== "DESC") return;
    if (value === orderBy) return;
    setOrderBy(value);
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
    setBulkEditOpen(false);
    setBulkDeleteOpen(false);
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
    router.push(`/products/form?prod_uuid=${encodeURIComponent(row.prod_uuid)}`);
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

  function notifySortUnavailable() {
    const missingCategory = !cateUuidFk;
    const searchActive = Boolean(appliedSearch.trim());
    setHighlightCategoryFilter(missingCategory);
    setHighlightSearchFilter(searchActive);
    if (missingCategory && !categoryLoading) setCategoryDropdownOpen(true);
    showToast({
      title: t("product.sortUnavailable"),
      description: t("product.sortHint"),
      tone: "info"
    });
  }

  async function persistProductOrder(nextRows: Product[]) {
    try {
      await sortProductsByCategory(cateUuidFk, nextRows);
      showToast({ title: t("category.sorted"), tone: "success" });
    } catch (error) {
      showToast({
        title: t("category.sortFailed"),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    }
  }

  async function reorderProduct(activeId: string, overId: string) {
    if (!canSortProducts || activeId === overId) return;
    const oldIndex = rows.findIndex((item) => item.prod_uuid === activeId);
    const newIndex = rows.findIndex((item) => item.prod_uuid === overId);
    if (oldIndex < 0 || newIndex < 0) return;
    await persistProductOrder(arrayMove(rows, oldIndex, newIndex));
  }

  async function moveProductToPosition(row: ProductTableRow, position: number) {
    if (!canSortProducts) return;
    const currentIndex = rows.findIndex((item) => item.prod_uuid === row.prod_uuid);
    const nextIndex = Math.min(Math.max(position - 1, 0), rows.length - 1);
    setOrderEditTarget(null);
    if (currentIndex < 0 || currentIndex === nextIndex) return;
    await persistProductOrder(arrayMove(rows, currentIndex, nextIndex));
  }

  async function reorderProductDetail(row: ProductTableRow, activeId: string, overId: string) {
    if (!canSortProductDetails || activeId === overId) return;
    const details = productDetails(row);
    const oldIndex = details.findIndex((detail) => productDetailUuid(detail) === activeId);
    const newIndex = details.findIndex((detail) => productDetailUuid(detail) === overId);
    if (oldIndex < 0 || newIndex < 0) return;

    try {
      await sortProductDetailsByProduct(row.prod_uuid, arrayMove(details, oldIndex, newIndex));
      showToast({ title: t("category.sorted"), tone: "success" });
    } catch (error) {
      showToast({
        title: t("category.sortFailed"),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    }
  }

  async function applyBulkEdit(input: ProductBulkEditInput) {
    const notificationValue = input.notification === "keep" ? null : Number(input.notification);
    const enabledValue = input.enabled === "keep" ? null : Number(input.enabled);
    const stockModeValue = input.stockMode === "keep" ? null : Number(input.stockMode);
    const notificationProducts = notificationValue
      ? selectedProductRows.filter((row) => row.prod_uuid)
      : [];
    const hasDetailPatch = selectedDetailUuids.length > 0 && (enabledValue || stockModeValue);

    if (!notificationProducts.length && !hasDetailPatch) {
      showToast({ title: t("storePermissions.noChanges"), tone: "info" });
      return;
    }

    setBulkEditing(true);
    try {
      await Promise.all([
        ...notificationProducts.map((row) => updateProductNotification(row.prod_uuid, notificationValue ?? 2)),
        hasDetailPatch
          ? updateStatusFields({
              enabled: enabledValue
                ? selectedDetailUuids.map((pro_detail_uuid) => ({
                    pro_detail_uuid,
                    pro_detail_enabled: enabledValue
                  }))
                : undefined,
              stockModes: stockModeValue
                ? selectedDetailUuids.map((pro_detail_uuid) => ({
                    pro_detail_uuid,
                    pro_detail_stock: stockModeValue
                  }))
                : undefined
            })
          : Promise.resolve()
      ]);
      showToast({ title: t("product.saved"), tone: "success" });
      setBulkEditOpen(false);
      clearSelection();
    } catch (error) {
      showToast({
        title: t("settings.saveFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error"
      });
    } finally {
      setBulkEditing(false);
    }
  }

  async function removeSelectedProducts() {
    if (!selectedProductRows.length) return;
    const removingAllRows = selectedProductRows.length === rows.length;

    setBulkDeleting(true);
    try {
      await Promise.all(selectedProductRows.map((row) => removeProduct(row.prod_uuid)));
      showToast({
        title: t("product.bulkDeleted", { count: selectedProductRows.length }),
        tone: "success"
      });
      setBulkDeleteOpen(false);
      clearSelection();
      if (removingAllRows && page > 1) goToPage(page - 1);
    } catch (error) {
      showToast({
        title: t("settings.deleteFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error"
      });
    } finally {
      setBulkDeleting(false);
    }
  }

  function resetImportState() {
    setImportBaseDrafts([]);
    setImportFileName("");
    setImportReferenceContext(null);
    setImportSucceededKeys(new Set());
    setImportDefaultGroupName("");
    setImportResult("");
    setImportResultTone("");
    setTransferBundle(null);
    setTransferSucceededKeys(new Set());
    setTransferCodeConflictCount(0);
  }

  const importFieldLabels = useMemo(
    () => ({
      "Product Name (Lao)": t("product.import.fields.productNameLa"),
      "Set Name (Lao)": t("product.import.fields.setNameLa"),
      Category: t("product.import.fields.category"),
      Unit: t("product.import.fields.unit"),
      "Size Name": t("product.import.fields.sizeName"),
      "Set Option / Product Name": t("product.import.fields.setOptionName"),
      "Cost Price": t("product.import.fields.costPrice"),
      "Sale Price": t("product.import.fields.salePrice"),
    }),
    [t]
  );
  const importFieldLabel = useCallback(
    (field: string) => importFieldLabels[field as keyof typeof importFieldLabels] ?? field,
    [importFieldLabels]
  );

  const importMessages = useMemo(
    () => ({
      required: (field: string) => t("product.import.required", { field: importFieldLabel(field) }),
      rowRequired: (row: number, field: string) => t("product.import.rowFieldRequired", { row, field: importFieldLabel(field) }),
      categoryNotFound: (name: string) => t("product.import.categoryNotFound", { name }),
      unitNotFound: (name: string) => t("product.import.unitNotFound", { name }),
      sizeNotFound: (row: number, name: string) => t("product.import.sizeNotFound", { row, name }),
      setOptionNotFound: (row: number, name: string) => t("product.import.setOptionNotFound", { row, name }),
      priceGreaterThanZero: (row: number, field: string) =>
        t("product.import.priceGreaterThanZero", { row, field: importFieldLabel(field) }),
      setPriceGreaterThanZero: () => t("product.import.setPriceGreaterThanZero"),
      multipleSetPrices: () => t("product.import.multipleSetPrices"),
      duplicateCode: (code: string) =>
        t("product.import.duplicateCode", { code }),
      duplicateSize: (row: number, name: string) =>
        t("product.import.duplicateSize", { row, name }),
    }),
    [importFieldLabel, t]
  );

  const importReferencePlan = useMemo(() => {
    if (
      !importReferenceContext ||
      !importDefaultGroupName.trim()
    ) {
      return null;
    }
    return planProductImportDraftReferences(importBaseDrafts, {
      defaultGroupName: importDefaultGroupName,
      groups: importReferenceContext.groups,
      categories: importReferenceContext.categories,
      units: importReferenceContext.units,
      normalSizes: importReferenceContext.normalSizes,
      setSizes: importReferenceContext.setSizes,
    });
  }, [
    importBaseDrafts,
    importDefaultGroupName,
    importReferenceContext,
  ]);

  const importDrafts = useMemo(
    () =>
      importBaseDrafts.map((draft) => {
        const validationErrors = [...draft.validationErrors];
        importReferencePlan?.conflicts
          .filter((conflict) =>
            productImportReferenceConflictApplies(draft, conflict),
          )
          .forEach((conflict) => {
            const message =
              conflict.kind === "group"
                ? t("product.import.defaultGroupAmbiguous", {
                    name: conflict.name,
                  })
                : conflict.reason === "category-group-mismatch"
                  ? t("product.import.categoryGroupMismatch", {
                      name: conflict.name,
                    })
                  : t("product.import.referenceAmbiguous", {
                      name: conflict.name,
                    });
            if (!validationErrors.includes(message)) {
              validationErrors.push(message);
            }
          });
        return {
          ...draft,
          validationErrors,
          payload: validationErrors.length ? null : draft.payload,
        };
      }),
    [importBaseDrafts, importReferencePlan, t],
  );

  async function prepareImportFile(file: File | null) {
    setImportBaseDrafts([]);
    setImportFileName("");
    setImportReferenceContext(null);
    setImportSucceededKeys(new Set());
    setImportResult("");
    setImportResultTone("");
    setTransferBundle(null);
    setTransferSucceededKeys(new Set());
    setTransferCodeConflictCount(0);
    if (!file) return;

    if (!user?.branch_uuid || !storeUuid) {
      showToast({ title: t("settings.saveFailed"), description: t("settings.branchRequired"), tone: "error" });
      return;
    }

    setImportParsing(true);
    setImportFileName(file.name);

    try {
      if (file.name.toLowerCase().endsWith(".zip")) {
        const { manifest, images } = await parseProductTransferArchive(file);
        const targetProducts = await loadAllProductsForImport({
          branch_uuid_fk: user.branch_uuid,
          lang: language,
        });
        setTransferCodeConflictCount(productTransferCodeConflicts(manifest.products, targetProducts).size);
        setTransferBundle({ manifest, images });
        setImportDefaultGroupName("Imported Products");
        setImportResult(t("product.transfer.previewReady", { count: manifest.products.length }));
        setImportResultTone("success");
        return;
      }
      const workbook = await parseProductImportWorkbook(file);
      const normalRows = workbook.Normal
        ? sheetRowsFromAoA(workbook.Normal, [
            "Product Code",
            "Product Name (Lao)",
            "Product Name (English)",
            "Category",
            "Unit",
            "Size Name",
            "Cost Price",
            "Sale Price",
          ])
        : [];
      const setRows = workbook.Set
        ? sheetRowsFromAoA(workbook.Set, [
            "Product Code",
            "Set Name (Lao)",
            "Set Name (English)",
            "Category",
            "Unit",
            "Set Option / Product Name",
            "Cost Price",
            "Set Price",
          ])
        : [];

      const [
        groupRows,
        categoryRows,
        unitRows,
        sizeRows,
        setSizeRows,
        existingProducts,
      ] = await Promise.all([
        loadGroups(language, storeUuid),
        loadCategories(language, storeUuid),
        loadUnits(language, storeUuid),
        loadSizes(language, storeUuid),
        loadSizesByStatus(storeUuid, 2, language),
        loadAllProductsForImport({
          branch_uuid_fk: user.branch_uuid,
          lang: language,
        }),
      ]);
      const analysis = analyzeProductImportWorkbook({
        workbook: { Normal: normalRows, Set: setRows },
        branchUuid: user.branch_uuid,
        existingProducts,
        generatedCodeSeed: generateProdCode(),
        messages: importMessages,
      });

      setImportReferenceContext({
        groups: groupRows,
        categories: categoryRows,
        units: unitRows,
        normalSizes: sizeRows,
        setSizes: setSizeRows as Size[],
      });
      setImportBaseDrafts(analysis.drafts);
      if (!analysis.drafts.length) {
        setImportResult(t("product.import.noRows"));
        setImportResultTone("error");
      }
    } catch (error) {
      setImportReferenceContext(null);
      setImportBaseDrafts([]);
      setImportResult(
        error instanceof ProductTransferArchiveError
          ? error.message
          : error instanceof ProductImportWorkbookError
          ? t(`product.import.errors.${error.code}`, {
              defaultValue: error.message,
            })
          : error instanceof Error
            ? error.message
            : t("toasts.pleaseTryAgain"),
      );
      setImportResultTone("error");
    } finally {
      setImportParsing(false);
    }
  }

  async function importProductsFromDrafts() {
    if (transferBundle) {
      await importProductTransferBundle();
      return;
    }
    if (importExecutionLock.current) return;
    if (!importDefaultGroupName.trim()) {
      showToast({
        title: t("settings.saveFailed"),
        description: t("product.import.defaultGroupRequired", {
          defaultValue: "Default Group is required",
        }),
        tone: "error",
      });
      return;
    }
    if (!user?.branch_uuid || !storeUuid) {
      showToast({
        title: t("settings.saveFailed"),
        description: t("settings.branchRequired"),
        tone: "error",
      });
      return;
    }
    if (!importReferencePlan) {
      showToast({
        title: t("settings.saveFailed"),
        description: t("product.import.noValidRows"),
        tone: "error",
      });
      return;
    }
    const executableDrafts = importDrafts.filter(
      (draft) =>
        draft.executionStatus !== "succeeded" &&
        !draft.validationErrors.length &&
        Boolean(draft.payload),
    );
    if (!executableDrafts.length) {
      showToast({ title: t("settings.saveFailed"), description: t("product.import.noValidRows"), tone: "error" });
      return;
    }

    importExecutionLock.current = true;
    setImporting(true);

    try {
      const references = await ensureImportReferences({
        storeUuid,
        language,
        plan: importReferencePlan,
      });
      const resolvedDrafts = resolveProductImportDrafts(
        importDrafts,
        {
          branchUuid: user.branch_uuid,
          categories: references.categories,
          units: references.units,
          sizes: references.sizes,
          setSizes: references.setSizes,
        },
        importMessages,
        { requireReferences: true },
      );
      const executableKeys = new Set(
        executableDrafts.map((draft) => draft.key),
      );
      const result = await executeProductImportDrafts(
        resolvedDrafts,
        importSucceededKeys,
        saveProduct,
        async (candidates) => {
          const persistedProducts = await loadAllProductsForImport({
            branch_uuid_fk: user.branch_uuid,
            lang: language,
          });
          return new Set(
            candidates
              .filter(({ payload }) =>
                persistedProducts.some((product) =>
                  productMatchesImportPayload(product, payload),
                ),
              )
              .map(({ key }) => key),
          );
        },
      );
      const nextSucceededKeys = new Set(result.succeededKeys);
      const newlySucceeded = result.succeededKeys.filter(
        (key) => !importSucceededKeys.has(key),
      ).length;
      const unresolved = resolvedDrafts.filter(
        (draft) =>
          executableKeys.has(draft.key) && draft.validationErrors.length,
      ).length;
      const failed = Object.keys(result.failures).length + unresolved;

      setImportSucceededKeys(nextSucceededKeys);
      setImportBaseDrafts((current) => {
        const resolvedByKey = new Map(
          resolvedDrafts.map((draft) => [draft.key, draft]),
        );
        return current.map((draft) => {
          const resolved = resolvedByKey.get(draft.key);
          if (!resolved) return draft;
          const executionError = result.failures[draft.key] ?? "";
          const shouldKeepResolvedValidation =
            executableKeys.has(draft.key) &&
            resolved.validationErrors.length > 0;
          const validationErrors = shouldKeepResolvedValidation
            ? resolved.validationErrors
            : draft.validationErrors;
          return {
            ...draft,
            payload: resolved.payload,
            validationErrors,
            executionStatus: nextSucceededKeys.has(draft.key)
              ? "succeeded"
              : executionError
                ? "failed"
                : draft.executionStatus,
            executionError,
          };
        });
      });

      const resultMessage = t("product.import.result", {
        success: newlySucceeded,
        failed,
      });
      setImportResult(resultMessage);
      const resultTone = productImportResultTone(newlySucceeded, failed);
      setImportResultTone(resultTone);
      showToast({
        title:
          resultTone === "success"
            ? t("product.saved")
            : resultTone === "partial"
              ? t("product.import.partialTitle")
              : t("settings.saveFailed"),
        description: resultMessage,
        tone:
          resultTone === "success"
            ? "success"
            : resultTone === "partial"
              ? "info"
              : "error",
      });

      try {
        const [
          refreshedGroups,
          refreshedCategories,
          refreshedUnits,
          refreshedSizes,
          refreshedSetSizes,
        ] = await Promise.all([
          loadGroups(language, storeUuid),
          loadCategories(language, storeUuid),
          loadUnits(language, storeUuid),
          loadSizes(language, storeUuid),
          loadSizesByStatus(storeUuid, 2, language),
          load(),
        ]);
        setImportReferenceContext({
          groups: refreshedGroups,
          categories: refreshedCategories,
          units: refreshedUnits,
          normalSizes: refreshedSizes,
          setSizes: refreshedSetSizes as Size[],
        });
      } catch (error) {
        showToast({
          title: t("product.import.refreshFailed"),
          description:
            error instanceof Error
              ? error.message
              : t("toasts.pleaseTryAgain"),
          tone: "info",
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("toasts.pleaseTryAgain");
      setImportResult(message);
      setImportResultTone("error");
      showToast({
        title: t("settings.saveFailed"),
        description: message,
        tone: "error",
      });
    } finally {
      setImporting(false);
      importExecutionLock.current = false;
    }
  }

  async function importProductTransferBundle() {
    if (!transferBundle || importExecutionLock.current) return;
    if (!branchUuid || !storeUuid) {
      showToast({ title: t("product.branchRequired"), tone: "error" });
      return;
    }
    importExecutionLock.current = true;
    setImporting(true);
    try {
      const [targetGroups, targetCategories, targetUnits, targetNormalSizes, targetSetSizes, existingProducts] = await Promise.all([
        loadGroups(language, storeUuid),
        loadCategories(language, storeUuid),
        loadUnits(language, storeUuid),
        loadSizesByStatus(storeUuid, 1, language),
        loadSizesByStatus(storeUuid, 2, language),
        loadAllProductsForImport({ branch_uuid_fk: branchUuid, lang: language }),
      ]);
      const codeConflicts = productTransferCodeConflicts(transferBundle.manifest.products, existingProducts);
      const eligibleRecords = transferBundle.manifest.products.filter((_, index) => !codeConflicts.has(index));
      const names = productTransferReferenceNames(eligibleRecords);
      const plan = planProductImportReferences({
        defaultGroupName: importDefaultGroupName.trim() || "Imported Products",
        groups: targetGroups,
        categories: targetCategories,
        units: targetUnits,
        normalSizes: targetNormalSizes as Size[],
        setSizes: targetSetSizes as Size[],
        categoryNames: names.categoryNames,
        unitNames: names.unitNames,
        normalSizeNames: names.normalSizeNames,
        setSizeNames: names.setSizeNames,
      });
      if (plan.conflicts.length) {
        throw new Error(t("product.transfer.referenceConflict", {
          names: plan.conflicts.map((conflict) => conflict.name).join(", "),
        }));
      }

      const resolved = await ensureImportReferences({ storeUuid, language, plan });
      const [targetToppings, targetTastes, targetChildOptions] = await Promise.all([
        loadToppings(language, storeUuid),
        loadTastes(language, storeUuid),
        loadSetChildOptions({ lang: language, store_uuid_fk: storeUuid, limit: "All" }),
      ]);
      const toppings = await ensureNamedMasterReferences({
        names: names.toppingNames,
        rows: targetToppings,
        idKey: "topping_uuid",
        nameKeys: ["topping_name_la", "topping_name", "topping_name_eng"],
        create: (name) => saveTopping({ store_uuid_fk: storeUuid, topping_name_la: name, topping_name_eng: name }),
        reload: () => loadToppings(language, storeUuid),
      });
      const tastes = await ensureNamedMasterReferences({
        names: names.tasteNames,
        rows: targetTastes,
        idKey: "taste_uuid",
        nameKeys: ["taste_name_la", "taste_name", "taste_name_eng"],
        create: (name) => saveTaste({ store_uuid_fk: storeUuid, taste_name_la: name, taste_name_eng: name }),
        reload: () => loadTastes(language, storeUuid),
      });
      const childOptions = await ensureNamedMasterReferences({
        names: names.setChildOptionNames,
        rows: targetChildOptions,
        idKey: "set_child_option_uuid",
        nameKeys: ["set_child_option_name_la", "set_child_option_name", "set_child_option_name_eng"],
        create: (name) => saveSetChildOption({ store_uuid_fk: storeUuid, set_child_option_name_la: name, set_child_option_name_eng: name }),
        reload: async () => loadSetChildOptions({ lang: language, store_uuid_fk: storeUuid, limit: "All" }),
      });

      const refs = {
        branchUuid,
        categories: resolved.categories as unknown as Array<Record<string, unknown>>,
        units: resolved.units as unknown as Array<Record<string, unknown>>,
        normalSizes: resolved.sizes as unknown as Array<Record<string, unknown>>,
        setSizes: resolved.setSizes as unknown as Array<Record<string, unknown>>,
        toppings: toppings as unknown as Array<Record<string, unknown>>,
        tastes: tastes as unknown as Array<Record<string, unknown>>,
        setChildOptions: childOptions as unknown as Array<Record<string, unknown>>,
      };
      let succeeded = 0;
      const conflicted = codeConflicts.size;
      let failed = 0;
      const nextSucceededKeys = new Set(transferSucceededKeys);
      for (const [index, record] of transferBundle.manifest.products.entries()) {
        const key = `${index}:${String(record.product.prod_code ?? "")}`;
        if (nextSucceededKeys.has(key)) continue;
        if (codeConflicts.has(index)) continue;
        try {
          let image: File | undefined;
          if (record.imagePath) {
            const bytes = transferBundle.images.get(record.imagePath);
            if (!bytes) throw new Error(`Photo data is missing for ${String(record.product.prod_name_la ?? "product")}`);
            const imageBuffer = new ArrayBuffer(bytes.byteLength);
            new Uint8Array(imageBuffer).set(bytes);
            const extension = record.imagePath.split(".").pop()?.toLowerCase() ?? "bin";
            const mime = record.imageMime ?? (extension === "jpg" || extension === "jpeg" ? "image/jpeg" : `image/${extension}`);
            image = new File([imageBuffer], record.imagePath.split("/").pop() ?? "product-image", { type: mime });
          }
          await saveProduct(buildProductTransferSaveInput(record, refs, image));
          nextSucceededKeys.add(key);
          succeeded += 1;
        } catch {
          failed += 1;
        }
      }
      setTransferSucceededKeys(nextSucceededKeys);
      setImportResult(t("product.transfer.importResult", { success: succeeded, conflicts: conflicted, failed }));
      setImportResultTone(failed || conflicted ? "partial" : "success");
      showToast({
        title: t("product.transfer.importFinished"),
        description: t("product.transfer.importResult", { success: succeeded, conflicts: conflicted, failed }),
        tone: failed || conflicted ? "info" : "success",
      });
      try {
        await load();
      } catch {
        showToast({ title: t("product.transfer.refreshFailed"), tone: "info" });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t("toasts.pleaseTryAgain");
      setImportResult(message);
      setImportResultTone("error");
      showToast({ title: t("settings.saveFailed"), description: message, tone: "error" });
    } finally {
      setImporting(false);
      importExecutionLock.current = false;
    }
  }

  const importSummary = productImportSummary(importDrafts);
  const importWillCreate = useCallback(
    (draft: ProductImportDraft) =>
      productImportDraftWillCreate(draft, importReferencePlan),
    [importReferencePlan],
  );

  return {
    t,
    language,
    rows,
    total,
    totalPages,
    search,
    setSearch,
    cateUuidFk,
    orderBy,
    categoryLoading,
    categoryOptions,
    pageLimit,
    statusSortFk,
    statusTabs,
    activeStatusLabel,
    loading,
    saving,
    canSortProducts,
    canSortProductDetails,
    importDialogOpen,
    setImportDialogOpen,
    importDrafts,
    importFileName,
    importGroupOptions: groups,
    importDefaultGroupName,
    setImportDefaultGroupName,
    importSummary,
    importParsing,
    transferCount: transferBundle?.manifest.products.length ?? 0,
    transferImageOmissions: transferBundle?.manifest.products.filter((record) => record.imageUnavailable).length ?? 0,
    transferCodeConflictCount,
    exportingProducts,
    exportProducts,
    importing,
    importResult,
    importResultTone,
    importWillCreate,
    filteredRows,
    selectedRows,
    selectedProductRows,
    selectedDetailCount: selectedDetailUuids.length,
    bulkEditOpen,
    setBulkEditOpen,
    bulkEditing,
    bulkDeleteOpen,
    setBulkDeleteOpen,
    bulkDeleting,
    removeSelectedProducts,
    deleteTarget,
    setDeleteTarget,
    orderEditTarget,
    setOrderEditTarget,
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
    changeOrderBy,
    changePageLimit,
    toggleProductDetails,
    toggleAllDetails,
    toggleSelected,
    toggleAllSelected,
    clearSelection,
    applyBulkEdit,
    remove,
    editProduct,
    updateNotification,
    updateDetailEnabled,
    updateDetailStockMode,
    updateAllDetailStockModes,
    categoryDropdownOpen,
    setCategoryDropdownOpen,
    highlightCategoryFilter,
    highlightSearchFilter,
    notifySortUnavailable,
    reorderProduct,
    moveProductToPosition,
    reorderProductDetail,
    prepareImportFile,
    importProductsFromDrafts,
    resetImportState,
    goToPage
  };
}

export type ProductListWorkflow = ReturnType<typeof useProductListWorkflow>;

async function ensureNamedMasterReferences<T extends Record<string, unknown>>({
  names,
  rows,
  idKey,
  nameKeys,
  create,
  reload,
}: {
  names: string[];
  rows: T[];
  idKey: string;
  nameKeys: string[];
  create: (name: string) => Promise<T | null | undefined>;
  reload: () => Promise<T[]>;
}) {
  let currentRows = rows.filter((row): row is T => Boolean(row));
  const normalizedNames = [...new Set(names.map(normalizeProductImportKey).filter(Boolean))];
  const matchingRows = (name: string) => currentRows.filter((row) =>
    nameKeys.some((key) => normalizeProductImportKey(row[key]) === normalizeProductImportKey(name)),
  );
  const id = (row: T | null | undefined) => String(row?.[idKey] ?? "").trim();

  for (const name of normalizedNames) {
    const matches = matchingRows(name);
    if (new Set(matches.map(id).filter(Boolean)).size > 1) {
      throw new Error(`Reference name is ambiguous: ${name}`);
    }
  }
  for (const name of names) {
    if (matchingRows(name).some((row) => id(row))) continue;
    const created = await create(name);
    if (created && id(created)) {
      currentRows.push(created);
    } else {
      currentRows = await reload();
      if (!matchingRows(name).some((row) => id(row))) {
        throw new Error(`Could not resolve newly created reference: ${name}`);
      }
    }
  }
  return currentRows;
}

function productTransferCodeConflicts(records: ProductTransferManifest["products"], existingProducts: Product[]) {
  const reserved = new Set(existingProducts.map((product) => normalizeProductImportKey(product.prod_code)).filter(Boolean));
  const conflicts = new Set<number>();
  records.forEach((record, index) => {
    const code = normalizeProductImportKey(record.product.prod_code);
    if (!code) return;
    if (reserved.has(code)) conflicts.add(index);
    else reserved.add(code);
  });
  return conflicts;
}
