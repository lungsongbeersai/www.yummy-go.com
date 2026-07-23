import type { TFunction } from "i18next";
import { TableStatus } from "@/config/pos-constants";
import type { CateProductItem, CateWithProducts } from "@/services/pos";
import {
  PUBLIC_MENU_KIND,
  type PublicMenuKind,
} from "@/stores/public-pos-store/helpers";
import { DEFAULT_PUBLIC_CATEGORY_ICON } from "@/features/public-pos/order/constants";
import type { PublicDisplayProduct } from "@/features/public-pos/order/types";

export function tableStatusLabel(status: number, t: TFunction) {
  if (Number(status) === TableStatus.AVAILABLE) return t("common.free");
  if (Number(status) === TableStatus.OCCUPIED) return t("common.busy");
  return String(status);
}

export function publicCategoryIconName(icon?: string | null) {
  const value = icon?.trim().toLowerCase() ?? "";
  if (!value) return "";

  const iconName = value.includes(":") ? value : `mdi:${value}`;
  if (!iconName.startsWith("mdi:")) return DEFAULT_PUBLIC_CATEGORY_ICON;

  return iconName;
}

export function flattenStatusProducts(
  categories: CateWithProducts[],
  statusKind: PublicMenuKind,
): PublicDisplayProduct[] {
  const products: PublicDisplayProduct[] = [];

  categories.forEach((category) => {
    const cateUuid = category.cate_uuid.startsWith("__special_")
      ? ""
      : category.cate_uuid;

    (category.products ?? []).forEach((product) => {
      products.push({
        product,
        cateUuid,
        statusKind,
      });
    });
  });

  return products;
}

export function statusSectionLabel(statusKind: PublicMenuKind, lang: string) {
  const isEnglish = lang === "en";
  if (statusKind === PUBLIC_MENU_KIND.PROMOTION)
    return isEnglish ? "Promotion" : "ໂປຣໂມຊັນ";
  if (statusKind === PUBLIC_MENU_KIND.SET)
    return isEnglish ? "Set" : "ເຊັດອາຫານ";
  return isEnglish ? "Normal" : "ທົ່ວໄປ";
}

export function orderCateUuidsByMenu(
  cateUuids: string[],
  menuCategories: CateWithProducts[],
) {
  const requested = new Set(cateUuids.filter(Boolean));
  return menuCategories
    .map((category) => category.cate_uuid)
    .filter((cateUuid) => requested.has(cateUuid));
}

export interface RenderedMenuSection {
  category: CateWithProducts;
  products: CateProductItem[];
  totalProducts: number;
  visibleCount: number;
  loaded: boolean;
  loading: boolean;
}

export function getRenderedMenuSections({
  renderedCateUuids,
  categoryByUuid,
  visibleProductCountByCate,
  loadedCateUuids,
  loadingCateUuids,
  productRenderChunk,
}: {
  renderedCateUuids: string[];
  categoryByUuid: Map<string, CateWithProducts>;
  visibleProductCountByCate: Record<string, number>;
  loadedCateUuids: string[];
  loadingCateUuids: string[];
  productRenderChunk: number;
}): RenderedMenuSection[] {
  return renderedCateUuids
    .map((cateUuid) => {
      const category = categoryByUuid.get(cateUuid);
      if (!category) return null;

      const totalProducts = category.products?.length ?? 0;
      const visibleCount = Math.min(
        totalProducts,
        visibleProductCountByCate[cateUuid] ?? productRenderChunk,
      );

      return {
        category,
        products: (category.products ?? []).slice(0, visibleCount),
        totalProducts,
        visibleCount,
        loaded: loadedCateUuids.includes(cateUuid),
        loading: loadingCateUuids.includes(cateUuid),
      };
    })
    .filter((section): section is RenderedMenuSection => Boolean(section));
}

export function hasMoreMenuToRender({
  collapsedCateUuids,
  loadedCateUuids,
  menuCategories,
  categoryByUuid,
  renderedCateUuids,
  visibleProductCountByCate,
}: {
  collapsedCateUuids: string[];
  loadedCateUuids: string[];
  menuCategories: CateWithProducts[];
  categoryByUuid: Map<string, CateWithProducts>;
  renderedCateUuids: string[];
  visibleProductCountByCate: Record<string, number>;
}) {
  const lastCateUuid = renderedCateUuids.at(-1);
  if (!lastCateUuid) return Boolean(menuCategories.length);
  if (!loadedCateUuids.includes(lastCateUuid)) return false;

  const lastCategory = categoryByUuid.get(lastCateUuid);
  const collapsed = collapsedCateUuids.includes(lastCateUuid);
  if (
    !collapsed &&
    lastCategory &&
    (visibleProductCountByCate[lastCateUuid] ?? 0) <
      (lastCategory.products?.length ?? 0)
  ) {
    return true;
  }

  const lastIndex = menuCategories.findIndex(
    (category) => category.cate_uuid === lastCateUuid,
  );
  return (
    lastIndex >= 0 &&
    menuCategories
      .slice(lastIndex + 1)
      .some((category) => !renderedCateUuids.includes(category.cate_uuid))
  );
}

