"use client";

import {
  BACKEND_NETWORK_STATE,
  classifyBackendError,
  navigatorReportsOffline,
  type BackendErrorClassification,
  type BackendNetworkState,
} from "@/lib/network-state";
import {
  browserLocalSyncHasRetryableWork,
  configureLocalSync,
  getBrowserLocalSyncStatus,
  getLocalSyncStatus,
  localSyncHasRetryableWork,
  persistBrowserAgentUnavailable,
  reconcileBrowserSyncQueue,
  runLocalSyncNow,
} from "@/services/offline-sync";
import { restoreOnlineLogin } from "@/services/login";
import i18n from "@/lib/i18n";
import { useAuthStore } from "@/stores/auth-store";
import { backendNetworkManager, useNetworkStore } from "@/stores/network-store";
import { useToastStore } from "@/stores/toast-store";

export interface BackendProbeResult {
  reachable: boolean;
  httpStatus: number | null;
  classification: BackendErrorClassification;
  reason: string;
}

interface BackendNetworkMonitorOptions {
  probeBackend?: () => Promise<BackendProbeResult>;
  onlinePollMs?: number;
  checkingPollMs?: number;
  offlinePollMs?: number;
}

const RECONCILE_NOW_EVENT = "yummy-go:offline-reconcile-now";
const SYNC_WORKER_LOCK = "yummy-go:offline-sync-worker";

/**
 * Runs `task` only when this tab can take the sync-worker lock for `scopeKey`
 * right now. Every tab keeps its own timer, and whichever one wins a given tick
 * drains the queue while the rest return immediately — so one store/branch/login
 * scope has exactly one sync worker at a time without electing a leader that
 * could stall sync when its tab is closed or throttled in the background.
 * Failover is the next tick.
 *
 * The lock is named per scope, not per browser: `auth-store` persists to
 * sessionStorage when "remember me" is off, so two tabs can legitimately hold
 * different branch logins at once and each still needs its own worker.
 * Browsers without Web Locks keep the previous every-tab behaviour.
 *
 * Returns whether `task` actually ran.
 */
export async function withSyncWorkerLock(
  scopeKey: string,
  task: () => Promise<void>,
  locks: LockManager | undefined =
    typeof navigator === "undefined" ? undefined : navigator.locks,
): Promise<boolean> {
  if (typeof locks?.request !== "function") {
    await task();
    return true;
  }
  let ran = false;
  await locks.request(`${SYNC_WORKER_LOCK}:${scopeKey}`, { ifAvailable: true }, async (lock) => {
    if (!lock) return;
    ran = true;
    await task();
  });
  return ran;
}

export function offlineWorkerScopeKey(scope: {
  storeUuid: string;
  branchUuid: string;
  actorLoginUuid: string;
}) {
  return `${scope.storeUuid}:${scope.branchUuid}:${scope.actorLoginUuid}`;
}

export function requestImmediateReconcile() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(RECONCILE_NOW_EVENT));
}

function backendBaseUrl() {
  return process.env.NEXT_PUBLIC_BASE_URL ??
    (typeof window !== "undefined" ? window.location.origin : "");
}

