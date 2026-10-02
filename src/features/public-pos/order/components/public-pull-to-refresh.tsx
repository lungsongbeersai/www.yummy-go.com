"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";

const THRESHOLD = 64;

// Keep this gesture on the public menu; sheets and horizontal rails own their swipes.
export function PublicPullToRefresh({
  scrollRef,
  onRefresh,
}: {
  scrollRef?: RefObject<HTMLElement | null>;
  onRefresh?: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [distance, setDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const gesture = useRef<{ x: number; y: number; distance: number } | null>(
    null
  );
  const busy = useRef(false);
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.overscrollBehaviorY;
    if (!scrollRef) root.style.overscrollBehaviorY = "contain";
    let timer: ReturnType<typeof setTimeout> | undefined;
    let active = true;
    const cancel = () => {
      gesture.current = null;
      if (!busy.current) setDistance(0);
    };
    const start = (event: TouchEvent) => {
      cancel();
      if (
        scrollRef &&
        (!(event.target instanceof Node) ||
          !scrollRef.current?.contains(event.target))
      )
        return;
      if (
        busy.current ||
        event.touches.length !== 1 ||
        (scrollRef?.current?.scrollTop ??
          document.scrollingElement?.scrollTop ??
          0) > 0
      )
        return;
      if (event.target instanceof Element) {
        if (
          !scrollRef &&
          event.target.closest(
            '[role="dialog"], [role="alertdialog"], [data-vaul-drawer], button, input, textarea, select, a'
          )
        )
          return;
        for (
          let node: Element | null = event.target;
          node && node !== (scrollRef?.current ?? document.body);
          node = node.parentElement
        ) {
          const style = getComputedStyle(node);
          if (
            (node.scrollTop > 0 && /auto|scroll/.test(style.overflowY)) ||
            (node.scrollWidth > node.clientWidth &&
              /auto|scroll/.test(style.overflowX))
          )
            return;
        }
      }
      gesture.current = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY,
        distance: 0,
      };
    };
    const move = (event: TouchEvent) => {
      const current = gesture.current;
      if (!current) return;
      if (event.touches.length !== 1) {
        cancel();
        return;
      }
      const dy = event.touches[0].clientY - current.y;
      const dx = Math.abs(event.touches[0].clientX - current.x);
      if (
        dy < 0 ||
        dx > Math.max(12, dy) ||
        (scrollRef?.current?.scrollTop ??
          document.scrollingElement?.scrollTop ??
          0) > 0
      ) {
        cancel();
        return;
      }
      if (dy < 8) return;
      if (event.cancelable) event.preventDefault();
      current.distance = Math.min(92, dy * 0.48);
      setDistance(current.distance);
    };
    const end = () => {
      const current = gesture.current;
      gesture.current = null;
      if (!current || current.distance < THRESHOLD || busy.current) {
        if (!busy.current) setDistance(0);
        return;
      }
      busy.current = true;
      setRefreshing(true);
      setDistance(THRESHOLD);
      // Give the loading indicator a paint before starting the document reload.
      timer = setTimeout(() => {
        if (onRefresh) {
          void onRefresh()
            .catch(() => undefined)
            .finally(() => {
              if (!active) return;
              busy.current = false;
              setRefreshing(false);
              setDistance(0);
            });
        } else window.location.reload();
      }, 200);
    };
    window.addEventListener("touchstart", start, { passive: true });
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", end, { passive: true });
    window.addEventListener("touchcancel", cancel, { passive: true });
    return () => {
      active = false;
      gesture.current = null;
      busy.current = false;
      if (!scrollRef) root.style.overscrollBehaviorY = previous;
      clearTimeout(timer);
      window.removeEventListener("touchstart", start);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", end);
      window.removeEventListener("touchcancel", cancel);
    };
  }, [scrollRef, onRefresh]);
  if (!distance && !refreshing) return null;
  return (
    <div
      role="status"
      data-public-pull-refresh
      data-refreshing={refreshing}
      className={
        scrollRef
          ? "yg-shell pointer-events-none sticky top-0 z-10 flex flex-col items-center gap-1"
          : "yg-shell pointer-events-none fixed inset-x-0 top-20 z-45 flex flex-col items-center gap-1"
      }
      style={{ transform: `translateY(${distance * 0.2}px)` }}
    >
      <span className="flex size-11 items-center justify-center rounded-full border border-yg-line bg-yg-panel text-yg-accent shadow-sm">
        <RefreshCw
          className={refreshing ? "size-5 motion-safe:animate-spin" : "size-5"}
          style={
            refreshing
              ? undefined
              : { transform: `rotate(${(distance / THRESHOLD) * 180}deg)` }
          }
        />
      </span>
      <span className="rounded-md border border-yg-line bg-yg-panel px-2 py-1 text-xs text-yg-accent-strong">
        {t(
          refreshing
            ? "common.loading"
            : distance >= THRESHOLD
            ? "waiter.releaseRefresh"
            : "waiter.pullRefresh"
        )}
      </span>
    </div>
  );
}
