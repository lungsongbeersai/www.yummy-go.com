import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));
// public/offline-sw.js เป็นไฟล์ที่ @serwist/next (next.config.ts) generate จาก sw.ts ตอน build —
// ไม่มีอยู่ก่อน build และเนื้อหาไม่คงที่ (hash ของ build) จึง assert ที่ source (sw.ts) แทนเสมอ
const serviceWorkerSource = readFileSync(
  join(testDir, "..", "..", "service-worker", "sw.ts"),
  "utf8"
);
const offlineRuntime = readFileSync(
  join(testDir, "offline-app-runtime.tsx"),
  "utf8"
);
const offlineTransportMonitor = readFileSync(
  join(testDir, "..", "..", "stores", "offline-transport-monitor.ts"),
  "utf8"
);
const offlineRoutes = readFileSync(
  join(testDir, "..", "..", "lib", "offline-routes.ts"),
  "utf8"
);
const nextConfig = readFileSync(join(testDir, "..", "..", "..", "next.config.ts"), "utf8");

describe("offline service worker (Serwist)", () => {
  it("never lets Serwist cache backend API calls or the version-check endpoint", () => {
    // offline-sync.ts (Dexie + Local Printer Agent) เป็นเจ้าของ cache/queue ของ backend อยู่แล้ว —
    // ถ้า Serwist cache ซ้ำอีกชั้นจะเกิด cache สองระบบแข่งกัน ข้อมูลไม่ตรงกัน
    expect(serviceWorkerSource).toContain('url.pathname.startsWith("/api/")');
    expect(serviceWorkerSource).toContain('url.pathname === "/app-version.json"');
    expect(serviceWorkerSource).toContain("new NetworkOnly()");
  });

  it("falls back to the cached /login document when a page was never visited offline", () => {
    expect(serviceWorkerSource).toContain("handlerDidError");
    expect(serviceWorkerSource).toContain('cache.match(LOGIN_PATH, { ignoreSearch: true })');
    expect(serviceWorkerSource).toContain("PAGES_CACHE_NAME.html");
  });

  it("warms /login at install and the sales-essential routes on WARM_OFFLINE_ROUTES", () => {
    expect(serviceWorkerSource).toContain('self.addEventListener("install"');
    expect(serviceWorkerSource).toContain('documentStrategy.handle({ event, request: LOGIN_PATH })');
    expect(serviceWorkerSource).toContain('event.data?.type !== "WARM_OFFLINE_ROUTES"');
  });

  it("delegates static asset, RSC, and image caching to @serwist/next's defaultCache", () => {
    expect(serviceWorkerSource).toContain('from "@serwist/next/worker"');
    expect(serviceWorkerSource).toContain("...defaultCache");
    expect(serviceWorkerSource).toContain("self.__SW_MANIFEST");
  });

  it("disables the classic InjectManifest build under Turbopack dev, keeps it for production", () => {
    expect(nextConfig).toContain('swSrc: "src/service-worker/sw.ts"');
    expect(nextConfig).toContain('swDest: "public/offline-sw.js"');
    expect(nextConfig).toContain("register: false");
    expect(nextConfig).toContain('disable: process.env.NODE_ENV !== "production"');
  });

  it("reloads an open customer tab when the corrected worker takes control", () => {
    expect(offlineRuntime).toContain(
      'navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange)'
    );
    expect(offlineRuntime).toContain("window.location.reload()");
    expect(offlineRuntime).toContain(
      'navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange)'
    );
  });

  it("switches transport on network events and flushes local work before resuming online", () => {
    expect(offlineRuntime).toContain("startOfflineTransportMonitor()");
    // Android ไม่มี Local Printer Agent ให้ monitor เต็มของ desktop พึ่งพา (ดู offline-routes.ts
    // comment) จึงแยกไปใช้ monitor เบาที่ยังตรวจ online/offline จริงได้แทนที่จะไม่ทำอะไรเลย
    expect(offlineRuntime).toContain("isAndroidNativeApp()");
    expect(offlineRuntime).toContain("startAndroidOfflineMonitor()");
    expect(offlineTransportMonitor).toContain('window.addEventListener("offline", handleOffline)');
    expect(offlineTransportMonitor).toContain('window.addEventListener("online", handleOnline)');
    expect(offlineTransportMonitor).toContain("setOfflineSession(true)");
    expect(offlineTransportMonitor).toContain("runLocalSyncNow()");
    expect(offlineTransportMonitor).toContain("reconcileBrowserSyncQueue(localScope)");
    expect(offlineTransportMonitor).toContain("!localSyncHasRetryableWork(syncedStatus)");
    expect(offlineTransportMonitor).toContain("restoreOnlineLogin(current.token)");
    expect(offlineTransportMonitor).toContain("resumeOnlineSession(restored.token, restored.user)");
    expect(offlineTransportMonitor).toContain("offlineSync.blockedTitle");
    expect(offlineTransportMonitor).toContain("offlineSync.agentUnavailableTitle");
    expect(offlineTransportMonitor).toContain("setOfflineSession(false)");
    // ปุ่ม "เชื่อมต่อใหม่" ใน OfflineConnectivityDialog สั่ง reconcile ด่วนผ่าน event นี้
    expect(offlineTransportMonitor).toContain("yummy-go:offline-reconcile-now");
    expect(offlineRoutes).toContain('"/pos"');
  });
});
