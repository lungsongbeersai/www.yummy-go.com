"use client";

import type { TFunction } from "i18next";
import { useCallback, useEffect, useRef, useState } from "react";
import { useResetOnChange, useResetOnDeps } from "@/hooks/use-reset-on-change";
import {
  type PublicMenuByKind,
  PUBLIC_MENU_KIND,
  type PublicMenuKind,
  usePublicPosStore,
} from "@/stores/public-pos-store";
import type { ToastInput } from "@/stores/toast-store";
import {
  CATEGORY_LOAD_SCROLL_SUPPRESS_MS,
  CATEGORY_SCROLL_SUPPRESS_MS,
  PRODUCT_RENDER_CHUNK,
  RAIL_RENDER_CHUNK,
} from "@/features/public-pos/order/constants";
import { usePublicMenuBrowseModel } from "@/features/public-pos/order/hooks/use-public-menu-browse-model";
import { usePublicMenuCategoryLoader } from "@/features/public-pos/order/hooks/use-public-menu-category-loader";
import { usePublicCategoryScroll } from "@/features/public-pos/order/hooks/use-public-category-scroll";
import {
  getCategoryPathUuids,
  missingPublicMenuCategoryRefUuids,
  nextPublicMenuCategoryReset,
  orderCateUuidsByMenu,
  visibleProductCountForCategory,
  withCategoryPathVisibleCounts,
} from "@/features/public-pos/order/utils";

type PublicPosState = ReturnType<typeof usePublicPosStore.getState>;

interface PendingCategoryScroll {
  cateUuid: string;
  requestId: number;
}

interface PendingActiveCategorySync {
  cateUuid: string | null;
  requestId: number;
}

interface UsePublicMenuBrowseParams {
  lang: string;
  loadMenuProducts: PublicPosState["loadMenuProducts"];
  loadNormalCategoryProducts: PublicPosState["loadNormalCategoryProducts"];
  menuByKind: PublicMenuByKind;
  menuRequestKey: string;
  searchRun: number;
  setError: PublicPosState["setError"];
  setSelectedCateUuid: PublicPosState["setSelectedCateUuid"];
  submittedSearch: string;
  t: TFunction;
  toast: (toast: ToastInput) => void;
  token: string;
}

