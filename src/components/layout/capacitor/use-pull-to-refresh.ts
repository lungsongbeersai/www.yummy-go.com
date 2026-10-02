"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { useIsCapacitorNativeApp } from "@/hooks/use-capacitor-native-app";

const PULL_THRESHOLD = 72;
const PULL_MAX = 120;
// หน่วงระยะดึงให้รู้สึกมีแรงต้าน เหมือน pull-to-refresh ของ TikTok/Facebook แทนที่จะขยับ 1:1 กับนิ้ว
const RESISTANCE = 0.5;

// A pull only starts when the finger lands where "scroll up" has nowhere left to go. Checking the
// page alone was wrong inside anything that scrolls on its own: in the More page's settings sheet
// the page sits at the top, so every downward swipe (= scroll the list back up) was taken for a
// pull, preventDefault()ed, and the list could not scroll back up (a long swipe even reloaded).
// Modals (dialogs, sheets) never pull: refreshing the page behind them is not what a swipe means.
function canStartPull(target: EventTarget | null) {
  if ((document.scrollingElement?.scrollTop ?? 0) > 0) return false;
  if (!(target instanceof Element)) return true;
  if (target.closest('[role="dialog"], [role="alertdialog"], [data-vaul-drawer]')) return false;

  for (let node: Element | null = target; node && node !== document.body; node = node.parentElement) {
    if (node.scrollTop > 0) {
      const overflowY = getComputedStyle(node).overflowY;
      if (overflowY === "auto" || overflowY === "scroll") return false;
    }
  }
  return true;
}

interface PullToRefreshOptions {
  scrollRef?: RefObject<HTMLDivElement | null>;
  onRefresh?: () => Promise<unknown>;
  nativeOnly?: boolean;
}

export function usePullToRefresh(enabled: boolean, {
  scrollRef,
  onRefresh,
  nativeOnly = true,
}: PullToRefreshOptions = {}) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const isNative = useIsCapacitorNativeApp();
  const refreshActionRef = useRef(onRefresh);
  const refreshingRef = useRef(false);
  const active = enabled && (!nativeOnly || isNative);
  useEffect(() => {
    refreshActionRef.current = onRefresh;
  }, [onRefresh]);

  // handler ผูกกับ `active` เท่านั้น ไม่ผูกกับ pullDistance/refreshing — กัน effect รีรันกลางท่าทาง
  // ที่จะทำให้ touch listener หลุดระหว่างผู้ใช้กำลังลากนิ้วอยู่
  useEffect(() => {
    if (!active) return;
    const eventTarget = scrollRef?.current ?? window;
    let start: { x: number; y: number } | null = null;
    let distance = 0;

    function atTop() {
      return (scrollRef?.current?.scrollTop ?? document.scrollingElement?.scrollTop ?? 0) <= 0;
    }

    function cancelPull() {
      start = null;
      distance = 0;
      setPullDistance(0);
    }

    function onTouchStart(e: TouchEvent) {
      if (refreshingRef.current) return;
      cancelPull();
      if (e.touches.length !== 1 || !atTop() || !canStartPull(e.target)) return;
      start = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }

    function onTouchMove(e: TouchEvent) {
      if (!start) return;
      if (e.touches.length !== 1) {
        cancelPull();
        return;
      }
      const delta = e.touches[0].clientY - start.y;
      const horizontalDelta = Math.abs(e.touches[0].clientX - start.x);
      if (horizontalDelta > Math.max(8, Math.abs(delta)) || delta < -8 || !atTop()) {
        cancelPull();
        return;
      }
      if (delta <= 8) {
        distance = 0;
        setPullDistance(0);
        return;
      }
      // กัน WebView bounce-scroll ของเดิมระหว่างดึง ให้ตัวชี้วัดคุมท่าทางแทน
      if (e.cancelable) e.preventDefault();
      distance = Math.min(delta * RESISTANCE, PULL_MAX);
      setPullDistance(distance);
    }

    function onTouchEnd() {
      const shouldRefresh = start !== null && distance >= PULL_THRESHOLD && atTop();
      start = null;
      if (!shouldRefresh || refreshingRef.current) {
        cancelPull();
        return;
      }
      refreshingRef.current = true;
      setRefreshing(true);
      const refresh = refreshActionRef.current;
      if (!refresh) {
        window.location.reload();
        return;
      }
      void (async () => {
        try {
          await refresh();
        } finally {
          refreshingRef.current = false;
          setRefreshing(false);
          cancelPull();
        }
      })();
    }

    eventTarget.addEventListener("touchstart", onTouchStart as EventListener, { passive: true });
    eventTarget.addEventListener("touchmove", onTouchMove as EventListener, { passive: false });
    eventTarget.addEventListener("touchend", onTouchEnd, { passive: true });
    eventTarget.addEventListener("touchcancel", cancelPull, { passive: true });
    return () => {
      eventTarget.removeEventListener("touchstart", onTouchStart as EventListener);
      eventTarget.removeEventListener("touchmove", onTouchMove as EventListener);
      eventTarget.removeEventListener("touchend", onTouchEnd);
      eventTarget.removeEventListener("touchcancel", cancelPull);
    };
  }, [active, scrollRef]);

  return { pullDistance, refreshing, threshold: PULL_THRESHOLD };
}
