"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useTranslation } from "react-i18next";
import {
  Bell,
  Boxes,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2
} from "lucide-react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingState } from "@/components/common/loading-state";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useUrlPagination } from "@/hooks/use-url-pagination";
import { money } from "@/lib/format";
import { PAGE_LIMIT_OPTIONS, pageLimitSize } from "@/lib/pagination";
import { samePageLimit, type UrlPaginationState } from "@/lib/url-pagination";
import { cn } from "@/lib/utils";
import type { Category } from "@/services/category";
import { getProductImageUrl, type Product, type ProductDetail, type StatusSort } from "@/services/product";
import { useAppStore } from "@/stores/app-store";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useProductStore } from "@/stores/product-store";
import { useReferenceStore } from "@/stores/reference-store";
import { useToastStore } from "@/stores/toast-store";

type ProductTableRow = Product & { row_number: number };
type ProductStatusKey = `notification:${string}` | `enabled:${string}` | `stock:${string}` | `stock-all:${string}`;
type ProductStockSummary = "deduct" | "noDeduct" | "mixed";
type ProductStockModeValue = 1 | 2;

const DEFAULT_STATUS_SORT = "1";
const ALL_CATEGORIES_VALUE = "__all_categories__";
const EMPTY_CATEGORIES: Category[] = [];
const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const MotionTableRow = motion.create(TableRow);

function binaryFlag(value: unknown, fallback: "1" | "2" = "2") {
  return String(value ?? fallback) === "1" ? "1" : "2";
}

function firstText(row: Record<string, unknown> | null | undefined, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== null && value !== undefined && value !== "") return String(value);
  }
  return fallback;
}

function productName(row: Product, language: string) {
  return language.startsWith("en")
    ? firstText(row, ["prod_name_eng", "prod_name", "prod_name_la"], "-")
    : firstText(row, ["prod_name_la", "prod_name", "prod_name_eng"], "-");
}

function categoryName(row: Product, language: string) {
  return language.startsWith("en")
    ? firstText(row, ["cate_name_eng", "cate_name", "cate_name_la"], "-")
    : firstText(row, ["cate_name_la", "cate_name", "cate_name_eng"], "-");
}

function categoryUuid(row: Category) {
  return firstText(row, ["cate_uuid", "cate_uuid_fk", "category_uuid", "category_uuid_fk"]);
}

function categoryOptionName(row: Category, language: string) {
  return language.startsWith("en")
    ? firstText(row, ["cate_name_eng", "cate_name", "cate_name_la"], "-")
    : firstText(row, ["cate_name_la", "cate_name", "cate_name_eng"], "-");
}

function unitName(row: Product, language: string) {
  return language.startsWith("en")
    ? firstText(row, ["unite_name_eng", "unite_name", "unite_name_la"], "-")
    : firstText(row, ["unite_name_la", "unite_name", "unite_name_eng"], "-");
}

function productDetailUuid(detail: ProductDetail) {
  const explicit = firstText(detail, ["pro_detail_uuid", "prod_detail_uuid", "product_detail_uuid", "detail_uuid"]);
  if (explicit) return explicit;

  const detailId = String(detail.pro_detail_id ?? "").trim();
  return UUID_PATTERN.test(detailId) ? detailId : "";
}

function productDetails(row: Product) {
  return Array.isArray(row.details) ? row.details.filter((detail) => productDetailUuid(detail)) : [];
}

function detailLabel(detail: ProductDetail, index: number, language: string) {
  const name = language.startsWith("en")
    ? detail.size_name_eng || detail.size_name || detail.size_name_la
    : detail.size_name_la || detail.size_name || detail.size_name_eng;
  return String(name || `#${index + 1}`);
}

function isHexColor(value: string) {
  return HEX_COLOR.test(value.trim());
}

function productColor(row: Product) {
  const image = String(row.prod_image ?? "").trim();
  const raw = String(row.prod_image_raw ?? "").trim();
  const value = image.startsWith("#") ? image : raw.startsWith("#") ? raw : "";
  return isHexColor(value) ? value : "";
}