export function usePublicMenuBrowse({
  lang,
  loadMenuProducts,
  loadNormalCategoryProducts,
  menuByKind,
  menuRequestKey,
  searchRun,
  setError,
  setSelectedCateUuid,
  submittedSearch,
  t,
  toast,
  token,
}: UsePublicMenuBrowseParams) {
  const [renderedCateUuids, setRenderedCateUuids] = useState<string[]>([]);
  const [jumpingCateUuid, setJumpingCateUuid] = useState("");
  const [pendingCategoryScroll, setPendingCategoryScroll] =
    useState<PendingCategoryScroll>({ cateUuid: "", requestId: 0 });
  const [pendingActiveCategorySync, setPendingActiveCategorySync] =
    useState<PendingActiveCategorySync>({ cateUuid: null, requestId: 0 });
  const [collapsedCateUuids, setCollapsedCateUuids] = useState<string[]>([]);
  const [visibleProductCountByCate, setVisibleProductCountByCate] = useState<
    Record<string, number>
  >({});
  const [railVisibleCounts, setRailVisibleCounts] = useState<
    Record<PublicMenuKind, number>
  >({
    [PUBLIC_MENU_KIND.PROMOTION]: RAIL_RENDER_CHUNK,
    [PUBLIC_MENU_KIND.SET]: RAIL_RENDER_CHUNK,
    [PUBLIC_MENU_KIND.NORMAL]: RAIL_RENDER_CHUNK,
  });
  const [lastCategoryOrderKey, setLastCategoryOrderKey] = useState<
    string | null
  >(null);
  const initialLoadKey = useRef("");
  const appliedActiveCategorySyncRequestRef = useRef(0);
  const latestCategoryScrollRequestRef = useRef(0);
  const renderSentinelRef = useRef<HTMLDivElement | null>(null);
  const {
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
  } = usePublicMenuBrowseModel({
    collapsedCateUuids,
    menuByKind,
    renderedCateUuids,
    visibleProductCountByCate,
  });
  const {
    activeCateUuid,
    activeValue,
    categoryBarRef,
    categoryRefs: categoryRefsRef,
    categoryTabRefs,
    handleScrollJump,
    handleScrollToTop,
    lastActiveCateUuidRef,
    scrollJumpEdge,
    scrollToCategory,
    setStableActiveCateUuid,
    suppressScrollActiveUntil: suppressScrollActiveUntilRef,
  } = usePublicCategoryScroll({
    defaultActiveCateUuid: firstLoadedCateUuid,
    hasScrollJumpPendingContent,
    menuCategoryByUuid,
    renderedCateUuids,
    setSelectedCateUuid,
    visibleCategoryTabs,
  });
  const { ensureNormalCategoryProducts, loadNormalCategoryProductsSafely } =
    usePublicMenuCategoryLoader({
      lang,
      loadNormalCategoryProducts,
      loadedCateUuids,
      loadingCateUuids,
      submittedSearch,
      t,
      toast,
      token,
    });

  const ensureCategoryRendered = useCallback(
    (cateUuid: string) => {
      const category = menuCategoryByUuid.get(cateUuid);
      if (!category) return false;

      setRenderedCateUuids((current) =>
        orderCateUuidsByMenu([...current, cateUuid], menuCategories),
      );

      const visibleCount = visibleProductCountForCategory(
        category,
        PRODUCT_RENDER_CHUNK,
      );

      if (visibleCount > 0) {
        setVisibleProductCountByCate((current) => ({
          ...current,
          [cateUuid]: Math.max(current[cateUuid] ?? 0, visibleCount),
        }));
      }

      return true;
    },
    [menuCategories, menuCategoryByUuid],
  );

  const renderCategoryPathTo = useCallback(
    (cateUuid: string) => {
      const pathCateUuids = getCategoryPathUuids({
        activeCateUuid: activeCateUuid || lastActiveCateUuidRef.current,
        targetCateUuid: cateUuid,
        renderedCateUuids,
        menuCategories,
      });
      if (!pathCateUuids.length) return false;

      setRenderedCateUuids((current) =>
        orderCateUuidsByMenu([...current, ...pathCateUuids], menuCategories),
      );

      setVisibleProductCountByCate((current) =>
        withCategoryPathVisibleCounts({
          current,
          pathCateUuids,
          categoryByUuid: menuCategoryByUuid,
          productRenderChunk: PRODUCT_RENDER_CHUNK,
        }),
      );

      return true;
    },
    [
      activeCateUuid,
      lastActiveCateUuidRef,
      menuCategories,
      menuCategoryByUuid,
      renderedCateUuids,
    ],
  );

  const revealNextMenuChunk = useCallback(() => {
    if (!menuCategories.length) return;

    const lastCateUuid = renderedCateUuids.at(-1);
    if (!lastCateUuid) {
      ensureCategoryRendered(menuCategories[0].cateUuid);
      ensureNormalCategoryProducts(menuCategories[0].cateUuid);
      return;
    }

    const lastCategory = menuCategoryByUuid.get(lastCateUuid);
    if (!loadedCateUuids.includes(lastCateUuid)) {
      ensureNormalCategoryProducts(lastCateUuid);
      return;
    }

    const visibleCount = visibleProductCountByCate[lastCateUuid] ?? 0;
    const totalProducts = lastCategory?.products?.length ?? 0;

    if (
      lastCategory &&
      !collapsedCateUuids.includes(lastCateUuid) &&
      visibleCount < totalProducts
    ) {
      setVisibleProductCountByCate((current) => ({
        ...current,
        [lastCateUuid]: Math.min(
          totalProducts,
          Math.max(current[lastCateUuid] ?? 0, visibleCount) +
            PRODUCT_RENDER_CHUNK,
        ),
      }));
      return;
    }

    const lastIndex = menuCategories.findIndex(
      (category) => category.cateUuid === lastCateUuid,
    );
    const nextCategory =
      lastIndex >= 0
        ? menuCategories
            .slice(lastIndex + 1)
            .find((category) => !renderedCateUuids.includes(category.cateUuid))
        : null;

    if (nextCategory) {
      ensureCategoryRendered(nextCategory.cateUuid);
      ensureNormalCategoryProducts(nextCategory.cateUuid);
    }
  }, [
    collapsedCateUuids,
    ensureCategoryRendered,
    ensureNormalCategoryProducts,
    loadedCateUuids,
    menuCategories,
    menuCategoryByUuid,
    renderedCateUuids,
    visibleProductCountByCate,
  ]);

  const revealMoreProductsForCategory = useCallback(
    (cateUuid: string) => {
      const category = menuCategoryByUuid.get(cateUuid);
      if (!category) return;

      const totalProducts = category.products?.length ?? 0;
      setVisibleProductCountByCate((current) => {
        const currentCount = current[cateUuid] ?? PRODUCT_RENDER_CHUNK;
        if (currentCount >= totalProducts) return current;

        return {
          ...current,
          [cateUuid]: Math.min(
            totalProducts,
            currentCount + PRODUCT_RENDER_CHUNK,
          ),
        };
      });
    },
    [menuCategoryByUuid],
  );

  const revealMoreRailProducts = useCallback(
    (statusKind: PublicMenuKind, totalProducts: number) => {
      setRailVisibleCounts((current) => {
        const currentCount = current[statusKind] ?? RAIL_RENDER_CHUNK;
        if (currentCount >= totalProducts) return current;

        return {
          ...current,
          [statusKind]: Math.min(
            totalProducts,
            currentCount + RAIL_RENDER_CHUNK,
          ),
        };
      });
    },
    [],
  );

  const toggleCategoryCollapsed = useCallback((cateUuid: string) => {
    setCollapsedCateUuids((current) =>
      current.includes(cateUuid)
        ? current.filter((uuid) => uuid !== cateUuid)
        : [...current, cateUuid],
    );
  }, []);

  const enqueueCategoryScroll = useCallback((cateUuid: string) => {
    setPendingCategoryScroll((current) => ({
      cateUuid,
      requestId: current.requestId + 1,
    }));
  }, []);

  const handleTabChange = useCallback(
    (cateUuid: string) => {
      if (
        !visibleCategoryTabs.some((category) => category.cateUuid === cateUuid)
      ) {
        return;
      }

      const targetLoaded = loadedCateUuids.includes(cateUuid);
      const targetLoading = loadingCateUuids.includes(cateUuid);

      renderCategoryPathTo(cateUuid);
      suppressScrollActiveUntilRef.current =
        Date.now() +
        (targetLoaded
          ? CATEGORY_SCROLL_SUPPRESS_MS
          : CATEGORY_LOAD_SCROLL_SUPPRESS_MS);

      setStableActiveCateUuid(cateUuid);

      if (targetLoaded) {
        setJumpingCateUuid("");
        enqueueCategoryScroll(cateUuid);
        return;
      }

      setJumpingCateUuid(cateUuid);

      if (!targetLoading) {
        void loadNormalCategoryProductsSafely(cateUuid).catch(() => {
          setJumpingCateUuid((current) =>
            current === cateUuid ? "" : current,
          );
        });
      }
    },
    [
      loadNormalCategoryProductsSafely,
      loadedCateUuids,
      loadingCateUuids,
      enqueueCategoryScroll,
      renderCategoryPathTo,
      setStableActiveCateUuid,
      suppressScrollActiveUntilRef,
      visibleCategoryTabs,
    ],
  );

  useEffect(() => {
    const key = `${token}:${lang}:${submittedSearch}:${searchRun}`;
    if (initialLoadKey.current === key) return;

    initialLoadKey.current = key;
    setStableActiveCateUuid("");

    void loadMenuProducts({ token, lang, search: submittedSearch }).catch(
      (error) => {
        setError(
          error instanceof Error ? error.message : t("pos.productLoadFailed"),
        );
      },
    );
  }, [
    lang,
    loadMenuProducts,
    searchRun,
    setError,
    setStableActiveCateUuid,
    submittedSearch,
    t,
    token,
  ]);

  useResetOnDeps([
    categoryOrderKey,
    defaultCateUuid,
    menuCategories,
    selectedCateUuid,
  ], () => {
    const reset = nextPublicMenuCategoryReset({
      categoryOrderKey,
      defaultCateUuid,
      menuCategories,
      previousCategoryOrderKey: lastCategoryOrderKey,
      productRenderChunk: PRODUCT_RENDER_CHUNK,
      selectedCateUuid,
    });
    if (!reset) return;

    setLastCategoryOrderKey(reset.categoryOrderKey);
    setRenderedCateUuids(reset.renderedCateUuids);
    setCollapsedCateUuids([]);
    setVisibleProductCountByCate(reset.visibleProductCountByCate);
    setPendingActiveCategorySync((current) => ({
      cateUuid: reset.activeCateUuid,
      requestId: current.requestId + 1,
    }));

    if (!reset.activeCateUuid) {
      setJumpingCateUuid("");
      setPendingCategoryScroll((current) => ({
        cateUuid: "",
        requestId: current.requestId + 1,
      }));
    }
  }, { runOnMount: true });

  useEffect(() => {
    if (pendingActiveCategorySync.cateUuid === null) return;

    const { cateUuid, requestId } = pendingActiveCategorySync;
    if (appliedActiveCategorySyncRequestRef.current === requestId) return;
    appliedActiveCategorySyncRequestRef.current = requestId;
    setStableActiveCateUuid(cateUuid);
  }, [pendingActiveCategorySync, setStableActiveCateUuid]);

  useEffect(() => {
    const liveCateUuids = menuCategories.map(
      (category) => category.cateUuid,
    );
    missingPublicMenuCategoryRefUuids(
      categoryRefsRef.current,
      liveCateUuids,
    ).forEach((cateUuid) => {
      delete categoryRefsRef.current[cateUuid];
    });
  }, [categoryOrderKey, categoryRefsRef, menuCategories]);

  useEffect(() => {
    const firstCateUuid =
      selectedCateUuid || defaultCateUuid || menuCategories[0]?.cateUuid || "";

    if (firstCateUuid) ensureNormalCategoryProducts(firstCateUuid);
  }, [
    defaultCateUuid,
    ensureNormalCategoryProducts,
    menuCategories,
    selectedCateUuid,
  ]);

  useResetOnChange(menuRequestKey, () => {
    setRailVisibleCounts({
      [PUBLIC_MENU_KIND.PROMOTION]: RAIL_RENDER_CHUNK,
      [PUBLIC_MENU_KIND.SET]: RAIL_RENDER_CHUNK,
      [PUBLIC_MENU_KIND.NORMAL]: RAIL_RENDER_CHUNK,
    });
    setJumpingCateUuid("");
    setCollapsedCateUuids([]);
    setPendingCategoryScroll((current) => ({
      cateUuid: "",
      requestId: current.requestId + 1,
    }));
  });

  useEffect(() => {
    const firstCateUuid =
      firstLoadedCateUuid ||
      defaultCateUuid ||
      visibleCategoryTabs[0]?.cateUuid ||
      "";

    if (firstCateUuid && !activeCateUuid) {
      setStableActiveCateUuid(firstCateUuid);
    }
  }, [
    activeCateUuid,
    defaultCateUuid,
    firstLoadedCateUuid,
    setStableActiveCateUuid,
    visibleCategoryTabs,
  ]);

  const loadedJumpCateUuid =
    jumpingCateUuid && loadedCateUuids.includes(jumpingCateUuid)
      ? jumpingCateUuid
      : "";

  useResetOnChange(loadedJumpCateUuid, () => {
    if (!loadedJumpCateUuid) return;

    setJumpingCateUuid("");
    setPendingCategoryScroll((current) => ({
      cateUuid: loadedJumpCateUuid,
      requestId: current.requestId + 1,
    }));
  });

  useEffect(() => {
    if (!pendingCategoryScroll.cateUuid) return;

    const { cateUuid, requestId } = pendingCategoryScroll;
    latestCategoryScrollRequestRef.current = requestId;
    const timeoutId = window.setTimeout(() => {
      if (latestCategoryScrollRequestRef.current !== requestId) return;
      setPendingCategoryScroll((current) =>
        current.requestId === requestId
          ? { cateUuid: "", requestId }
          : current,
      );
      scrollToCategory(cateUuid);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [pendingCategoryScroll, scrollToCategory]);

  useEffect(() => {
    const element = renderSentinelRef.current;
    if (!element || !hasMoreRenderedMenu) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          revealNextMenuChunk();
        }
      },
      { rootMargin: "420px 0px 520px 0px", threshold: 0 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [hasMoreRenderedMenu, revealNextMenuChunk]);

  return {
    activeValue,
    categoryBarRef,
    categoryRefs: categoryRefsRef,
    categoryTabRefs,
    collapsedCateUuids,
    handleScrollJump,
    handleScrollToTop,
    handleTabChange,
    hasAnyProducts,
    hasMoreRenderedMenu,
    hasPromotionImage,
    hasSetImage,
    jumpingCateUuid,
    menuCategories,
    normalMenu,
    promotionMenu,
    promotionProducts,
    railVisibleCounts,
    renderSentinelRef,
    renderedMenuSections,
    revealMoreProductsForCategory,
    revealMoreRailProducts,
    scrollJumpEdge,
    setMenu,
    setProducts,
    toggleCategoryCollapsed,
    visibleCategoryTabs,
    ensureNormalCategoryProducts,
  };
}
