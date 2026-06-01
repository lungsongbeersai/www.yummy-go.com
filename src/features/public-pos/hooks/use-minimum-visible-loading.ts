"use client";

import { useEffect, useRef, useState } from "react";

export function useMinimumVisibleLoading(active: boolean, minMs: number) {
  const [visible, setVisible] = useState(active);
  const startedAtRef = useRef(active ? Date.now() : 0);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    if (active) {
      startedAtRef.current = Date.now();
      setVisible(true);
      return;
    }

    const elapsed = Date.now() - startedAtRef.current;
    const remainingMs = Math.max(0, minMs - elapsed);

    if (remainingMs === 0) {
      setVisible(false);
      return;
    }

    hideTimerRef.current = setTimeout(() => {
      setVisible(false);
      hideTimerRef.current = null;
    }, remainingMs);

    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, [active, minMs]);

  return active || visible;
}
