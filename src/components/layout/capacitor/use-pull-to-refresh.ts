"use client";

import { useEffect, useRef, useState } from "react";
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

export function usePullToRefresh(enabled: boolean) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const isNative = useIsCapacitorNativeApp();
  const startY = useRef<number | null>(null);
  const active = enabled && isNative;

  // handler ผูกกับ `active` เท่านั้น ไม่ผูกกับ pullDistance/refreshing — กัน effect รีรันกลางท่าทาง
  // ที่จะทำให้ touch listener หลุดระหว่างผู้ใช้กำลังลากนิ้วอยู่
  useEffect(() => {
    if (!active) return;

    function atTop() {
      return (document.scrollingElement?.scrollTop ?? 0) <= 0;
    }

    function onTouchStart(e: TouchEvent) {
      startY.current = canStartPull(e.target) ? e.touches[0].clientY : null;
    }

    function onTouchMove(e: TouchEvent) {
      if (startY.current === null) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta <= 0 || !atTop()) {
        startY.current = null;
        setPullDistance(0);
        return;
      }
      // กัน WebView bounce-scroll ของเดิมระหว่างดึง ให้ตัวชี้วัดคุมท่าทางแทน
      e.preventDefault();
      setPullDistance(Math.min(delta * RESISTANCE, PULL_MAX));
    }

    function onTouchEnd() {
      setPullDistance((current) => {
        if (startY.current !== null && current >= PULL_THRESHOLD) {
          setRefreshing(true);
          window.location.reload();
          return current;
        }
        return 0;
      });
      startY.current = null;
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [active]);

  return { pullDistance, refreshing, threshold: PULL_THRESHOLD };
}
