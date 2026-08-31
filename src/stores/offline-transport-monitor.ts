"use client";

import axios from "axios";
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
import { useToastStore } from "@/stores/toast-store";

interface AndroidBackendScope {
  token: string;
  storeUuid: string;
  branchUuid: string;
}

interface AndroidBackendHealthResponse {
  status?: string;
  data?: {
    online?: boolean;
    store_uuid_fk?: string;
    branch_uuid_fk?: string;
  };
}

type AndroidBackendProbe = (scope: AndroidBackendScope) => Promise<boolean>;

interface AndroidOnlineRecoveryOptions {
  probeBackend?: AndroidBackendProbe;
  onlinePollMs?: number;
  recoveryPollMs?: number;
  failuresBeforeOffline?: number;
}

const RECONCILE_NOW_EVENT = "yummy-go:offline-reconcile-now";

export function requestImmediateReconcile() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(RECONCILE_NOW_EVENT));
}

export async function probeConnectivity(): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return false;
  if (typeof window === "undefined") return false;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 5000);
  try {
    const target = new URL("/app-version.json", window.location.origin);
    target.searchParams.set("connectivity", String(Date.now()));
    const response = await fetch(target, {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeout);
  }
}

function browserIsOffline() {
  return navigator.onLine === false;
}

export async function probeAndroidBackend(scope: AndroidBackendScope) {
  try {
    const baseURL = process.env.NEXT_PUBLIC_BASE_URL ??
      (typeof window !== "undefined" ? window.location?.origin : undefined);
    const response = await axios.get<AndroidBackendHealthResponse>(
      "/api/v1/sync/health",
      {
        baseURL,
        timeout: 5000,
        headers: {
          Authorization: `Bearer ${scope.token}`,
          "x-access-token": scope.token,
        },
      },
    );
    const health = response.data?.data;
    return response.data?.status === "success" &&
      health?.online === true &&
      String(health.store_uuid_fk || "") === scope.storeUuid &&
      String(health.branch_uuid_fk || "") === scope.branchUuid;
  } catch {
    return false;
  }
}

export function startAndroidOnlineRecoveryMonitor(
  options: AndroidOnlineRecoveryOptions = {},
) {
  const probeBackend = options.probeBackend ?? probeAndroidBackend;
  const onlinePollMs = Math.max(2000, options.onlinePollMs ?? 10000);
  const recoveryPollMs = Math.max(500, options.recoveryPollMs ?? 1500);
  const failuresBeforeOffline = Math.max(1, options.failuresBeforeOffline ?? 2);
  let active = true;
  let timer: number | null = null;
  let reconciling = false;
  let consecutiveFailures = 0;

  const schedule = (delayMs: number) => {
    if (!active) return;
    if (timer !== null) window.clearTimeout(timer);
    timer = window.setTimeout(() => void reconcile(), delayMs);
  };

  const reconcile = async () => {
    if (!active || reconciling) return;
    const auth = useAuthStore.getState();
    if (!auth.isLoggedIn || !auth.token || !auth.user) return;

    if (browserIsOffline()) {
      consecutiveFailures = failuresBeforeOffline;
      auth.setOfflineSession(true);
      schedule(recoveryPollMs);
      return;
    }

    const requestIdentity = {
      token: auth.token,
      loginUuid: auth.user.uuid,
    };
    const scope = {
      token: auth.token,
      storeUuid: auth.user.store_uuid || auth.user.store_uuid_fk || "",
      branchUuid: auth.user.branch_uuid || "",
    };
    reconciling = true;
    let backendOnline = false;
    try {
      backendOnline = await probeBackend(scope);
      if (!active) return;

      const current = useAuthStore.getState();
      if (
        !current.isLoggedIn ||
        current.token !== requestIdentity.token ||
        current.user?.uuid !== requestIdentity.loginUuid
      ) {
        return;
      }

      if (browserIsOffline()) {
        consecutiveFailures = failuresBeforeOffline;
        current.setOfflineSession(true);
        return;
      }

      if (backendOnline) {
        consecutiveFailures = 0;
        // Android has no Desktop Printer Agent. A normal JWT can therefore
        // resume online directly after the authenticated Backend probe succeeds.
        // A local.* token still needs its original Agent-backed restore flow.
        if (!current.token?.startsWith("local.")) current.setOfflineSession(false);
        return;
      }

      consecutiveFailures += 1;
      if (consecutiveFailures >= failuresBeforeOffline) {
        current.setOfflineSession(true);
      }
    } catch {
      consecutiveFailures += 1;
      if (consecutiveFailures >= failuresBeforeOffline) {
        useAuthStore.getState().setOfflineSession(true);
      }
    } finally {
      reconciling = false;
      schedule(backendOnline ? onlinePollMs : recoveryPollMs);
    }
  };

  const handleOffline = () => {
    consecutiveFailures = failuresBeforeOffline;
    useAuthStore.getState().setOfflineSession(true);
    schedule(0);
  };
  const handleOnline = () => schedule(0);
  window.addEventListener("offline", handleOffline);
  window.addEventListener("online", handleOnline);
  void reconcile();

  return () => {
    active = false;
    if (timer !== null) window.clearTimeout(timer);
    window.removeEventListener("offline", handleOffline);
    window.removeEventListener("online", handleOnline);
  };
}

