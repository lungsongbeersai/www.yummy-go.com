import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));
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
const apiTransport = readFileSync(
  join(testDir, "..", "..", "lib", "api.ts"),
  "utf8"
);

describe("offline asset cache", () => {
  it("delegates Next Image caching to @serwist/next's defaultCache instead of a hand-rolled entry", () => {
    // @serwist/next's own /_next/image runtime-caching entry sets no matchOptions, so
    // caches.match() falls back to the Cache API default (ignoreSearch: false) and keys on
    // the full query string (?url=...&w=...) — different image sizes can't collide. A custom
    // /_next/image entry in sw.ts would risk reintroducing that collision.
    expect(serviceWorkerSource).toContain('from "@serwist/next/worker"');
    expect(serviceWorkerSource).toContain("...defaultCache");
    expect(serviceWorkerSource).not.toContain("_next/image");
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
    expect(offlineRuntime).toContain("startBackendNetworkMonitor()");
    expect(offlineRuntime).toContain("isCapacitorAndroidApp()");
    expect(offlineTransportMonitor).toContain('"/api/v1/sync/health"');
    expect(offlineTransportMonitor).toContain('window.addEventListener("offline", handleNetworkHint)');
    expect(offlineTransportMonitor).toContain('window.addEventListener("online", handleNetworkHint)');
    expect(offlineTransportMonitor).toContain("setOfflineSession(true)");
    expect(offlineTransportMonitor).toContain("runLocalSyncNow()");
    expect(offlineTransportMonitor).toContain("reconcileBrowserSyncQueue(localScope)");
    expect(offlineTransportMonitor).toContain("!localSyncHasRetryableWork(syncedStatus)");
    expect(offlineTransportMonitor).toContain("restoreOnlineLogin(current.token)");
    expect(offlineTransportMonitor).toContain("resumeOnlineSession(restored.token, restored.user)");
    expect(offlineTransportMonitor).toContain("offlineSync.blockedTitle");
    expect(offlineTransportMonitor).toContain("auth.setOfflineSession(false)");
    expect(offlineRuntime).toContain('\"/pos\"');
  });

  it("never routes the Capacitor Android app to the Desktop Printer Agent", () => {
    expect(apiTransport).toContain("const localAgentAvailable = !isCapacitorAndroidApp()");
    expect(apiTransport).toContain("localAgentAvailable &&");
    expect(apiTransport).toContain("else if (localAgentAvailable)");
  });
});
