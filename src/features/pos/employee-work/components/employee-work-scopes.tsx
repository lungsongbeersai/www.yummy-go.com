"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { prefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import type { EmployeeWorkResponse, EmployeeWorkScope } from "@/services/pos";
import { EMPLOYEE_WORK_SCOPES } from "@/features/pos/employee-work/employee-work-format";
import { useEmployeeWorkSwipe } from "@/features/pos/employee-work/hooks/use-employee-work-swipe";

interface EmployeeWorkScopesProps {
  scope: EmployeeWorkScope;
  counts?: EmployeeWorkResponse["scope_summary"];
  toolbar: ReactNode;
  children: ReactNode;
  onChange: (scope: EmployeeWorkScope) => void;
}

export function EmployeeWorkScopes({ scope, counts, toolbar, children, onChange }: EmployeeWorkScopesProps) {
  const { t } = useTranslation();
  const railRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  const [direction, setDirection] = useState(1);
  const select = (next: EmployeeWorkScope) => {
    if (next === scope) return;
    setDirection(EMPLOYEE_WORK_SCOPES.indexOf(next) > EMPLOYEE_WORK_SCOPES.indexOf(scope) ? 1 : -1);
    onChange(next);
  };
  const swipe = useEmployeeWorkSwipe(scope, select);
  const measure = useCallback(() => {
    const active = listRef.current?.querySelector<HTMLElement>('[role="tab"][data-state="active"]');
    if (!active) return;
    const next = { left: active.offsetLeft, width: active.offsetWidth };
    setIndicator(current => current.left === next.left && current.width === next.width ? current : next);
  }, []);
  useEffect(() => {
    const rail = railRef.current, list = listRef.current;
    if (!rail || !list) return;
    let frame = 0;
    const schedule = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; measure(); }); };
    const observer = new ResizeObserver(schedule);
    observer.observe(rail); observer.observe(list);
    list.querySelectorAll('[role="tab"]').forEach(tab => observer.observe(tab));
    schedule();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [measure]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      measure();
      const rail = railRef.current;
      const active = listRef.current?.querySelector<HTMLElement>('[role="tab"][data-state="active"]');
      if (!rail || !active) return;
      const item = active.getBoundingClientRect(), viewport = rail.getBoundingClientRect();
      const delta = item.left < viewport.left + 4 ? item.left - viewport.left - 4 : item.right > viewport.right - 4 ? item.right - viewport.right + 4 : 0;
      if (delta) rail.scrollBy({ left: delta, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [measure, scope]);

  const labels = { current: "tabToday", carryover: "tabCarryover", undated: "tabUndated" } as const;
  return <Tabs value={scope} dir="ltr" className="min-h-0 flex-1 gap-0" onClickCapture={swipe.onClickCapture} onValueChange={value => {
    const next = EMPLOYEE_WORK_SCOPES.find(item => item === value);
    if (next) select(next);
  }}>
    <div className="shrink-0 px-3 pt-2 pb-3 sm:px-5">
      <div ref={railRef} data-slot="employee-work-tab-rail" className="overflow-x-auto overflow-y-hidden scroll-px-1 touch-pan-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <TabsList ref={listRef} aria-label={t("employeeWork.title")} className="relative isolate h-13 w-max min-w-full justify-start gap-1 rounded-lg bg-primary/5 p-1 ring-1 ring-inset ring-primary/10 group-data-horizontal/tabs:h-13">
          <span aria-hidden="true" className="pointer-events-none absolute inset-y-1 left-0 rounded-md border border-primary/20 bg-primary/10 shadow-xs transition-[transform,width] duration-200 ease-out motion-reduce:transition-none" style={{ width: indicator.width, transform: `translateX(${indicator.left}px)` }} />
          {EMPLOYEE_WORK_SCOPES.map(value => <TabsTrigger key={value} value={value} className="z-10 h-11 min-h-11 min-w-max flex-1 gap-2 px-3 text-xs whitespace-nowrap data-active:border-transparent data-active:bg-transparent data-active:text-primary-text dark:data-active:border-transparent dark:data-active:bg-transparent dark:data-active:text-primary-text sm:text-sm">
            {t(`employeeWork.${labels[value]}`)}<span className={cn("rounded-full px-1.5 text-xs tabular-nums", value === scope ? "bg-primary/15 text-primary-text" : "bg-muted/70 text-muted-foreground")}>{counts?.[value].order_count ?? "—"}</span>
          </TabsTrigger>)}
        </TabsList>
      </div>
    </div>
    {toolbar}
    <TabsContent key={scope} value={scope} data-employee-work-swipe="true" className="min-h-0 flex-1 touch-pan-y touch-pinch-zoom overflow-x-hidden overflow-y-auto overscroll-y-contain px-3 pt-3 pb-4 sm:px-5" {...swipe.handlers}>
      {/* Only the active scope is mounted: animations never retain another day's or employee's rows. */}
      <div className={cn("min-h-full transition-transform duration-150 ease-out motion-reduce:transition-none", swipe.dragging && "transition-none", "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-150", direction === 1 ? "motion-safe:slide-in-from-right-3" : "motion-safe:slide-in-from-left-3")} style={{ transform: `translateX(${swipe.offset}px)` }}>
        {children}
      </div>
    </TabsContent>
  </Tabs>;
}
