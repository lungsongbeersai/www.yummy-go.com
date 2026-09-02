"use client";

import { useEffect, useRef, useState } from "react";
import { BACKEND_NETWORK_STATE } from "@/lib/network-state";
import { useNetworkStore } from "@/stores/network-store";

/**
 * Returns a counter that bumps once each time the backend transport verdict
 * *settles* on the opposite side of the ONLINE/OFFLINE divide. CHECKING is
 * ignored, so ONLINE↔CHECKING flapping never triggers a bump — only a real
 * ONLINE→OFFLINE (or back) transition does.
 *
 * Add it to a screen's data-loading effect deps so the screen currently on
 * display refetches exactly once when the network drops or returns: offline it
 * repopulates from the Local Agent, online it refreshes from the backend. Only
 * the mounted screen reacts and only on a genuine edge, so the cost is one
 * request per transition regardless of how many offline-capable pages exist.
 *
 * The initial settle is adopted silently (returns 0) because the mount-time load
 * already covers it.
 */
export function useOfflineRefetchEpoch(): number {
  const state = useNetworkStore((snapshot) => snapshot.state);
  const [epoch, setEpoch] = useState(0);
  const settledRef = useRef<"OFFLINE" | "ONLINE" | null>(null);

  useEffect(() => {
    if (
      state !== BACKEND_NETWORK_STATE.ONLINE &&
      state !== BACKEND_NETWORK_STATE.OFFLINE
    ) {
      return;
    }
    if (settledRef.current === null) {
      settledRef.current = state;
      return;
    }
    if (settledRef.current !== state) {
      settledRef.current = state;
      setEpoch((value) => value + 1);
    }
  }, [state]);

  return epoch;
}
