"use client";

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

// ปุ่ม "เชื่อมต่อใหม่" ใน OfflineConnectivityDialog สั่ง reconcile ทันทีผ่าน event นี้ แทนที่จะรอ
// รอบ schedule() ถัดไป (1-15s) — คนละ component กับ monitor เอง จึงใช้ DOM event แทนการส่ง ref ตรงๆ
const RECONCILE_NOW_EVENT = "yummy-go:offline-reconcile-now";

export function requestImmediateReconcile() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(RECONCILE_NOW_EVENT));
}

// เช็คว่าเน็ตกลับมาจริงหรือยัง แยกจาก navigator.onLine เฉยๆ เพราะ onLine บอกแค่ NIC ต่อ ไม่ได้บอก
// ว่าถึงอินเทอร์เน็ตจริง — ต้องยิงไปที่ backend จริง (api.yummy-go.com, cross-origin เสมอ) ไม่ใช่
// origin ของ frontend เอง เพราะ frontend ที่กำลังเปิดหน้านี้อยู่มันเข้าถึงได้อยู่แล้วโดยนิยาม จะเช็ค
// ยังไงก็ผ่าน ไม่ได้พิสูจน์ว่า backend กลับมาจริง — ต้นเหตุที่ offlineSession ค้าง true ทั้งที่เน็ตปกติ
// mode: "no-cors" เพราะแค่ต้องรู้ว่า network ไปถึง ไม่ต้องอ่าน response (CORS บล็อกอ่านอยู่แล้ว)
export async function probeConnectivity(): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return false;
  if (typeof window === "undefined") return false;
  const target = process.env.NEXT_PUBLIC_BASE_URL || window.location.origin;
  try {
    await fetch(target, { cache: "no-store", mode: "no-cors" });
    return true;
  } catch {
    return false;
  }
}

// Android ไม่มี Local Printer Agent (127.0.0.1:7777) ให้ configureLocalSync/reconcileBrowserSyncQueue
// พึ่งพา (ดู offline-sync.ts) — เขียนข้อมูลตอนออฟไลน์จึง fail จริง ไม่ใช่แค่รอ sync ตัว monitor เต็ม
// ด้านล่างจึงใช้ไม่ได้ เหลือแค่ตรวจสถานะเน็ตเพื่อ gate หน้า/เมนู (อ่านอย่างเดียว) กับ popup แจ้งเตือน
export function startAndroidOfflineMonitor() {
  let active = true;

  const check = async () => {
    if (!active) return;
    if (!useAuthStore.getState().isLoggedIn) return;
    const online = await probeConnectivity();
    if (!active) return;
    useAuthStore.getState().setOfflineSession(!online);
  };

  const handleOffline = () => useAuthStore.getState().setOfflineSession(true);
  const handleOnline = () => void check();

  window.addEventListener("offline", handleOffline);
  window.addEventListener("online", handleOnline);
  window.addEventListener(RECONCILE_NOW_EVENT, handleOnline);
  void check();

  return () => {
    active = false;
    window.removeEventListener("offline", handleOffline);
    window.removeEventListener("online", handleOnline);
    window.removeEventListener(RECONCILE_NOW_EVENT, handleOnline);
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
            if (agentUnavailableChecks >= 2) {
              useToastStore.getState().show({
                id: "offline-agent-unavailable",
                title: i18n.t("offlineSync.agentUnavailableTitle"),
                description: i18n.t("offlineSync.agentUnavailableDescription"),
                tone: "error",
              });
            }
            // ไม่มี Local Printer Agent ไม่ได้แปลว่าเน็ตหลุด — เบราว์เซอร์ธรรมดาที่ไม่ได้รัน
            // Electron/Agent ไม่มีทางเข้าเงื่อนไข clear offlineSession ด้านล่างได้เลย (ต้อง
            // agentConfigured ก่อนเสมอ) ค่านี้เลยค้าง true ตลอดไปถ้าไม่เช็คแยกตรงนี้
            if (!browserOffline && useAuthStore.getState().offlineSession) {
              const online = await probeConnectivity();
              const queue = await reconcileBrowserSyncQueue(localScope).catch(() =>
                getBrowserLocalSyncStatus(localScope),
              );
              if (online && !browserLocalSyncHasRetryableWork(queue)) {
                useAuthStore.getState().setOfflineSession(false);
              }
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