function productImageSrc(row: Product) {
  const image = String(row.prod_image ?? "").trim();
  const raw = String(row.prod_image_raw ?? "").trim();
  const source = image && !image.startsWith("#") ? image : raw && !raw.startsWith("#") ? raw : "";
  return source ? getProductImageUrl(source) : "";
}

function ProductMedia({ className, row }: { className?: string; row: Product }) {
  const image = productImageSrc(row);
  const color = productColor(row);
  const style = color ? ({ backgroundColor: color } as CSSProperties) : undefined;

  return (
    <span
      className={cn(
        "relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-muted",
        className
      )}
      style={style}
    >
      {image ? (
        <Image
          src={image}
          alt={String(row.prod_name ?? row.prod_name_la ?? row.prod_name_eng ?? "Product")}
          fill
          sizes="64px"
          className="object-cover"
        />
      ) : color ? null : (
        <Package className="text-muted-foreground" />
      )}
    </span>
  );
}

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function productPriceLabel(row: Product) {
  if (String(row.status_sort_fk ?? "") === "2" && numberValue(row.prod_set_price) > 0) {
    return money(row.prod_set_price);
  }

  const prices = productDetails(row)
    .map((detail) => numberValue(detail.pro_detail_sprice))
    .filter((price) => price > 0);

  if (!prices.length) return "-";
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? money(min) : `${money(min)} - ${money(max)}`;
}

function totalStockQty(row: Product) {
  return productDetails(row).reduce((total, detail) => total + numberValue(detail.pro_detail_qty_stock ?? detail.qty_stock), 0);
}

function productOrderPoint(row: Product) {
  return numberValue(row.prod_order_point);
}

function detailStockQty(detail: ProductDetail) {
  return numberValue(detail.pro_detail_qty_stock ?? detail.qty_stock);
}

function detailStockSummary(details: ProductDetail[]): ProductStockSummary {
  const stockModes = details.map((detail) => binaryFlag(detail.pro_detail_stock, "1"));
  if (!stockModes.length || stockModes.every((value) => value === "1")) return "deduct";
  if (stockModes.every((value) => value === "2")) return "noDeduct";
  return "mixed";
}

function statusSortValue(status: StatusSort, fallback: number) {
  const raw = status.status_sort ?? status.status_sort_fk ?? status.id ?? fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? String(value) : "";
}

function shortDate(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return "-";
  return text.includes("T") ? text.slice(0, 10) : text;
}

function shortTime(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return "-";
  return text.length > 5 ? text.slice(0, 5) : text;
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate font-mono text-xs font-semibold">{value}</p>
    </div>
  );
}

