"use client";

import { useEffect, useRef, useState } from "react";
import { BACKEND_NETWORK_STATE, type BackendNetworkState } from "@/lib/network-state";
import { useNetworkStore } from "@/stores/network-store";

type SettledTransport = "OFFLINE" | "ONLINE";

function settledTransport(state: BackendNetworkState): SettledTransport | null {
  if (state === BACKEND_NETWORK_STATE.ONLINE) return "ONLINE";
  if (state === BACKEND_NETWORK_STATE.OFFLINE) return "OFFLINE";
  return null;
}

/**
 * Decides whether a screen should refetch now that the transport verdict has
 * `next`. `mountState` is the network state when the screen mounted; `settled`
 * is the last ONLINE/OFFLINE value this hook acted on (null before the first).
 *
 * - Ongoing flip between ONLINE and OFFLINE -> always refetch.
 * - First verdict is OFFLINE and the screen mounted before it settled -> refetch:
 *   the mount-time load raced the verdict and likely hit a dead backend before
 *   offline routing took over.
 * - First verdict is ONLINE -> never refetch: the mount-time load already
 *   targeted the backend, so the happy path is not burdened with a second call.
 * - First verdict equals the mount state -> no refetch (mount load matched).
 */
export function shouldRefetchOnTransport(
  mountState: BackendNetworkState,
  settled: SettledTransport | null,
  next: BackendNetworkState,
): boolean {
  const nextSettled = settledTransport(next);
  if (nextSettled === null) return false;
  if (settled === null) {
    if (settledTransport(mountState) === nextSettled) return false;
    return nextSettled === "OFFLINE";
  }
  return settled !== nextSettled;
}

/**
 * Returns a counter that bumps once whenever the backend transport verdict
 * settles on a value the mounted screen has not loaded against yet — a real
 * ONLINE<->OFFLINE flip, or the first OFFLINE/ONLINE verdict after the screen
 * mounted mid-transition (CHECKING). Add it to a data-loading effect's deps so
 * the screen currently on display refetches exactly once: offline it repopulates
 * from the Local Agent, online it refreshes from the backend.
 *
 * Only the mounted screen reacts and only on a genuine edge, so the cost is one
 * request per transition regardless of how many offline-capable pages exist.
 */
export function useOfflineRefetchEpoch(): number {
  const state = useNetworkStore((snapshot) => snapshot.state);
  const [epoch, setEpoch] = useState(0);
  const mountStateRef = useRef<BackendNetworkState | null>(null);
  if (mountStateRef.current === null) mountStateRef.current = state;
  const settledRef = useRef<SettledTransport | null>(null);

  useEffect(() => {
    const nextSettled = settledTransport(state);
    if (nextSettled === null) return;
    if (
      shouldRefetchOnTransport(
        mountStateRef.current ?? state,
        settledRef.current,
        state,
      )
    ) {
      setEpoch((value) => value + 1);
    }
    settledRef.current = nextSettled;
  }, [state]);

  return epoch;
}
