"use client";

import { useEffect, useRef, useState } from "react";
import { useIsCapacitorNativeApp } from "@/hooks/use-capacitor-native-app";

const PULL_THRESHOLD = 72;
const PULL_MAX = 120;
// หน่วงระยะดึงให้รู้สึกมีแรงต้าน เหมือน pull-to-refresh ของ TikTok/Facebook แทนที่จะขยับ 1:1 กับนิ้ว
const RESISTANCE = 0.5;

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
      startY.current = atTop() ? e.touches[0].clientY : null;
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