export function startOfflineTransportMonitor() {
  let active = true;
  let timer: number | null = null;
  let reconciling = false;
  let agentConfigured = false;
  let agentUnavailableChecks = 0;
  let reportedBlockedCount = 0;

  const schedule = (delayMs: number) => {
    if (!active) return;
    if (timer !== null) window.clearTimeout(timer);
    timer = window.setTimeout(() => void reconcile(), delayMs);
  };

  const reconcile = async () => {
    if (!active || reconciling) return;
    const auth = useAuthStore.getState();
    if (!auth.isLoggedIn) return;
    const localScope = {
      storeUuid: auth.user?.store_uuid || auth.user?.store_uuid_fk || "",
      branchUuid: auth.user?.branch_uuid || "",
      actorLoginUuid: auth.user?.uuid || "",
    };
    const browserOffline = navigator.onLine === false;
    if (browserOffline) {
      auth.setOfflineSession(true);
    }

    reconciling = true;
    try {
      if (!agentConfigured) {
        if (!auth.token || !auth.user) return;
        agentConfigured = await configureLocalSync({
          token: auth.token,
          actorLoginUuid: auth.user.uuid,
          storeUuid: auth.user.store_uuid || auth.user.store_uuid_fk || "",
          branchUuid: auth.user.branch_uuid,
        });
        if (!agentConfigured) {
          const status = await getLocalSyncStatus({ force: true, timeoutMs: 750 });
          if (!status) {
            agentUnavailableChecks += 1;
            void persistBrowserAgentUnavailable(localScope, browserOffline).catch(() => undefined);
            if (!browserOffline && useAuthStore.getState().offlineSession) {
              const online = await probeConnectivity();
              const browserQueue = await reconcileBrowserSyncQueue(localScope).catch(() =>
                getBrowserLocalSyncStatus(localScope),
              );
              if (online && !browserLocalSyncHasRetryableWork(browserQueue)) {
                useAuthStore.getState().setOfflineSession(false);
              }
            }
            if (agentUnavailableChecks >= 2) {
              useToastStore.getState().show({
                id: "offline-agent-unavailable",
                title: i18n.t("offlineSync.agentUnavailableTitle"),
                description: i18n.t("offlineSync.agentUnavailableDescription"),
                tone: "error",
              });
            }
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
        void persistBrowserAgentUnavailable(localScope, browserOffline).catch(() => undefined);
        return;
      }
      agentUnavailableChecks = 0;
      const browserQueue = await reconcileBrowserSyncQueue(localScope).catch(() =>
        getBrowserLocalSyncStatus(localScope),
      );
      if (browserOffline) return;
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
      const hasConnectionFailure = Number(status.consecutive_failures || 0) > 0;
      if (status.connection_state === "OFFLINE" ||
        (status.connection_state === "DEGRADED" && hasConnectionFailure)) {
        useAuthStore.getState().setOfflineSession(true);
        return;
      }

      if (browserLocalSyncHasRetryableWork(browserQueue)) {
        useAuthStore.getState().setOfflineSession(true);
      }

      if (useAuthStore.getState().offlineSession) {
        if (status.connection_state === "SYNCING") return;
        const syncedStatus = await runLocalSyncNow();
        const reconciledBrowserQueue = await reconcileBrowserSyncQueue(localScope).catch(() => browserQueue);
        if (
          syncedStatus?.connection_state === "ONLINE" &&
          !localSyncHasRetryableWork(syncedStatus) &&
          !browserLocalSyncHasRetryableWork(reconciledBrowserQueue)
        ) {
          const current = useAuthStore.getState();
          if (current.token?.startsWith("local.")) {
            const restored = await restoreOnlineLogin(current.token);
            if (!useAuthStore.getState().resumeOnlineSession(restored.token, restored.user)) return;
          } else {
            current.setOfflineSession(false);
          }
        }
      }
    } catch {
      // Keep local transport active until both sync and Backend session restore succeed.
    } finally {
      reconciling = false;
      schedule(agentConfigured
        ? (useAuthStore.getState().offlineSession ? 1000 : 2000)
        : (agentUnavailableChecks < 2 ? 2000 : 15000));
    }
  };

  const handleOffline = () => {
    useAuthStore.getState().setOfflineSession(true);
    schedule(0);
  };
  const handleOnline = () => schedule(0);
  window.addEventListener("offline", handleOffline);
  window.addEventListener("online", handleOnline);
  window.addEventListener(RECONCILE_NOW_EVENT, handleOnline);
  void reconcile();

  return () => {
    active = false;
    if (timer !== null) window.clearTimeout(timer);
    window.removeEventListener("offline", handleOffline);
    window.removeEventListener("online", handleOnline);
    window.removeEventListener(RECONCILE_NOW_EVENT, handleOnline);
  };
}