export function visibleProductCountForCategory(
  category: CateWithProducts,
  productRenderChunk: number,
) {
  const totalProducts = category.products?.length ?? 0;
  return totalProducts > 0 ? Math.min(productRenderChunk, totalProducts) : 0;
}

export function nextPublicMenuCategoryReset({
  categoryOrderKey,
  defaultCateUuid,
  menuCategories,
  previousCategoryOrderKey,
  productRenderChunk,
  selectedCateUuid,
}: {
  categoryOrderKey: string;
  defaultCateUuid: string;
  menuCategories: CateWithProducts[];
  previousCategoryOrderKey: string | null;
  productRenderChunk: number;
  selectedCateUuid: string;
}) {
  if (previousCategoryOrderKey === categoryOrderKey) return null;

  const requestedCateUuid =
    selectedCateUuid || defaultCateUuid || menuCategories[0]?.cate_uuid || "";
  const firstCategory =
    menuCategories.find(
      (category) => category.cate_uuid === requestedCateUuid,
    ) ?? menuCategories[0];

  if (!firstCategory) {
    return {
      activeCateUuid: "",
      categoryOrderKey,
      renderedCateUuids: [],
      visibleProductCountByCate: {},
    };
  }

  const visibleCount = visibleProductCountForCategory(
    firstCategory,
    productRenderChunk,
  );

  return {
    activeCateUuid: firstCategory.cate_uuid,
    categoryOrderKey,
    renderedCateUuids: [firstCategory.cate_uuid],
    visibleProductCountByCate:
      visibleCount > 0 ? { [firstCategory.cate_uuid]: visibleCount } : {},
  };
}

export function missingPublicMenuCategoryRefUuids<T>(
  categoryRefs: Record<string, T>,
  liveCateUuids: readonly string[],
) {
  const liveCateUuidSet = new Set(liveCateUuids);
  return Object.keys(categoryRefs).filter(
    (cateUuid) => !liveCateUuidSet.has(cateUuid),
  );
}

export function getCategoryPathUuids({
  activeCateUuid,
  targetCateUuid,
  renderedCateUuids,
  menuCategories,
}: {
  activeCateUuid: string;
  targetCateUuid: string;
  renderedCateUuids: string[];
  menuCategories: CateWithProducts[];
}) {
  const targetIndex = menuCategories.findIndex(
    (category) => category.cate_uuid === targetCateUuid,
  );
  if (targetIndex < 0) return [];

  const anchorCateUuid =
    activeCateUuid ||
    renderedCateUuids.at(-1) ||
    menuCategories[0]?.cate_uuid ||
    "";
  const anchorIndex = Math.max(
    0,
    menuCategories.findIndex(
      (category) => category.cate_uuid === anchorCateUuid,
    ),
  );
  const fromIndex = Math.min(anchorIndex, targetIndex);
  const toIndex = Math.max(anchorIndex, targetIndex);

  return menuCategories
    .slice(fromIndex, toIndex + 1)
    .map((category) => category.cate_uuid);
}

export function withCategoryPathVisibleCounts({
  current,
  pathCateUuids,
  categoryByUuid,
  productRenderChunk,
}: {
  current: Record<string, number>;
  pathCateUuids: string[];
  categoryByUuid: Map<string, CateWithProducts>;
  productRenderChunk: number;
}) {
  let next = current;

  pathCateUuids.forEach((cateUuid) => {
    const category = categoryByUuid.get(cateUuid);
    const visibleCount = category
      ? visibleProductCountForCategory(category, productRenderChunk)
      : 0;
    if (visibleCount <= 0 || next[cateUuid]) return;

    next = {
      ...next,
      [cateUuid]: visibleCount,
    };
  });

  return next;
}

export function publicQrDownloadFilename(tableName?: string | null) {
  const basename = tableName?.trim() || "public-pos";
  const safeBasename =
    basename.replace(/[\\/:*?"<>|]+/g, "-").trim() || "public-pos";
  return `${safeBasename}-qr.png`;
}