export function ProductPage({ initialPagination }: { initialPagination: UrlPaginationState }) {
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
    resetPage,
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
        const fallback = fallbackTabs.find((tab) => tab.value === value)?.label ?? value;
        const label = language.startsWith("en")
          ? firstText(status, ["status_name_eng", "status_name", "status_name_la"], fallback)
          : firstText(status, ["status_name_la", "status_name", "status_name_eng"], fallback);
        return { value, label };
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

  function bulkStockActiveMode(summary: ProductStockSummary): ProductStockModeValue | null {
    if (summary === "deduct") return 1;
    if (summary === "noDeduct") return 2;
    return null;
  }

  function bulkStockModeLabel(mode: ProductStockModeValue) {
    return mode === 1 ? t("product.stockMode.deduct") : t("product.stockMode.noDeduct");
  }

  function bulkStockModeClass(mode: ProductStockModeValue) {
    return mode === 1 ? "bg-primary/10 text-primary" : "bg-secondary text-secondary-foreground";
  }

  function stockSummaryLabel(summary: ProductStockSummary) {
    if (summary === "deduct") return t("product.stockBulk.allDeduct");
    if (summary === "noDeduct") return t("product.stockBulk.allNoDeduct");
    return t("product.stockBulk.mixed");
  }

  function stockSummaryClass(summary: ProductStockSummary) {
    if (summary === "deduct") return "bg-primary/10 text-primary";
    if (summary === "noDeduct") return "bg-secondary text-secondary-foreground";
    return "bg-muted text-muted-foreground";
  }

  function renderNotificationStatus(row: Product) {
    const notificationKey: ProductStatusKey = `notification:${row.prod_uuid}`;
    const enabled = binaryFlag(row.prod_notification, "2") === "1";
    const pending = pendingKeys.has(notificationKey);

    return (
      <div className="flex items-center justify-center gap-2">
        {pending ? <Spinner /> : <Bell className="text-muted-foreground" />}
        <Badge className={enabled ? "bg-primary/10 text-primary" : "bg-secondary text-secondary-foreground"}>
          {enabled ? t("product.notification.on") : t("product.notification.off")}
        </Badge>
      </div>
    );
  }

  function renderStockSummaryStatus(row: ProductTableRow, compact = false) {
    const details = productDetails(row);
    const pendingKey: ProductStatusKey = `stock-all:${row.prod_uuid}`;
    const pending = pendingKeys.has(pendingKey);
    const pendingMode = pendingBulkStockModes[row.prod_uuid];

    if (!details.length) {
      return (
        <div className={cn("min-w-0", compact && "flex flex-col gap-1")}>
          <p className="font-mono text-sm font-bold">-</p>
          <Badge className="bg-muted text-muted-foreground">{t("common.noData")}</Badge>
        </div>
      );
    }

    const summary = detailStockSummary(details);
    const currentModeClass = pendingMode ? bulkStockModeClass(pendingMode) : stockSummaryClass(summary);

    return (
      <div className={cn("min-w-0", compact && "flex flex-col gap-1")}>
        <p className="font-mono text-sm font-bold">{totalStockQty(row)}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <Badge className={currentModeClass}>
            {pending ? <Spinner data-icon="inline-start" /> : null}
            {pendingMode ? bulkStockModeLabel(pendingMode) : stockSummaryLabel(summary)}
          </Badge>
          <Badge className="bg-primary/10 text-primary">
            {details.length} {t("product.sections.details")}
          </Badge>
        </div>
      </div>
    );
  }

  function renderActions(row: ProductTableRow) {
    const details = productDetails(row);
    const stockSummary = detailStockSummary(details);
    const activeStockMode = bulkStockActiveMode(stockSummary);
    const stockPendingKey: ProductStatusKey = `stock-all:${row.prod_uuid}`;
    const stockPending = pendingKeys.has(stockPendingKey);
    const notificationKey: ProductStatusKey = `notification:${row.prod_uuid}`;
    const notificationPending = pendingKeys.has(notificationKey);
    const notificationOn = binaryFlag(row.prod_notification, "2") === "1";

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" size="iconSm" variant="ghost" aria-label={t("common.actions")}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuGroup>
            <DropdownMenuItem onSelect={() => router.push(`/product/form?prod_uuid=${encodeURIComponent(row.prod_uuid)}`)}>
              <Pencil />
              {t("actions.edit")}
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-xs text-muted-foreground">{t("product.notification.label")}</DropdownMenuLabel>
            <DropdownMenuCheckboxItem
              checked={notificationOn}
              disabled={notificationPending}
              onCheckedChange={(checked) => updateNotification(row, checked === true)}
            >
              {notificationPending ? <Spinner /> : <Bell />}
              {notificationOn ? t("product.notification.on") : t("product.notification.off")}
            </DropdownMenuCheckboxItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel className="flex items-center gap-2 text-xs text-muted-foreground">
              {stockPending ? <Spinner /> : <Boxes />}
              {t("product.stockBulk.label")}
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={activeStockMode ? String(activeStockMode) : ""}
              onValueChange={(value) => {
                if (value === "1" || value === "2") updateAllDetailStockModes(row, Number(value) as ProductStockModeValue);
              }}
            >
              <DropdownMenuRadioItem value="1" disabled={!details.length || stockPending}>
                {t("product.stockMode.deduct")}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="2" disabled={!details.length || stockPending}>
                {t("product.stockMode.noDeduct")}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem variant="destructive" onSelect={() => setDeleteTarget(row)}>
              <Trash2 />
              {t("actions.delete")}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  function renderStockSelect(detail: ProductDetail, compact = false, prodUuid?: string) {
    const detailUuid = productDetailUuid(detail);
    const stockKey: ProductStatusKey = `stock:${detailUuid}`;
    const enabledKey: ProductStatusKey = `enabled:${detailUuid}`;
    const bulkStockPending = prodUuid ? pendingKeys.has(`stock-all:${prodUuid}`) : false;
    const disabled = bulkStockPending || pendingKeys.has(stockKey) || pendingKeys.has(enabledKey);

    return (
      <Select
        value={binaryFlag(detail.pro_detail_stock, "1")}
        disabled={disabled}
        onValueChange={(value) => updateDetailStockMode(detail, value)}
      >
        <SelectTrigger size="sm" className={compact ? "w-full" : "w-40"}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper">
          <SelectGroup>
            <SelectItem value="1">{t("product.stockMode.deduct")}</SelectItem>
            <SelectItem value="2">{t("product.stockMode.noDeduct")}</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    );
  }

  function renderStockStatus(detail: ProductDetail, compact = false) {
    const stockMode = binaryFlag(detail.pro_detail_stock, "1");
    const label = stockMode === "1" ? t("product.stockMode.deduct") : t("product.stockMode.noDeduct");
    const className = stockMode === "1" ? "bg-primary/10 text-primary" : "bg-secondary text-secondary-foreground";

    return (
      <div className={cn("flex min-h-8 items-center", compact ? "w-full" : "justify-center")}>
        <Badge className={className}>{label}</Badge>
      </div>
    );
  }

  function renderEnabledSwitch(detail: ProductDetail) {
    const detailUuid = productDetailUuid(detail);
    const stockKey: ProductStatusKey = `stock:${detailUuid}`;
    const enabledKey: ProductStatusKey = `enabled:${detailUuid}`;
    const disabled = pendingKeys.has(stockKey) || pendingKeys.has(enabledKey);

    return (
      <Switch
        checked={binaryFlag(detail.pro_detail_enabled, "1") === "1"}
        disabled={disabled}
        size="sm"
        aria-label={t("product.detailEnabledStatus")}
        onCheckedChange={(checked) => updateDetailEnabled(detail, checked)}
      />
    );
  }

  function renderDetailPanel(row: ProductTableRow) {
    const details = productDetails(row);
    const isPromotion = String(statusSortFk) === "3";
    const isFoodSet = String(statusSortFk) === "2";

    if (!details.length) return null;

    return (
      <MotionTableRow
        key={`${row.prod_uuid}-details`}
        initial={detailMotion.initial}
        animate={detailMotion.animate}
        exit={{ ...detailMotion.exit, pointerEvents: "none" }}
        transition={detailMotion.transition}
        className="origin-top transform-gpu bg-muted/15 will-change-transform hover:bg-muted/15"
      >
        <TableCell colSpan={8} className="px-4 py-3">
          <div>
            <div className="overflow-hidden rounded-lg border border-border bg-background shadow-sm">
              <div className="border-b border-border bg-muted/20 p-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Boxes className="text-primary" />
                    <p className="text-sm font-black">{t("product.sections.details")}</p>
                    <Badge>{details.length}</Badge>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {productName(row, language)}
                  </p>
                </div>
              </div>
              <div className="grid gap-2 p-3 lg:grid-cols-2 xl:grid-cols-3">
                {details.map((detail, index) => {
                  const detailUuid = productDetailUuid(detail) || `${row.prod_uuid}-${index}`;
                  return (
                    <div key={detailUuid} className="rounded-md border border-border bg-card p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black">{detailLabel(detail, index, language)}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {isFoodSet ? t("pos.product") : t("fields.size")}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="text-xs text-muted-foreground">{t("product.detailEnabledStatus")}</span>
                          {renderEnabledSwitch(detail)}
                        </div>
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        <DetailMetric label={t("fields.bprice")} value={money(detail.pro_detail_bprice)} />
                        <DetailMetric
                          label={isFoodSet ? t("product.setPrice") : t("fields.sprice")}
                          value={isFoodSet ? money(row.prod_set_price) : money(detail.pro_detail_sprice)}
                        />
                        <DetailMetric label={t("fields.qtyStock")} value={String(detailStockQty(detail))} />
                      </div>
                      <div className="mt-3">
                        {isFoodSet ? renderStockSelect(detail, true, row.prod_uuid) : renderStockStatus(detail, true)}
                      </div>
                      {isPromotion ? (
                        <div className="mt-3 rounded-md bg-muted/30 p-2 text-xs text-muted-foreground">
                          <p className="truncate">
                            {t("product.buyQty")}: {String(detail.pro_detail_cus_qtyBuy ?? 0)} / {t("product.freeQty")}: {String(detail.pro_detail_cus_qtyFree ?? 0)}
                          </p>
                          <p className="truncate">
                            {shortDate(detail.pro_detail_sDate)} - {shortDate(detail.pro_detail_eDate)}
                          </p>
                          <p className="truncate">
                            {shortTime(detail.pro_detail_sTime)} - {shortTime(detail.pro_detail_eTime)}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </TableCell>
      </MotionTableRow>
    );
  }

  function renderDesktopTable() {
    return (
      <div className="relative hidden min-h-0 flex-1 overflow-auto md:block">
        <Table className="min-w-[1080px]">
          <TableHeader className="sticky top-0 z-40 bg-background shadow-sm [&_th]:sticky [&_th]:top-0 [&_th]:z-40 [&_th]:border-b [&_th]:border-border [&_th]:bg-background [&_th]:shadow-sm">
            <TableRow>
              <TableHead className="w-10 px-2">
                <Checkbox
                  aria-label={t("common.selectAll")}
                  checked={allSelected}
                  onChange={(event) => toggleAllSelected(event.target.checked)}
                />
              </TableHead>
              <TableHead className="w-20 text-center">
                <Button
                  type="button"
                  size="iconSm"
                  variant="ghost"
                  aria-label={allDetailsExpanded ? t("actions.collapseAll") : t("actions.expandAll")}
                  aria-expanded={allDetailsExpanded}
                  disabled={!detailProductIds.length}
                  onClick={toggleAllDetails}
                >
                  <ChevronsUpDown />
                </Button>
              </TableHead>
              <TableHead className="min-w-72">{t("fields.prod_name")}</TableHead>
              <TableHead className="min-w-48">{t("nav.category")} / {t("product.type")}</TableHead>
              <TableHead className="min-w-44">{t("fields.prod_price")}</TableHead>
              <TableHead className="min-w-52">{t("fields.qtyStock")}</TableHead>
              <TableHead className="w-40 text-center">{t("product.notification.label")}</TableHead>
              <TableHead className="w-16 text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="bg-card">
            {filteredRows.flatMap((row) => {
              const details = productDetails(row);
              const hasDetails = details.length > 0;
              const expanded = hasDetails && !collapsedProducts.has(row.prod_uuid);
              const selected = selectedRows.has(row.prod_uuid);
              const orderPoint = productOrderPoint(row);
              const rowsToRender = [
                <TableRow
                  key={row.prod_uuid}
                  className={cn(
                    "bg-card data-[state=selected]:bg-primary/5 [&>td]:py-3",
                    expanded && "border-l-4 border-l-primary/50"
                  )}
                  data-state={selected ? "selected" : undefined}
                >
                  <TableCell className="w-10 px-2">
                    <Checkbox
                      aria-label={t("common.selectRow", { name: productName(row, language) })}
                      checked={selected}
                      onChange={(event) => toggleSelected(row.prod_uuid, event.target.checked)}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        type="button"
                        size="iconSm"
                        variant="ghost"
                        aria-label={`${t("product.sections.details")} ${productName(row, language)}`}
                        aria-expanded={expanded}
                        disabled={!hasDetails}
                        onClick={() => toggleProductDetails(row.prod_uuid)}
                      >
                        {hasDetails ? (
                          <ChevronRight
                            className={cn(
                              "transition-transform duration-150 ease-out motion-reduce:transition-none",
                              expanded && "rotate-90"
                            )}
                          />
                        ) : (
                          <Package />
                        )}
                      </Button>
                      <span className="font-mono text-xs font-black text-muted-foreground">{row.row_number}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex min-w-0 items-center gap-3">
                      <ProductMedia row={row} />
                      <div className="min-w-0">
                        <p className="truncate font-black">{productName(row, language)}</p>
                        <p className="truncate text-xs text-muted-foreground">{row.prod_code || "-"}</p>
                        <p className="truncate text-xs text-muted-foreground">{unitName(row, language)}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{categoryName(row, language)}</p>
                      <Badge className="mt-1 bg-primary/10 text-primary">{activeStatusLabel}</Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="min-w-0">
                      <p className="truncate font-mono font-bold">{productPriceLabel(row)}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="min-w-0">
                      {renderStockSummaryStatus(row)}
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {orderPoint > 0 ? <Badge>{t("product.orderPoint")}: {orderPoint}</Badge> : null}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {renderNotificationStatus(row)}
                  </TableCell>
                  <TableCell className="text-right">{renderActions(row)}</TableCell>
                </TableRow>
              ];

              if (hasDetails) {
                rowsToRender.push(
                  <AnimatePresence key={`${row.prod_uuid}-details-presence`} initial={false}>
                    {expanded ? renderDetailPanel(row) : null}
                  </AnimatePresence>
                );
              }
              return rowsToRender;
            })}
          </TableBody>
        </Table>
      </div>
    );
  }

  function renderMobileProduct(row: ProductTableRow) {
    const details = productDetails(row);
    const expanded = details.length > 0 && !collapsedProducts.has(row.prod_uuid);
    const isFoodSet = String(statusSortFk) === "2";
    const orderPoint = productOrderPoint(row);
    const selected = selectedRows.has(row.prod_uuid);

    return (
      <div
        key={row.prod_uuid}
        className="overflow-hidden rounded-lg border border-border bg-card p-3 shadow-sm data-[state=selected]:border-primary/60 data-[state=selected]:bg-primary/5"
        data-state={selected ? "selected" : undefined}
      >
        <div className="flex min-w-0 items-start gap-3">
          <Checkbox
            aria-label={t("common.selectRow", { name: productName(row, language) })}
            checked={selected}
            className="mt-1"
            onChange={(event) => toggleSelected(row.prod_uuid, event.target.checked)}
          />
          <ProductMedia row={row} className="size-16" />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-black">{productName(row, language)}</p>
                <p className="truncate text-xs text-muted-foreground">{row.prod_code || "-"}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Badge>{row.row_number}</Badge>
                {renderActions(row)}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 grid gap-2 rounded-md border border-border bg-muted/15 p-3 text-xs sm:grid-cols-2">
          <div className="min-w-0">
            <p className="text-muted-foreground">{t("nav.category")} / {t("product.type")}</p>
            <p className="mt-0.5 truncate font-semibold">{categoryName(row, language)}</p>
            <Badge className="mt-1 bg-primary/10 text-primary">{activeStatusLabel}</Badge>
          </div>
          <div className="min-w-0">
            <p className="text-muted-foreground">{t("fields.prod_price")}</p>
            <p className="mt-0.5 font-mono font-semibold">{productPriceLabel(row)}</p>
          </div>
          <div className="min-w-0">
            <p className="text-muted-foreground">{t("fields.qtyStock")}</p>
            <div className="mt-0.5">{renderStockSummaryStatus(row, true)}</div>
            {orderPoint > 0 ? <p className="mt-0.5 text-muted-foreground">{t("product.orderPoint")}: {orderPoint}</p> : null}
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground">{t("product.notification.label")}</span>
            <div className="flex justify-start">{renderNotificationStatus(row)}</div>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full justify-between"
            disabled={!details.length}
            aria-expanded={expanded}
            onClick={() => toggleProductDetails(row.prod_uuid)}
          >
            <span className="flex items-center gap-2">
              <Boxes data-icon="inline-start" />
              {t("product.sections.details")} ({details.length})
            </span>
            <ChevronRight
              data-icon="inline-end"
              className={cn(
                "transition-transform duration-150 ease-out motion-reduce:transition-none",
                expanded && "rotate-90"
              )}
            />
          </Button>

          <AnimatePresence initial={false}>
            {expanded ? (
              <motion.div
                key={`${row.prod_uuid}-mobile-details`}
                initial={detailMotion.initial}
                animate={detailMotion.animate}
                exit={{ ...detailMotion.exit, pointerEvents: "none" }}
                transition={detailMotion.transition}
                className="origin-top transform-gpu will-change-transform"
              >
                <div className="flex flex-col gap-2">
                  {details.map((detail, index) => (
                    <div key={productDetailUuid(detail) || String(index)} className="rounded-md border border-border bg-muted/25 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold">{detailLabel(detail, index, language)}</p>
                          <p className="text-xs text-muted-foreground">
                            {isFoodSet ? t("pos.product") : t("fields.size")}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{t("product.detailEnabledStatus")}</span>
                          {renderEnabledSwitch(detail)}
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        <DetailMetric label={t("fields.bprice")} value={money(detail.pro_detail_bprice)} />
                        <DetailMetric label={isFoodSet ? t("product.setPrice") : t("fields.sprice")} value={isFoodSet ? money(row.prod_set_price) : money(detail.pro_detail_sprice)} />
                        <DetailMetric label={t("fields.qtyStock")} value={String(detailStockQty(detail))} />
                        <div className="sm:col-span-3">
                          {isFoodSet
                            ? renderStockSelect(detail, true, row.prod_uuid)
                            : renderStockStatus(detail, true)}
                        </div>
                      </div>
                      {String(statusSortFk) === "3" ? (
                        <div className="mt-3 rounded-md bg-background/70 p-2 text-xs text-muted-foreground">
                          <p>
                            {t("product.buyQty")}: {String(detail.pro_detail_cus_qtyBuy ?? 0)} / {t("product.freeQty")}: {String(detail.pro_detail_cus_qtyFree ?? 0)}
                          </p>
                          <p>
                            {shortDate(detail.pro_detail_sDate)} - {shortDate(detail.pro_detail_eDate)}
                          </p>
                          <p>
                            {shortTime(detail.pro_detail_sTime)} - {shortTime(detail.pro_detail_eTime)}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-5">
        <div className="min-w-0">
          <p className="text-sm font-bold text-primary">{t("product.title")}</p>
          <h1 className="mt-1 text-xl font-black">{t("product.menuStock")}</h1>
        </div>
        <Link className={cn(buttonVariants({ size: "sm" }), "shadow-sm")} href="/product/form">
          <Plus data-icon="inline-start" />
          {t("product.newProduct")}
        </Link>
      </div>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border-x-0 border-b-0">
        <CardHeader className="shrink-0 border-t border-border/70 bg-muted/15 px-4 py-2.5 lg:px-5">
          <div className="flex w-full flex-col gap-2 xl:flex-row xl:items-end xl:justify-between">
            <section className="grid min-w-0 gap-2 md:grid-cols-[minmax(18rem,26rem)_minmax(12rem,20rem)_minmax(7rem,9rem)]">
              <Field className="gap-1">
                <FieldLabel htmlFor="product-search-filter" className="text-xs font-bold text-muted-foreground">
                  {t("actions.search")}
                </FieldLabel>
                <div className="flex min-w-0">
                  <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="product-search-filter"
                      className="h-9 rounded-r-none border-r-0 pl-9 text-sm focus-visible:z-10"
                      value={search}
                      placeholder={t("product.searchProducts")}
                      onChange={(event) => setSearch(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") applyFilters();
                      }}
                    />
                  </div>
                  <Button
                    className="h-9 shrink-0 rounded-l-none px-3 sm:px-4"
                    size="sm"
                    variant="outline"
                    disabled={loading}
                    onClick={applyFilters}
                  >
                    {loading ? <Spinner data-icon="inline-start" /> : <Search data-icon="inline-start" />}
                    {t("actions.search")}
                  </Button>
                </div>
              </Field>
              <Field className="gap-1">
                <FieldLabel htmlFor="product-category-filter" className="text-xs font-bold text-muted-foreground">
                  {t("nav.category")}
                </FieldLabel>
                <Select
                  value={cateUuidFk || ALL_CATEGORIES_VALUE}
                  disabled={categoryLoading}
                  onValueChange={changeCategory}
                >
                  <SelectTrigger id="product-category-filter" className="h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" align="end">
                    <SelectGroup>
                      <SelectItem value={ALL_CATEGORIES_VALUE}>
                        {t("common.all")} {t("nav.category")}
                      </SelectItem>
                      {categoryOptions.map((category) => {
                        const uuid = categoryUuid(category);
                        return (
                          <SelectItem key={uuid} value={uuid}>
                            {categoryOptionName(category, language)}
                          </SelectItem>
                        );
                      })}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field className="gap-1">
                <FieldLabel htmlFor="product-limit-filter" className="text-xs font-bold text-muted-foreground">
                  {t("common.rowsPerPage")}
                </FieldLabel>
                <Select value={String(pageLimit)} onValueChange={changePageLimit}>
                  <SelectTrigger id="product-limit-filter" className="h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" align="end">
                    <SelectGroup>
                      {PAGE_LIMIT_OPTIONS.map((limit) => (
                        <SelectItem key={String(limit)} value={String(limit)}>
                          {limit === "All" ? t("common.all") : limit}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </section>
            <section className="flex w-full min-w-0 justify-start xl:w-[30rem] xl:shrink-0 xl:justify-end">
              <Field className="w-full min-w-0 gap-1">
                <FieldLabel className="text-xs font-bold text-muted-foreground">{t("product.type")}</FieldLabel>
                <div role="tablist" aria-label={t("product.type")} className="grid h-9 w-full max-w-xl grid-cols-3 gap-1 rounded-md border border-border bg-background/70 p-1 xl:max-w-none">
                  {statusTabs.map((tab) => {
                    const active = tab.value === statusSortFk;
                    return (
                      <Button
                        key={tab.value}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        size="xs"
                        variant={active ? "default" : "ghost"}
                        className="h-7 min-w-0 px-2 text-xs shadow-none"
                        onClick={() => changeStatusSort(tab.value)}
                      >
                        <span className="truncate">{tab.label}</span>
                      </Button>
                    );
                  })}
                </div>
              </Field>
            </section>
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          {loading ? (
            <div className="min-h-0 flex-1 p-4">
              <LoadingState label={t("product.loading")} variant="table" />
            </div>
          ) : filteredRows.length ? (
            <>
              {selectedRows.size ? (
                <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-primary/5 px-4 py-2 text-sm">
                  <Badge className="bg-primary/10 text-primary">
                    {t("common.selectedCount", { count: selectedRows.size })}
                  </Badge>
                  <Button type="button" size="xs" variant="ghost" onClick={clearSelection}>
                    {t("actions.clear")}
                  </Button>
                </div>
              ) : null}
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-3 py-2 md:hidden">
                <label className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                  <Checkbox
                    aria-label={t("common.selectAll")}
                    checked={allSelected}
                    onChange={(event) => toggleAllSelected(event.target.checked)}
                  />
                  <span className="truncate">{t("common.selectAll")}</span>
                </label>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {t("common.showingRange", { start: pageStart, end: pageEnd, total: total || rows.length })}
                </span>
              </div>
              {renderDesktopTable()}
              <div className="min-h-0 flex-1 overflow-y-auto p-3 md:hidden">
                <div className="flex flex-col gap-2">
                  {filteredRows.map((row) => renderMobileProduct(row))}
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-2 border-t border-border px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <span>{t("common.showingRange", { start: pageStart, end: pageEnd, total: total || rows.length })}</span>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:flex">
                  <Button className="min-w-0" disabled={!canGoBack} size="xs" type="button" variant="outline" onClick={() => goToPage(page - 1)}>
                    <ChevronLeft data-icon="inline-start" />
                    {t("actions.back")}
                  </Button>
                  <Badge className="h-7 px-2 text-xs">
                    {t("common.page", { current: page, total: Math.max(1, totalPages) })}
                  </Badge>
                  <Button className="min-w-0" disabled={!canGoNext} size="xs" type="button" variant="outline" onClick={() => goToPage(Math.min(Math.max(1, totalPages), page + 1))}>
                    {t("common.nextPage")}
                    <ChevronRight data-icon="inline-end" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex min-h-72 flex-1 items-center justify-center p-4">
              <EmptyState title={t("product.noProducts")} description={t("product.createOrSearch")} />
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        cancelLabel={t("actions.cancel")}
        confirmLabel={t("actions.delete")}
        description={t("product.deleteConfirm")}
        open={Boolean(deleteTarget)}
        title={t("actions.delete")}
        onConfirm={() => {
          if (deleteTarget) void remove(deleteTarget);
        }}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setDeleteTarget(null);
        }}
      />
    </div>
  );
}
