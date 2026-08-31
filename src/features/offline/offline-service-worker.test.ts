import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));
const serviceWorker = readFileSync(
  join(testDir, "..", "..", "..", "public", "offline-sw.js"),
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
  it("keeps the complete Next Image query in the cache identity", () => {
    expect(serviceWorker).toContain("assets-v2");
    expect(serviceWorker).toContain(
      "cache.match(request, { ignoreSearch: false })"
    );
    expect(serviceWorker).not.toContain(
      "cache.match(request, { ignoreSearch: true })"
    );
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
    expect(offlineRuntime).toContain("startAndroidOnlineRecoveryMonitor()");
    expect(offlineRuntime).toContain("isCapacitorAndroidApp()");
    expect(offlineTransportMonitor).toContain('"/api/v1/sync/health"');
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
    expect(offlineRuntime).toContain('\"/pos\"');
  });

  it("never routes the Capacitor Android app to the Desktop Printer Agent", () => {
    expect(apiTransport).toContain("const localAgentAvailable = !isCapacitorAndroidApp()");
    expect(apiTransport).toContain("localAgentAvailable &&");
    expect(apiTransport).toContain("else if (localAgentAvailable)");
  });
});
