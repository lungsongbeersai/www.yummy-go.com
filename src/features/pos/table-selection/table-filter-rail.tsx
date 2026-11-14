"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { prefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

const INITIAL_POSITION = { overflow: false, left: false, right: false, thumbWidth: 100, thumbLeft: 0 };

interface TableFilterRailProps {
  children: ReactNode;
  selectedValue: string;
}

export function TableFilterRail({ children, selectedValue }: TableFilterRailProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(INITIAL_POSITION);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const maximum = Math.max(0, rail.scrollWidth - rail.clientWidth);
      const left = Math.min(maximum, Math.max(0, rail.scrollLeft));
      const thumbWidth = maximum > 2 ? Math.max(8, rail.clientWidth / rail.scrollWidth * 100) : 100;
      const next = {
        overflow: maximum > 2,
        left: left > 2,
        right: left < maximum - 2,
        thumbWidth,
        thumbLeft: maximum > 2 ? left / maximum * (100 - thumbWidth) : 0,
      };
      setPosition(current => current.overflow === next.overflow && current.left === next.left && current.right === next.right
        && current.thumbWidth === next.thumbWidth && current.thumbLeft === next.thumbLeft ? current : next);
    };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(measure); };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    observer?.observe(rail);
    if (rail.firstElementChild) observer?.observe(rail.firstElementChild);
    rail.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    schedule();
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      rail.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const rail = railRef.current;
      const selected = rail?.querySelector<HTMLElement>('[data-slot="toggle-group-item"][data-state="on"]');
      if (rail && selected) revealChip(rail, selected, prefersReducedMotion() ? "auto" : "smooth");
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedValue]);

  return (
    <div data-slot="table-filter-rail" data-scrollable={position.overflow} className="relative min-w-0" dir="ltr">
      <div
        ref={railRef}
        data-slot="table-filter-viewport"
        className="touch-pan-x overflow-x-auto overflow-y-hidden overscroll-x-contain px-3 py-1 scroll-px-3 [scrollbar-width:none] sm:px-1 sm:scroll-px-1 sm:[scrollbar-width:thin] [&::-webkit-scrollbar]:hidden sm:[&::-webkit-scrollbar]:block sm:[&::-webkit-scrollbar]:h-1.5 sm:[&::-webkit-scrollbar-thumb]:rounded-full sm:[&::-webkit-scrollbar-thumb]:bg-border sm:[&::-webkit-scrollbar-track]:bg-transparent"
        onFocusCapture={event => {
          const chip = event.target.closest<HTMLElement>('[data-slot="toggle-group-item"]');
          if (chip && railRef.current) revealChip(railRef.current, chip, "auto");
        }}
      >
        {children}
      </div>
      {/* Mobile scrollbars disappear at rest; these passive hints keep the next chips discoverable. */}
      {position.left ? <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-3 bg-linear-to-r from-card to-transparent dark:from-background" /> : null}
      {position.right ? <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-3 bg-linear-to-l from-card to-transparent dark:from-background" /> : null}
      <div aria-hidden="true" className="mx-3 h-0.5 sm:hidden">
        {position.overflow ? <div className="relative h-full rounded-full bg-border/45"><span className="absolute inset-y-0 rounded-full bg-muted-foreground/45" style={{ width: `${position.thumbWidth}%`, left: `${position.thumbLeft}%` }} /></div> : null}
      </div>
    </div>
  );
}

function revealChip(rail: HTMLElement, chip: HTMLElement, behavior: ScrollBehavior) {
  const viewport = rail.getBoundingClientRect();
  const item = chip.getBoundingClientRect();
  const inset = 4;
  // Scroll only this horizontal rail; scrollIntoView can move the fixed POS header too.
  const delta = item.left < viewport.left + inset ? item.left - viewport.left - inset
    : item.right > viewport.right - inset ? item.right - viewport.right + inset : 0;
  if (delta) rail.scrollBy({ left: delta, behavior });
}
