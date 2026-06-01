"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CateWithProducts } from "@/services/pos";
import type { PublicPosCategoryTab } from "@/stores/public-pos-store/helpers";
import {
  CATEGORY_ANCHOR_FALLBACK_Y,
  CATEGORY_BOTTOM_ACTIVE_THRESHOLD_PX,
  CATEGORY_SCROLL_ALIGNMENT_DELAY_MS,
  CATEGORY_SCROLL_ALIGNMENT_MAX_ATTEMPTS,
  CATEGORY_SCROLL_ALIGNMENT_TOLERANCE_PX,
  CATEGORY_SCROLL_INITIAL_VERIFY_DELAY_MS,
  CATEGORY_SCROLL_MAX_RETRIES,
  CATEGORY_SCROLL_RETRY_DELAY_MS,
  CATEGORY_SCROLL_SUPPRESS_MS,
  SCROLL_JUMP_EDGE_TOLERANCE_PX,
  SCROLL_JUMP_DURATION_MS,
  SCROLL_JUMP_MAX_ATTEMPTS,
  SCROLL_JUMP_SPY_SUPPRESS_MS,
  SCROLL_JUMP_STABLE_PASSES,
  SCROLL_JUMP_VERIFY_DELAY_MS,
} from "@/features/public-pos/constants";
import type { ScrollJumpEdge } from "@/features/public-pos/types";
import {
  easeOutCubic,
  getScrollJumpEdgeFromViewport,
  getWindowMaxScrollY,
  prefersReducedMotion,
} from "@/features/public-pos/utils";

