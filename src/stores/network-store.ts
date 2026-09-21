"use client";

import { create } from "zustand";
import {
  applyBackendReachable,
  applyBackendTransportFailure,
  BACKEND_NETWORK_STATE,
  initialBackendNetworkSnapshot,
  type BackendNetworkSnapshot,
} from "@/lib/network-state";

interface BackendNetworkStore extends BackendNetworkSnapshot {
  replaceSnapshot: (snapshot: BackendNetworkSnapshot) => void;
}

export const useNetworkStore = create<BackendNetworkStore>()((set) => ({
  ...initialBackendNetworkSnapshot(),
  replaceSnapshot: (snapshot) => set(snapshot),
}));

// A counter, not a timestamp: an API response may arrive in the same millisecond
// as a failed health probe. That newer HTTP evidence must win in either case.
let reachabilityRevision = 0;

function commit(snapshot: BackendNetworkSnapshot) {
  useNetworkStore.getState().replaceSnapshot(snapshot);
  return snapshot;
}

export const backendNetworkManager = {
  getReachabilityRevision() {
    return reachabilityRevision;
  },
  getSnapshot() {
    const snapshot = useNetworkStore.getState();
    return {
      state: snapshot.state,
      consecutiveFailures: snapshot.consecutiveFailures,
      consecutiveSuccesses: snapshot.consecutiveSuccesses,
      lastHttpStatus: snapshot.lastHttpStatus,
      lastReason: snapshot.lastReason,
      lastCheckedAt: snapshot.lastCheckedAt,
    };
  },
  resetChecking(reason = "app_start") {
    reachabilityRevision += 1;
    return commit(initialBackendNetworkSnapshot(reason));
  },
  reportReachable(httpStatus: number | null, reason = "backend_http_response") {
    reachabilityRevision += 1;
    return commit(
      applyBackendReachable(this.getSnapshot(), { httpStatus, reason }),
    );
  },
  reportTransportFailure(
    reason = "backend_transport_failure",
    {
      confirmed = false,
      failureThreshold,
    }: { confirmed?: boolean; failureThreshold?: number } = {},
  ) {
    return commit(
      applyBackendTransportFailure(this.getSnapshot(), {
        reason,
        confirmed,
        ...(failureThreshold ? { failureThreshold } : {}),
      }),
    );
  },
  reportNonNetwork(reason = "non_network_application_error") {
    const current = this.getSnapshot();
    return commit({
      ...current,
      lastHttpStatus: null,
      lastReason: reason,
      lastCheckedAt: Date.now(),
    });
  },
  isOffline() {
    return this.getSnapshot().state === BACKEND_NETWORK_STATE.OFFLINE;
  },
};