export async function probeBackendReachability(
  timeoutMs = 4000,
): Promise<BackendProbeResult> {
  if (typeof window === "undefined") {
    return {
      reachable: false,
      httpStatus: null,
      classification: "NON_NETWORK",
      reason: "backend_probe_no_window",
    };
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  const auth = useAuthStore.getState();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (auth.token) {
    headers.Authorization = `Bearer ${auth.token}`;
    headers["x-access-token"] = auth.token;
  }

  try {
    const target = new URL("/api/v1/sync/health", backendBaseUrl());
    target.searchParams.set("network_probe", String(Date.now()));
    const response = await fetch(target, {
      cache: "no-store",
      credentials: "same-origin",
      headers,
      signal: controller.signal,
    });
    return {
      reachable: true,
      httpStatus: response.status,
      classification: "HTTP_RESPONSE",
      reason:
        response.ok
          ? "backend_health_success"
          : `http_${response.status}_backend_reachable`,
    };
  } catch (error) {
    const classification = classifyBackendError(error);
    return {
      reachable: false,
      httpStatus: null,
      classification: classification.classification,
      reason: classification.reason,
    };
  } finally {
    window.clearTimeout(timeout);
  }
}

function synchronizeAuthTransport(networkState: BackendNetworkState) {
  const auth = useAuthStore.getState();
  if (!auth.isLoggedIn || !auth.token) return;
  if (networkState === BACKEND_NETWORK_STATE.OFFLINE) {
    if (!auth.offlineSession) auth.setOfflineSession(true);
    return;
  }
  if (
    networkState === BACKEND_NETWORK_STATE.ONLINE &&
    !auth.token.startsWith("local.") &&
    auth.offlineSession
  ) {
    auth.setOfflineSession(false);
  }
}

function applyProbeResult(result: BackendProbeResult) {
  const snapshot = result.reachable
    ? backendNetworkManager.reportReachable(result.httpStatus, result.reason)
    : result.classification === "NETWORK_TRANSPORT"
      // This is the dedicated /sync/health probe — a confirmed connectivity
      // verdict, the only source allowed to move POS to OFFLINE. When the browser
      // itself also reports no network, a single failed probe is enough — skip
      // the 3-strike wait. A later HTTP response still restores ONLINE.
      ? backendNetworkManager.reportTransportFailure(result.reason, {
          confirmed: true,
          ...(navigatorReportsOffline() ? { failureThreshold: 1 } : {}),
        })
      : backendNetworkManager.reportNonNetwork(result.reason);
  synchronizeAuthTransport(snapshot.state);
  if (snapshot.state === BACKEND_NETWORK_STATE.ONLINE) requestImmediateReconcile();
  return snapshot;
}

export async function probeBackendNow() {
  return applyProbeResult(await probeBackendReachability());
}

export function startBackendNetworkMonitor(
  options: BackendNetworkMonitorOptions = {},
) {
  const probeBackend = options.probeBackend ?? probeBackendReachability;
  const onlinePollMs = Math.max(5000, options.onlinePollMs ?? 15000);
  const checkingPollMs = Math.max(500, options.checkingPollMs ?? 2000);
  const offlinePollMs = Math.max(1000, options.offlinePollMs ?? 5000);
  let active = true;
  let probing = false;
  let probeRequested = false;
  let timer: number | null = null;

  backendNetworkManager.resetChecking("app_start_backend_probe");

  const schedule = (delayMs: number) => {
    if (!active) return;
    if (timer !== null) window.clearTimeout(timer);
    timer = window.setTimeout(() => void probe(), delayMs);
  };

  const nextDelay = () => {
    const state = useNetworkStore.getState().state;
    if (state === BACKEND_NETWORK_STATE.OFFLINE) return offlinePollMs;
    if (state === BACKEND_NETWORK_STATE.CHECKING) return checkingPollMs;
    return onlinePollMs;
  };

  const probe = async () => {
    if (!active || probing) return;
    probing = true;
    try {
      const result = await probeBackend();
      if (active) applyProbeResult(result);
    } catch (error) {
      if (!active) return;
      const classification = classifyBackendError(error);
      applyProbeResult({
        reachable: false,
        httpStatus: null,
        classification: classification.classification,
        reason: classification.reason,
      });
    } finally {
      probing = false;
      const delay = probeRequested ? 0 : nextDelay();
      probeRequested = false;
      schedule(delay);
    }
  };

  // Browser/Electron events are hints. Both trigger a real Backend probe and
  // never mutate the network state directly.
  const handleNetworkHint = () => {
    if (probing) {
      probeRequested = true;
      return;
    }
    schedule(0);
  };
  window.addEventListener("offline", handleNetworkHint);
  window.addEventListener("online", handleNetworkHint);
  void probe();

  return () => {
    active = false;
    if (timer !== null) window.clearTimeout(timer);
    window.removeEventListener("offline", handleNetworkHint);
    window.removeEventListener("online", handleNetworkHint);
  };
}

export function startOfflineTransportMonitor() {
  let active = true;
  let timer: number | null = null;
  let reconciling = false;
  let agentConfigured = false;
  let agentUnavailableChecks = 0;
  let reportedBlockedCount = 0;
  let workerScopeKey = "";

  const schedule = (delayMs: number) => {
    if (!active) return;
    if (timer !== null) window.clearTimeout(timer);
    timer = window.setTimeout(() => void reconcile(), delayMs);
  };

  const reconcile = async () => {
    if (!active || reconciling) return;
    const auth = useAuthStore.getState();
    const { token, user } = auth;
    if (!auth.isLoggedIn || !token || !user) return;
    const localScope = {
      storeUuid: user.store_uuid || user.store_uuid_fk || "",
      branchUuid: user.branch_uuid || "",
      actorLoginUuid: user.uuid || "",
    };
    const networkState = useNetworkStore.getState().state;
    const scopeKey = offlineWorkerScopeKey(localScope);
    if (scopeKey !== workerScopeKey) {
      // Store/branch/login changed under this tab. Retire the previous scope's
      // worker state so it cannot keep configuring the Agent, counting blocked
      // events or draining a queue this tab has left. Nothing is deleted — the
      // previous scope's pending queue stays on disk for whoever returns to it.
      workerScopeKey = scopeKey;
      agentConfigured = false;
      agentUnavailableChecks = 0;
      reportedBlockedCount = 0;
    }

    reconciling = true;
    const drainQueue = async () => {
      if (!agentConfigured) {
        agentConfigured = await configureLocalSync({
          token,
          actorLoginUuid: user.uuid,
          storeUuid: localScope.storeUuid,
          branchUuid: localScope.branchUuid,
        });
        if (!agentConfigured) {
          const status = await getLocalSyncStatus({ force: true, timeoutMs: 750 });
          if (!status) {
            agentUnavailableChecks += 1;
            void persistBrowserAgentUnavailable(
              localScope,
              networkState === BACKEND_NETWORK_STATE.OFFLINE,
            ).catch(() => undefined);
          } else {
            agentUnavailableChecks = 0;
          }
          return;
        }
      }

      const status = await getLocalSyncStatus({ force: true, timeoutMs: 1000 });
      if (!status) {
        agentConfigured = false;
        agentUnavailableChecks += 1;
        void persistBrowserAgentUnavailable(
          localScope,
          networkState === BACKEND_NETWORK_STATE.OFFLINE,
        ).catch(() => undefined);
        return;
      }

      agentUnavailableChecks = 0;
      const browserQueue = await reconcileBrowserSyncQueue(localScope).catch(() =>
        getBrowserLocalSyncStatus(localScope),
      );
      const blockedCount = Number(status.pending?.blocked || 0);
      if (blockedCount > 0 && blockedCount !== reportedBlockedCount) {
        reportedBlockedCount = blockedCount;
        useToastStore.getState().show({
          title: i18n.t("offlineSync.blockedTitle"),
          description: i18n.t("offlineSync.blockedDescription", { count: blockedCount }),
          tone: "warning",
        });
      } else if (blockedCount === 0) {
        reportedBlockedCount = 0;
      }

      // Agent/printer status is an independent domain. It may delay sync or
      // printing, but only the Backend NetworkManager can put POS in Offline.
      if (networkState !== BACKEND_NETWORK_STATE.ONLINE) return;

      const shouldRunPendingSync =
        status.connection_state !== "ONLINE" ||
        localSyncHasRetryableWork(status) ||
        browserLocalSyncHasRetryableWork(browserQueue);
      if (!shouldRunPendingSync || status.connection_state === "SYNCING") return;

      const syncedStatus = await runLocalSyncNow();
      const reconciledBrowserQueue = await reconcileBrowserSyncQueue(localScope)
        .catch(() => browserQueue);
      if (
        syncedStatus?.connection_state === "ONLINE" &&
        !localSyncHasRetryableWork(syncedStatus) &&
        !browserLocalSyncHasRetryableWork(reconciledBrowserQueue)
      ) {
        const current = useAuthStore.getState();
        if (current.token?.startsWith("local.")) {
          const restored = await restoreOnlineLogin(current.token);
          useAuthStore.getState().resumeOnlineSession(restored.token, restored.user);
        }
      }
    };

    try {
      await withSyncWorkerLock(scopeKey, drainQueue);
    } catch {
      // Sync and printer failures remain in their own retry state. They do not
      // change Backend reachability or route a business mutation to SQLite.
    } finally {
      reconciling = false;
      schedule(
        agentConfigured
          ? (useNetworkStore.getState().state === BACKEND_NETWORK_STATE.ONLINE ? 2000 : 5000)
          : (agentUnavailableChecks < 2 ? 2000 : 15000),
      );
    }
  };

  const handleWake = () => schedule(0);
  window.addEventListener("offline", handleWake);
  window.addEventListener("online", handleWake);
  window.addEventListener(RECONCILE_NOW_EVENT, handleWake);
  void reconcile();

  return () => {
    active = false;
    if (timer !== null) window.clearTimeout(timer);
    window.removeEventListener("offline", handleWake);
    window.removeEventListener("online", handleWake);
    window.removeEventListener(RECONCILE_NOW_EVENT, handleWake);
  };
}
