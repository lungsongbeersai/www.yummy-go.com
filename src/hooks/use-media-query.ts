"use client";

import { useCallback, useSyncExternalStore } from "react";

// อ่านผล matchMedia แบบ reactive ผ่าน useSyncExternalStore
// (แพตเทิร์นเดียวกับ use-prefers-reduced-motion แต่รับ query ได้ทั่วไป)
// server snapshot คืน false เสมอเพราะฝั่ง server ไม่รู้ขนาดจอ
export function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mediaQuery = window.matchMedia(query);
      mediaQuery.addEventListener("change", onChange);
      return () => mediaQuery.removeEventListener("change", onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
