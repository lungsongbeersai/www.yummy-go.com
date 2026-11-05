"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { prefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

function scrollPaddingLeft(rail: HTMLDivElement) {
  const value = window.getComputedStyle(rail).scrollPaddingLeft;
  const amount = Number.parseFloat(value) || 0;
  return value.endsWith("%") ? rail.clientWidth * amount / 100 : amount;
}

export function useTrialCarousel(itemCount: number, ready: boolean) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const measure = useCallback(() => {
    const rail = scrollRef.current;
    const slides = rail?.querySelectorAll<HTMLElement>("[data-trial-slide]");
    if (!ready || itemCount < 1 || !rail || !slides?.length) {
      setActiveIndex(0);
      return;
    }

    const lastIndex = Math.min(slides.length, itemCount) - 1;
    const maxScroll = Math.max(0, rail.scrollWidth - rail.clientWidth);
    if (maxScroll < 1) {
      // The desktop sidebar stacks cards at the same horizontal position.
      setActiveIndex(0);
      return;
    }
    if (rail.scrollLeft >= maxScroll - 1) {
      // A final card narrower than the rail cannot align fully to its left edge.
      setActiveIndex(lastIndex);
      return;
    }

    const alignment = rail.getBoundingClientRect().left + scrollPaddingLeft(rail);
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index <= lastIndex; index += 1) {
      const distance = Math.abs(slides[index].getBoundingClientRect().left - alignment);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    }
    setActiveIndex(nearestIndex);
  }, [itemCount, ready]);

  useEffect(() => {
    const rail = scrollRef.current;
    let timer: number | null = null;
    let frame: number | null = null;
    const scheduleMeasure = () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        frame = null;
        measure();
      });
    };
    const onScroll = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = null;
        scheduleMeasure();
      }, 100);
    };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(scheduleMeasure);
    if (rail) {
      observer?.observe(rail);
      if (rail.firstElementChild) observer?.observe(rail.firstElementChild);
      rail.querySelectorAll<HTMLElement>("[data-trial-slide]").forEach((slide) => observer?.observe(slide));
      rail.addEventListener("scroll", onScroll, { passive: true });
      rail.addEventListener("scrollend", scheduleMeasure);
    }
    window.addEventListener("resize", scheduleMeasure);
    scheduleMeasure();

    return () => {
      if (timer !== null) window.clearTimeout(timer);
      if (frame !== null) window.cancelAnimationFrame(frame);
      observer?.disconnect();
      rail?.removeEventListener("scroll", onScroll);
      rail?.removeEventListener("scrollend", scheduleMeasure);
      window.removeEventListener("resize", scheduleMeasure);
    };
  }, [measure]);

  const goToSlide = useCallback((index: number) => {
    const rail = scrollRef.current;
    if (!ready || itemCount < 1 || !rail || !Number.isFinite(index)) return;
    const slides = rail.querySelectorAll<HTMLElement>("[data-trial-slide]");
    if (!slides.length) return;
    const nextIndex = Math.max(0, Math.min(Math.min(slides.length, itemCount) - 1, Math.trunc(index)));
    const maxScroll = Math.max(0, rail.scrollWidth - rail.clientWidth);
    const left = rail.scrollLeft + slides[nextIndex].getBoundingClientRect().left
      - rail.getBoundingClientRect().left - scrollPaddingLeft(rail);
    rail.scrollTo({
      left: Math.max(0, Math.min(maxScroll, left)),
      behavior: prefersReducedMotion() ? "instant" : "smooth",
    });
    setActiveIndex(maxScroll < 1 ? 0 : nextIndex);
  }, [itemCount, ready]);

  const onKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    const rail = scrollRef.current;
    if (!rail || event.target !== rail || !ready || itemCount < 1
      || rail.scrollWidth - rail.clientWidth <= 1
      || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    let index: number;
    switch (event.key) {
      case "ArrowLeft": index = activeIndex - 1; break;
      case "ArrowRight": index = activeIndex + 1; break;
      case "Home": index = 0; break;
      case "End": index = itemCount - 1; break;
      default: return;
    }
    event.preventDefault();
    goToSlide(index);
  }, [activeIndex, goToSlide, itemCount, ready]);

  return {
    scrollRef,
    activeIndex: ready && itemCount > 0 ? Math.min(activeIndex, itemCount - 1) : 0,
    goToSlide,
    onKeyDown,
  };
}
