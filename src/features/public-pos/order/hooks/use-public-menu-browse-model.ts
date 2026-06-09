"use client";

import { useMemo } from "react";
import {
  type PublicMenuByKind,
  PUBLIC_MENU_KIND,
} from "@/stores/public-pos-store";
import { PRODUCT_RENDER_CHUNK } from "../constants";
import {
  flattenStatusProducts,
  getRenderedMenuSections,
  hasMoreMenuToRender,
  hasRemoteProductImage,
} from "../utils";

interface UsePublicMenuBrowseModelParams {
  collapsedCateUuids: string[];
  menuByKind: PublicMenuByKind;
  renderedCateUuids: string[];
  visibleProductCountByCate: Record<string, number>;
}

export function usePublicMenuBrowseModel({
  collapsedCateUuids,
  menuByKind,
  renderedCateUuids,
  visibleProductCountByCate,
}: UsePublicMenuBrowseModelParams) {
  const promotionMenu = menuByKind[PUBLIC_MENU_KIND.PROMOTION];
  const setMenu = menuByKind[PUBLIC_MENU_KIND.SET];
  const normalMenu = menuByKind[PUBLIC_MENU_KIND.NORMAL];
  const menuCategories = normalMenu.categories;
  const categoryTabs = normalMenu.categoryTabs;
  const selectedCateUuid = normalMenu.selectedCateUuid;
  const defaultCateUuid = normalMenu.defaultCateUuid;
  const loadedCateUuids = normalMenu.loadedCateUuids;
  const loadingCateUuids = normalMenu.loadingCateUuids;
  const visibleCategoryTabs = categoryTabs;

  const categoryOrderKey = useMemo(
    () => menuCategories.map((category) => category.cate_uuid).join(":"),
    [menuCategories],
  );
  const promotionProducts = useMemo(
    () =>
      flattenStatusProducts(
        promotionMenu.categories,
        PUBLIC_MENU_KIND.PROMOTION,
      ),
    [promotionMenu.categories],
  );
  const setProducts = useMemo(
    () => flattenStatusProducts(setMenu.categories, PUBLIC_MENU_KIND.SET),
    [setMenu.categories],
  );
  const hasPromotionImage = promotionProducts.some(({ product }) =>
    hasRemoteProductImage(product),
  );
  const hasSetImage = setProducts.some(({ product }) =>
    hasRemoteProductImage(product),
  );
  const hasAnyNormalProducts = menuCategories.some(
    (category) => (category.products?.length ?? 0) > 0,
  );
  const hasAnyProducts = Boolean(
    promotionProducts.length || setProducts.length || hasAnyNormalProducts,
  );
  const menuCategoryByUuid = useMemo(
    () =>
      new Map(menuCategories.map((category) => [category.cate_uuid, category])),
    [menuCategories],
  );
  const firstLoadedCateUuid =
    selectedCateUuid || defaultCateUuid || menuCategories[0]?.cate_uuid || "";
  const renderedMenuSections = useMemo(
    () =>
      getRenderedMenuSections({
        renderedCateUuids,
        categoryByUuid: menuCategoryByUuid,
        visibleProductCountByCate,
        loadedCateUuids,
        loadingCateUuids,
        productRenderChunk: PRODUCT_RENDER_CHUNK,
      }),
    [
      loadedCateUuids,
      loadingCateUuids,
      menuCategoryByUuid,
      renderedCateUuids,
      visibleProductCountByCate,
    ],
  );
  const hasMoreRenderedMenu = useMemo(
    () =>
      hasMoreMenuToRender({
        collapsedCateUuids,
        loadedCateUuids,
        menuCategories,
        categoryByUuid: menuCategoryByUuid,
        renderedCateUuids,
        visibleProductCountByCate,
      }),
    [
      collapsedCateUuids,
      loadedCateUuids,
      menuCategories,
      menuCategoryByUuid,
      renderedCateUuids,
      visibleProductCountByCate,
    ],
  );
  const hasScrollJumpPendingContent = useMemo(
    () =>
      hasMoreRenderedMenu ||
      renderedCateUuids.some((cateUuid) => loadingCateUuids.includes(cateUuid)),
    [hasMoreRenderedMenu, loadingCateUuids, renderedCateUuids],
  );

  return {
    categoryOrderKey,
    defaultCateUuid,
    firstLoadedCateUuid,
    hasAnyProducts,
    hasMoreRenderedMenu,
    hasPromotionImage,
    hasScrollJumpPendingContent,
    hasSetImage,
    loadedCateUuids,
    loadingCateUuids,
    menuCategories,
    menuCategoryByUuid,
    normalMenu,
    promotionMenu,
    promotionProducts,
    selectedCateUuid,
    setMenu,
    setProducts,
    visibleCategoryTabs,
    renderedMenuSections,
  };
}

export type PublicMenuBrowseModel = ReturnType<
  typeof usePublicMenuBrowseModel
>;
