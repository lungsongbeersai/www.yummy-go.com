"use client";

import type { RefObject } from "react";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { prefersReducedMotion } from "../utils";

interface HorizontalScrollState {
  hasOverflow: boolean;
  canScrollLeft: boolean;
  canScrollRight: boolean;
}

const INITIAL_SCROLL_STATE: HorizontalScrollState = {
  hasOverflow: false,
  canScrollLeft: false,
  canScrollRight: false,
};

export function HorizontalScrollArrows({
  scrollRef,
  className,
}: {
  scrollRef: RefObject<HTMLDivElement | null>;
  className?: string;
}) {
  const { t } = useTranslation();
  const [scrollState, setScrollState] =
    useState<HorizontalScrollState>(INITIAL_SCROLL_STATE);

  useEffect(() => {
    const rail = scrollRef.current;
    if (!rail) return;

    let frameId = 0;
    const updateScrollState = () => {
      frameId = 0;
      const maxScrollLeft = Math.max(0, rail.scrollWidth - rail.clientWidth);
      const nextState = {
        hasOverflow: maxScrollLeft > 2,
        canScrollLeft: rail.scrollLeft > 2,
        canScrollRight: rail.scrollLeft < maxScrollLeft - 2,
      };

      setScrollState((current) =>
        current.hasOverflow === nextState.hasOverflow &&
        current.canScrollLeft === nextState.canScrollLeft &&
        current.canScrollRight === nextState.canScrollRight
          ? current
          : nextState,
      );
    };
    const scheduleUpdate = () => {
      if (frameId) return;
      frameId = window.requestAnimationFrame(updateScrollState);
    };

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(scheduleUpdate);
    resizeObserver?.observe(rail);
    if (rail.firstElementChild)
      resizeObserver?.observe(rail.firstElementChild);
    rail.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    scheduleUpdate();

    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
      rail.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [scrollRef]);

  if (!scrollState.hasOverflow) return null;

  const scroll = (direction: -1 | 1) => {
    const rail = scrollRef.current;
    if (!rail) return;

    rail.scrollBy({
      left: direction * Math.max(180, Math.round(rail.clientWidth * 0.75)),
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  };
  const buttonClassName = cn(
    "absolute top-1/2 z-10 size-11 -translate-y-1/2 rounded-full border border-primary/20 bg-background/95 text-primary shadow-lg shadow-emerald-950/10 backdrop-blur-sm transition-[color,background-color,opacity] hover:bg-primary hover:text-primary-foreground disabled:opacity-0 motion-reduce:transition-none",
    className,
  );

  return (
    <>
      <Button
        type="button"
        size="icon"
        variant="outline"
        className={cn(buttonClassName, "left-1")}
        aria-label={t("pos.scrollLeft")}
        disabled={!scrollState.canScrollLeft}
        onClick={() => scroll(-1)}
      >
        <ChevronLeft aria-hidden="true" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="outline"
        className={cn(buttonClassName, "right-1")}
        aria-label={t("pos.scrollRight")}
        disabled={!scrollState.canScrollRight}
        onClick={() => scroll(1)}
      >
        <ChevronRight aria-hidden="true" />
      </Button>
    </>
  );
}