export function usePublicCategoryScroll({
  defaultActiveCateUuid,
  hasScrollJumpPendingContent,
  menuCategoryByUuid,
  renderedCateUuids,
  setSelectedCateUuid,
  visibleCategoryTabs,
}: {
  defaultActiveCateUuid: string;
  hasScrollJumpPendingContent: boolean;
  menuCategoryByUuid: Map<string, CateWithProducts>;
  renderedCateUuids: string[];
  setSelectedCateUuid: (cateUuid: string) => void;
  visibleCategoryTabs: PublicPosCategoryTab[];
}) {
  const [activeCateUuid, setActiveCateUuid] = useState("");
  const [scrollJumpEdge, setScrollJumpEdge] =
    useState<ScrollJumpEdge>("bottom");
  const suppressScrollActiveUntil = useRef(0);
  const lastActiveCateUuidRef = useRef("");
  const categoryScrollRequestIdRef = useRef(0);
  const scrollJumpRequestIdRef = useRef(0);
  const scrollJumpFrameRef = useRef<number | null>(null);
  const scrollJumpSettleTimerRef = useRef<number | null>(null);
  const scrollJumpPendingContentRef = useRef(false);
  const scrollJumpEdgeRef = useRef<ScrollJumpEdge>("bottom");
  const scrollJumpEdgeFrameRef = useRef<number | null>(null);
  const scrollSpyFrameRef = useRef<number | null>(null);
  const categoryBarRef = useRef<HTMLDivElement | null>(null);
  const categoryRefs = useRef<Record<string, HTMLElement | null>>({});
  const categoryTabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const fallbackActiveValue =
    defaultActiveCateUuid || visibleCategoryTabs[0]?.cate_uuid || "";
  const activeValue = visibleCategoryTabs.some(
    (category) => category.cate_uuid === activeCateUuid,
  )
    ? activeCateUuid
    : visibleCategoryTabs.some(
          (category) => category.cate_uuid === fallbackActiveValue,
        )
      ? fallbackActiveValue
      : visibleCategoryTabs[0]?.cate_uuid || "";

  useEffect(() => {
    scrollJumpPendingContentRef.current = hasScrollJumpPendingContent;
  }, [hasScrollJumpPendingContent]);

  const setStableScrollJumpEdge = useCallback((edge: ScrollJumpEdge) => {
    if (scrollJumpEdgeRef.current === edge) return;

    scrollJumpEdgeRef.current = edge;
    setScrollJumpEdge(edge);
  }, []);

  const updateScrollJumpEdgeFromViewport = useCallback(() => {
    setStableScrollJumpEdge(getScrollJumpEdgeFromViewport());
  }, [setStableScrollJumpEdge]);

  useEffect(() => {
    updateScrollJumpEdgeFromViewport();
  }, [
    hasScrollJumpPendingContent,
    renderedCateUuids.length,
    updateScrollJumpEdgeFromViewport,
  ]);

  const scrollActiveCategoryTabIntoView = useCallback((cateUuid: string) => {
    if (!cateUuid) return;

    requestAnimationFrame(() => {
      categoryTabRefs.current[cateUuid]?.scrollIntoView({
        behavior: prefersReducedMotion() ? "auto" : "smooth",
        block: "nearest",
        inline: "center",
      });
    });
  }, []);

  const setStableActiveCateUuid = useCallback(
    (cateUuid: string, options?: { force?: boolean }) => {
      if (!cateUuid) {
        lastActiveCateUuidRef.current = "";
        setActiveCateUuid("");
        setSelectedCateUuid("");
        return;
      }

      if (!options?.force && lastActiveCateUuidRef.current === cateUuid) return;

      lastActiveCateUuidRef.current = cateUuid;
      setActiveCateUuid(cateUuid);
      setSelectedCateUuid(cateUuid);
      scrollActiveCategoryTabIntoView(cateUuid);
    },
    [scrollActiveCategoryTabIntoView, setSelectedCateUuid],
  );

  const getCategoryAnchorY = useCallback(() => {
    const barBottom = categoryBarRef.current?.getBoundingClientRect().bottom;

    if (
      typeof barBottom === "number" &&
      Number.isFinite(barBottom) &&
      barBottom > 0
    ) {
      return Math.min(window.innerHeight - 1, barBottom + 8);
    }

    return CATEGORY_ANCHOR_FALLBACK_Y;
  }, []);

  const scrollToCategory = useCallback(
    (cateUuid: string) => {
      const requestId = categoryScrollRequestIdRef.current + 1;
      categoryScrollRequestIdRef.current = requestId;
      suppressScrollActiveUntil.current = Math.max(
        suppressScrollActiveUntil.current,
        Date.now() + CATEGORY_SCROLL_SUPPRESS_MS,
      );
      let retryCount = 0;

      const finishScroll = () => {
        if (categoryScrollRequestIdRef.current !== requestId) return;

        suppressScrollActiveUntil.current = 0;
        setStableActiveCateUuid(cateUuid, { force: true });
      };

      const alignCategory = (attempt: number, behavior: ScrollBehavior) => {
        requestAnimationFrame(() => {
          if (categoryScrollRequestIdRef.current !== requestId) return;

          const element = categoryRefs.current[cateUuid];
          if (!element) {
            if (retryCount < CATEGORY_SCROLL_MAX_RETRIES) {
              retryCount += 1;
              window.setTimeout(
                () => alignCategory(attempt, behavior),
                CATEGORY_SCROLL_RETRY_DELAY_MS,
              );
            }
            return;
          }

          const maxScrollY = getWindowMaxScrollY();
          const targetTop =
            window.scrollY +
            element.getBoundingClientRect().top -
            getCategoryAnchorY();

          window.scrollTo({
            top: Math.min(Math.max(0, targetTop), maxScrollY),
            behavior,
          });

          window.setTimeout(
            () => {
              if (categoryScrollRequestIdRef.current !== requestId) return;

              const currentElement = categoryRefs.current[cateUuid];
              if (!currentElement) return;

              const distanceFromAnchor =
                currentElement.getBoundingClientRect().top -
                getCategoryAnchorY();
              const nearScrollBottom =
                getWindowMaxScrollY() - window.scrollY <=
                CATEGORY_BOTTOM_ACTIVE_THRESHOLD_PX;

              if (
                Math.abs(distanceFromAnchor) <=
                  CATEGORY_SCROLL_ALIGNMENT_TOLERANCE_PX ||
                (nearScrollBottom && distanceFromAnchor > 0) ||
                attempt >= CATEGORY_SCROLL_ALIGNMENT_MAX_ATTEMPTS
              ) {
                finishScroll();
                return;
              }

              alignCategory(attempt + 1, "auto");
            },
            behavior === "smooth"
              ? CATEGORY_SCROLL_INITIAL_VERIFY_DELAY_MS
              : CATEGORY_SCROLL_ALIGNMENT_DELAY_MS,
          );
        });
      };

      alignCategory(1, prefersReducedMotion() ? "auto" : "smooth");
    },
    [getCategoryAnchorY, setStableActiveCateUuid],
  );

  const cancelScrollJump = useCallback(() => {
    if (scrollJumpFrameRef.current !== null) {
      window.cancelAnimationFrame(scrollJumpFrameRef.current);
      scrollJumpFrameRef.current = null;
    }

    if (scrollJumpSettleTimerRef.current !== null) {
      window.clearTimeout(scrollJumpSettleTimerRef.current);
      scrollJumpSettleTimerRef.current = null;
    }
  }, []);

  const scrollWindowToEdge = useCallback(
    (edge: "top" | "bottom") => {
      cancelScrollJump();
      scrollJumpPendingContentRef.current = hasScrollJumpPendingContent;

      const scrollJumpRequestId = scrollJumpRequestIdRef.current + 1;
      scrollJumpRequestIdRef.current = scrollJumpRequestId;

      const categoryRequestId = categoryScrollRequestIdRef.current + 1;
      categoryScrollRequestIdRef.current = categoryRequestId;
      suppressScrollActiveUntil.current =
        Date.now() + SCROLL_JUMP_SPY_SUPPRESS_MS;

      let stablePasses = 0;
      let lastMaxScrollY = getWindowMaxScrollY();

      const isCurrentRequest = () =>
        scrollJumpRequestIdRef.current === scrollJumpRequestId &&
        categoryScrollRequestIdRef.current === categoryRequestId;

      const finishScroll = () => {
        if (!isCurrentRequest()) return;

        cancelScrollJump();
        suppressScrollActiveUntil.current = 0;

        const cateUuid =
          edge === "top"
            ? visibleCategoryTabs[0]?.cate_uuid || renderedCateUuids[0] || ""
            : visibleCategoryTabs.at(-1)?.cate_uuid ||
              renderedCateUuids.at(-1) ||
              "";
        if (cateUuid) setStableActiveCateUuid(cateUuid, { force: true });

        setStableScrollJumpEdge(edge === "top" ? "bottom" : "top");
      };

      const scrollToCurrentTarget = () => {
        const targetTop = edge === "top" ? 0 : getWindowMaxScrollY();
        window.scrollTo({ top: targetTop, behavior: "auto" });
        return targetTop;
      };

      const settleEdge = (attempt: number) => {
        if (!isCurrentRequest()) return;

        scrollToCurrentTarget();

        const currentMaxScrollY = getWindowMaxScrollY();
        const distanceFromEdge =
          edge === "top" ? window.scrollY : currentMaxScrollY - window.scrollY;
        const atEdge = distanceFromEdge <= SCROLL_JUMP_EDGE_TOLERANCE_PX;
        const maxScrollStable =
          Math.abs(currentMaxScrollY - lastMaxScrollY) <=
          SCROLL_JUMP_EDGE_TOLERANCE_PX;

        if (edge === "top" && atEdge) {
          finishScroll();
          return;
        }

        if (edge === "bottom") {
          stablePasses =
            atEdge && maxScrollStable && !scrollJumpPendingContentRef.current
              ? stablePasses + 1
              : 0;
          lastMaxScrollY = currentMaxScrollY;

          if (stablePasses >= SCROLL_JUMP_STABLE_PASSES) {
            finishScroll();
            return;
          }
        }

        if (attempt >= SCROLL_JUMP_MAX_ATTEMPTS) {
          scrollToCurrentTarget();
          finishScroll();
          return;
        }

        scrollJumpSettleTimerRef.current = window.setTimeout(
          () => settleEdge(attempt + 1),
          SCROLL_JUMP_VERIFY_DELAY_MS,
        );
      };

      if (prefersReducedMotion()) {
        scrollToCurrentTarget();
        settleEdge(1);
        return;
      }

      const startScrollY = window.scrollY;
      const startTime = performance.now();

      const animateScroll = (now: number) => {
        if (!isCurrentRequest()) return;

        const progress = Math.min(
          1,
          (now - startTime) / SCROLL_JUMP_DURATION_MS,
        );
        const targetTop = edge === "top" ? 0 : getWindowMaxScrollY();
        const easedProgress = easeOutCubic(progress);
        const nextTop =
          startScrollY + (targetTop - startScrollY) * easedProgress;

        window.scrollTo({
          top: Math.min(Math.max(0, nextTop), getWindowMaxScrollY()),
          behavior: "auto",
        });

        if (progress < 1) {
          scrollJumpFrameRef.current =
            window.requestAnimationFrame(animateScroll);
          return;
        }

        scrollJumpFrameRef.current = null;
        settleEdge(1);
      };

      scrollJumpFrameRef.current = window.requestAnimationFrame(animateScroll);
    },
    [
      cancelScrollJump,
      hasScrollJumpPendingContent,
      renderedCateUuids,
      setStableActiveCateUuid,
      setStableScrollJumpEdge,
      visibleCategoryTabs,
    ],
  );

  useEffect(() => () => cancelScrollJump(), [cancelScrollJump]);

  const handleScrollToTop = useCallback(() => {
    scrollWindowToEdge("top");
  }, [scrollWindowToEdge]);

  const handleScrollJump = useCallback(() => {
    scrollWindowToEdge(scrollJumpEdge);
  }, [scrollJumpEdge, scrollWindowToEdge]);

  const updateActiveCategoryFromViewport = useCallback(() => {
    if (!renderedCateUuids.length) return;

    const firstCategory = menuCategoryByUuid.get(renderedCateUuids[0]);
    const lastRenderedCateUuid = renderedCateUuids.at(-1) || "";

    if (
      lastRenderedCateUuid &&
      getWindowMaxScrollY() - window.scrollY <=
        CATEGORY_BOTTOM_ACTIVE_THRESHOLD_PX
    ) {
      setStableActiveCateUuid(lastRenderedCateUuid);
      return;
    }

    const anchorY = getCategoryAnchorY();
    const hysteresisPx = 12;
    const currentElement = categoryRefs.current[lastActiveCateUuidRef.current];
    const currentRect = currentElement?.getBoundingClientRect();

    if (
      currentRect &&
      currentRect.top <= anchorY + hysteresisPx &&
      currentRect.bottom > anchorY + hysteresisPx
    ) {
      return;
    }

    let anchorMatchedCateUuid = "";
    let passedAnchorCateUuid = "";
    let nearestVisibleCateUuid = "";
    let nearestVisibleDistance = Number.POSITIVE_INFINITY;

    renderedCateUuids.forEach((cateUuid) => {
      const element = categoryRefs.current[cateUuid];
      if (!element) return;

      const rect = element.getBoundingClientRect();
      if (rect.top <= anchorY && rect.bottom > anchorY) {
        anchorMatchedCateUuid = cateUuid;
      }
      if (rect.top <= anchorY) {
        passedAnchorCateUuid = cateUuid;
      }

      const visibleTop = Math.max(rect.top, anchorY);
      const visibleBottom = Math.min(rect.bottom, window.innerHeight);
      if (visibleBottom > visibleTop) {
        const distance = rect.top <= anchorY ? 0 : rect.top - anchorY;
        if (distance < nearestVisibleDistance) {
          nearestVisibleDistance = distance;
          nearestVisibleCateUuid = cateUuid;
        }
      }
    });

    const cateUuid =
      anchorMatchedCateUuid ||
      passedAnchorCateUuid ||
      nearestVisibleCateUuid ||
      firstCategory?.cate_uuid ||
      "";

    if (cateUuid) {
      setStableActiveCateUuid(cateUuid);
    }
  }, [
    getCategoryAnchorY,
    menuCategoryByUuid,
    renderedCateUuids,
    setStableActiveCateUuid,
  ]);

  useEffect(() => {
    if (!renderedCateUuids.length) return;

    const runScrollSpy = () => {
      scrollSpyFrameRef.current = null;
      if (Date.now() < suppressScrollActiveUntil.current) return;
      updateActiveCategoryFromViewport();
    };

    const scheduleScrollSpy = () => {
      if (scrollSpyFrameRef.current !== null) return;
      scrollSpyFrameRef.current = window.requestAnimationFrame(runScrollSpy);
    };

    const handleScroll = () => {
      if (Date.now() < suppressScrollActiveUntil.current) return;
      scheduleScrollSpy();
    };

    const handleViewportChange = () => {
      suppressScrollActiveUntil.current = 0;
      scheduleScrollSpy();
    };

    updateActiveCategoryFromViewport();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("orientationchange", handleViewportChange);

    return () => {
      if (scrollSpyFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollSpyFrameRef.current);
        scrollSpyFrameRef.current = null;
      }

      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("orientationchange", handleViewportChange);
    };
  }, [renderedCateUuids.length, updateActiveCategoryFromViewport]);

  useEffect(() => {
    const runScrollJumpEdgeUpdate = () => {
      scrollJumpEdgeFrameRef.current = null;
      updateScrollJumpEdgeFromViewport();
    };

    const scheduleScrollJumpEdgeUpdate = () => {
      if (scrollJumpEdgeFrameRef.current !== null) return;
      scrollJumpEdgeFrameRef.current = window.requestAnimationFrame(
        runScrollJumpEdgeUpdate,
      );
    };

    updateScrollJumpEdgeFromViewport();
    window.addEventListener("scroll", scheduleScrollJumpEdgeUpdate, {
      passive: true,
    });
    window.addEventListener("resize", scheduleScrollJumpEdgeUpdate);
    window.addEventListener("orientationchange", scheduleScrollJumpEdgeUpdate);

    return () => {
      if (scrollJumpEdgeFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollJumpEdgeFrameRef.current);
        scrollJumpEdgeFrameRef.current = null;
      }

      window.removeEventListener("scroll", scheduleScrollJumpEdgeUpdate);
      window.removeEventListener("resize", scheduleScrollJumpEdgeUpdate);
      window.removeEventListener(
        "orientationchange",
        scheduleScrollJumpEdgeUpdate,
      );
    };
  }, [updateScrollJumpEdgeFromViewport]);

  useEffect(() => {
    if (defaultActiveCateUuid && !activeCateUuid) {
      setStableActiveCateUuid(defaultActiveCateUuid);
    }
  }, [activeCateUuid, defaultActiveCateUuid, setStableActiveCateUuid]);

  return useMemo(
    () => ({
      activeCateUuid,
      activeValue,
      categoryBarRef,
      categoryRefs,
      categoryTabRefs,
      handleScrollJump,
      handleScrollToTop,
      lastActiveCateUuidRef,
      scrollJumpEdge,
      scrollToCategory,
      setStableActiveCateUuid,
      suppressScrollActiveUntil,
    }),
    [
      activeCateUuid,
      activeValue,
      handleScrollJump,
      handleScrollToTop,
      scrollJumpEdge,
      scrollToCategory,
      setStableActiveCateUuid,
    ],
  );
}
