import axios from "axios";

export const BACKEND_NETWORK_STATE = {
  CHECKING: "CHECKING",
  ONLINE: "ONLINE",
  OFFLINE: "OFFLINE",
} as const;

export type BackendNetworkState =
  (typeof BACKEND_NETWORK_STATE)[keyof typeof BACKEND_NETWORK_STATE];

export interface BackendNetworkSnapshot {
  state: BackendNetworkState;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastHttpStatus: number | null;
  lastReason: string;
  lastCheckedAt: number | null;
}

export type BackendErrorClassification =
  | "HTTP_RESPONSE"
  | "NETWORK_TRANSPORT"
  | "NON_NETWORK";

// Consecutive confirmed transport failures before POS is declared OFFLINE. Kept
// here so the cold-start seed below and applyBackendTransportFailure agree.
export const BACKEND_OFFLINE_FAILURE_THRESHOLD = 3;

// `navigator.onLine === false` is a reliable *negative* on desktop browsers: it
// is never false while a working connection exists (only the `true` value is
// unreliable). It is still only a hint — every use pairs it with a real probe or
// lets the /sync/health probe correct it — so it must not be read as a transport
// authority on its own.
export function navigatorReportsOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

export interface BackendErrorResult {
  classification: BackendErrorClassification;
  httpStatus: number | null;
  reason: string;
}

export function shouldUseConfirmedOfflineFallback(
  error: BackendErrorResult,
  networkState: BackendNetworkState,
) {
  return error.classification === "NETWORK_TRANSPORT" &&
    networkState === BACKEND_NETWORK_STATE.OFFLINE;
}

export function initialBackendNetworkSnapshot(
  reason = "app_start",
): BackendNetworkSnapshot {
  // Cold start with the browser itself reporting no network: begin in OFFLINE so
  // the first login/read goes straight to the Local Agent instead of a doomed
  // backend round-trip. Seed the failure counter at the threshold so a following
  // confirmed probe failure keeps it pinned; a single HTTP response from the
  // /sync/health probe still flips it back to ONLINE, so a wrong hint self-heals
  // within one poll. `navigator.onLine === true` (the normal case) is unchanged.
  const offlineHint = navigatorReportsOffline();
  return {
    state: offlineHint
      ? BACKEND_NETWORK_STATE.OFFLINE
      : BACKEND_NETWORK_STATE.CHECKING,
    consecutiveFailures: offlineHint ? BACKEND_OFFLINE_FAILURE_THRESHOLD : 0,
    consecutiveSuccesses: 0,
    lastHttpStatus: null,
    lastReason: offlineHint ? `${reason}_navigator_offline` : reason,
    lastCheckedAt: null,
  };
}

export function applyBackendReachable(
  snapshot: BackendNetworkSnapshot,
  {
    httpStatus = null,
    reason = "backend_http_response",
    successThreshold = 1,
    now = Date.now(),
  }: {
    httpStatus?: number | null;
    reason?: string;
    successThreshold?: number;
    now?: number;
  } = {},
): BackendNetworkSnapshot {
  const successes = snapshot.consecutiveSuccesses + 1;
  return {
    state:
      successes >= Math.max(1, successThreshold)
        ? BACKEND_NETWORK_STATE.ONLINE
        : BACKEND_NETWORK_STATE.CHECKING,
    consecutiveFailures: 0,
    consecutiveSuccesses: successes,
    lastHttpStatus: httpStatus,
    lastReason: reason,
    lastCheckedAt: now,
  };
}

export function applyBackendTransportFailure(
  snapshot: BackendNetworkSnapshot,
  {
    reason = "backend_transport_failure",
    failureThreshold = BACKEND_OFFLINE_FAILURE_THRESHOLD,
    // A regular API request that failed is NOT a verdict on connectivity — one
    // slow/reset/aborted call happens on a healthy network. Only the dedicated
    // /sync/health probe (confirmed: true) is allowed to move POS to OFFLINE.
    confirmed = false,
    now = Date.now(),
  }: {
    reason?: string;
    failureThreshold?: number;
    confirmed?: boolean;
    now?: number;
  } = {},
): BackendNetworkSnapshot {
  if (!confirmed) {
    // Nudge a healthy state down to CHECKING so the probe verifies it now.
    // Never touch the failure/success counters or declare OFFLINE from here.
    return {
      ...snapshot,
      state:
        snapshot.state === BACKEND_NETWORK_STATE.ONLINE
          ? BACKEND_NETWORK_STATE.CHECKING
          : snapshot.state,
      lastReason: reason,
      lastCheckedAt: now,
    };
  }

  const failures = snapshot.consecutiveFailures + 1;
  return {
    ...snapshot,
    state:
      failures >= Math.max(1, failureThreshold)
        ? BACKEND_NETWORK_STATE.OFFLINE
        : BACKEND_NETWORK_STATE.CHECKING,
    consecutiveFailures: failures,
    consecutiveSuccesses: 0,
    lastHttpStatus: null,
    lastReason: reason,
    lastCheckedAt: now,
  };
}

function errorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return "";
  return String(error.code || "").toUpperCase();
}

export function classifyBackendError(error: unknown): BackendErrorResult {
  if (axios.isAxiosError(error)) {
    if (error.response) {
      return {
        classification: "HTTP_RESPONSE",
        httpStatus: Number(error.response.status || 0) || null,
        reason: `http_${Number(error.response.status || 0)}_backend_reachable`,
      };
    }
    const code = errorCode(error);
    if (["ECONNABORTED", "ETIMEDOUT"].includes(code)) {
      return {
        classification: "NETWORK_TRANSPORT",
        httpStatus: null,
        reason: "backend_timeout",
      };
    }
    if ([
      "ERR_NETWORK",
      "ECONNREFUSED",
      "ECONNRESET",
      "ENOTFOUND",
      "EAI_AGAIN",
      "EHOSTUNREACH",
      "ENETUNREACH",
    ].includes(code)) {
      return {
        classification: "NETWORK_TRANSPORT",
        httpStatus: null,
        reason: `backend_transport_${code.toLowerCase()}`,
      };
    }
    // Axios configuration/cancellation/application errors can also have no
    // response. Only a real request plus the browser's Network Error shape is
    // allowed to affect Backend reachability.
    if (error.request && /network error|failed to fetch|load failed/i.test(error.message)) {
      return {
        classification: "NETWORK_TRANSPORT",
        httpStatus: null,
        reason: "backend_fetch_network_error",
      };
    }
    return {
      classification: "NON_NETWORK",
      httpStatus: null,
      reason: code ? `non_network_${code.toLowerCase()}` : "non_network_axios_error",
    };
  }

  if (
    typeof DOMException !== "undefined" &&
    error instanceof DOMException &&
    ["AbortError", "TimeoutError"].includes(error.name)
  ) {
    return {
      classification: "NETWORK_TRANSPORT",
      httpStatus: null,
      reason: "backend_timeout",
    };
  }

  if (error instanceof TypeError && /fetch|network|failed/i.test(error.message)) {
    return {
      classification: "NETWORK_TRANSPORT",
      httpStatus: null,
      reason: "backend_fetch_network_error",
    };
  }

  return {
    classification: "NON_NETWORK",
    httpStatus: null,
    reason: "non_network_application_error",
  };
}
