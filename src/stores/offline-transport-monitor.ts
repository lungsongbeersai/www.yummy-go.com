"use client";

import {
  configureLocalSync,
  getLocalSyncStatus,
  localSyncHasRetryableWork,
  runLocalSyncNow,
} from "@/services/offline-sync";
import { restoreOnlineLogin } from "@/services/login";
import i18n from "@/lib/i18n";
import { useAuthStore } from "@/stores/auth-store";
import { useToastStore } from "@/stores/toast-store";

export function startOfflineTransportMonitor() {
  let active = true;
  let timer: number | null = null;
  let reconciling = false;
  let agentConfigured = false;
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
    if (navigator.onLine === false) {
      auth.setOfflineSession(true);
      schedule(1000);
      return;
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
        if (!agentConfigured) return;
      }

      const status = await getLocalSyncStatus({ force: true, timeoutMs: 1000 });
      if (!status) return;
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

      if (useAuthStore.getState().offlineSession) {
        if (status.connection_state === "SYNCING") return;
        const syncedStatus = await runLocalSyncNow();
        if (
          syncedStatus?.connection_state === "ONLINE" &&
          !localSyncHasRetryableWork(syncedStatus)
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
        : 15000);
    }
  };

  const handleOffline = () => {
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
