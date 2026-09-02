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

function navigatorHint() {
  return typeof navigator === "undefined" ? "unknown" : String(navigator.onLine);
}

function commit(
  snapshot: BackendNetworkSnapshot,
  classification: "CHECKING" | "HTTP_RESPONSE" | "NETWORK_TRANSPORT" | "NON_NETWORK",
) {
  const previous = useNetworkStore.getState();
  useNetworkStore.getState().replaceSnapshot(snapshot);
  console.info(
    `[NETWORK] ${previous.state}${previous.state === snapshot.state ? " remains " : " -> "}${snapshot.state}` +
      ` reason=${snapshot.lastReason}`,
    {
      navigatorOnline: navigatorHint(),
      httpStatus: snapshot.lastHttpStatus,
      classification,
      consecutiveFailures: snapshot.consecutiveFailures,
    },
  );
  return snapshot;
}

export const backendNetworkManager = {
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
    return commit(initialBackendNetworkSnapshot(reason), "CHECKING");
  },
  reportReachable(httpStatus: number | null, reason = "backend_http_response") {
    return commit(
      applyBackendReachable(this.getSnapshot(), { httpStatus, reason }),
      "HTTP_RESPONSE",
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
      "NETWORK_TRANSPORT",
    );
  },
  reportNonNetwork(reason = "non_network_application_error") {
    const current = this.getSnapshot();
    return commit({
      ...current,
      lastHttpStatus: null,
      lastReason: reason,
      lastCheckedAt: Date.now(),
    }, "NON_NETWORK");
  },
  isOffline() {
    return this.getSnapshot().state === BACKEND_NETWORK_STATE.OFFLINE;
  },
};
