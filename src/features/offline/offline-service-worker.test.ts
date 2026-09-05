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
const offlineSync = readFileSync(
  join(testDir, "..", "..", "services", "offline-sync.ts"),
  "utf8"
);

describe("offline asset cache", () => {
  it("answers any cached width for a product image so offline never shows a broken photo", () => {
    // The uploaded-image entry has to claim /_next/image: <Image> never requests the
    // product URL directly, so a matcher reading only url.pathname sees "/_next/image"
    // and never "/uploaded/", and no product image is ever cached. defaultCache still
    // handles every other Next Image request, but its 64-entry / 24h window is far too
    // small to hold a POS menu for a shift offline.
    //
    // ignoreSearch: true is required here (reversing the earlier per-width-entry
    // decision, docs/Decisions.md): next/image requests a different w= for the same
    // product depending on where it renders (a wide grid card vs. a ~40px cart-line
    // thumbnail), and opening the menu online only ever warms the grid's width. Without
    // this, a product added to an order for the first time while offline — the whole
    // point of Android offline order-taking — hits the cart-line width with no cached
    // answer and no network, rendering a broken image.
    expect(serviceWorkerSource).toContain('from "@serwist/next/worker"');
    expect(serviceWorkerSource).toContain("...defaultCache");
    expect(serviceWorkerSource).toContain('url.pathname !== "/_next/image"');

    const imageEntry = serviceWorkerSource.slice(
      serviceWorkerSource.indexOf("const uploadedImageCaching"),
      serviceWorkerSource.indexOf("const serwist = new Serwist")
    );
    expect(imageEntry).not.toBe("");
    expect(imageEntry).toContain("matchOptions");
    expect(imageEntry).toContain("ignoreSearch: true");
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
    // Android may write and read the Dexie mirror — that is its only offline
    // source — but the two AGENT_URL posts inside cacheOnlineResponse stay behind
    // the same flag, so no request is ever aimed at 127.0.0.1:7777.
    expect(apiTransport).toContain("localScope.storeUuid,\n          localAgentAvailable,");
    expect(apiTransport).toContain("localScope.storeUuid,\n        localAgentAvailable,");
    expect(offlineSync).toContain("if (!agentAvailable) return;");
  });

  it("gives the Capacitor Android app an offline read path that needs no Agent", () => {
    // Reads only. prepared.eventUuid is set exactly for the mutations that need a
    // durable outbox, and Android has none, so those must keep failing.
    expect(apiTransport).toContain("!localAgentAvailable &&");
    expect(apiTransport).toContain("!prepared.eventUuid &&");
    // The Android WebView reports navigator.onLine === true with the radios off,
    // so this read path must not wait for the OFFLINE latch or for that hint.
    expect(apiTransport).toContain(
      '!localAgentAvailable &&\n      classification.classification === "NETWORK_TRANSPORT" &&',
    );
    // The offline verdict stays with the probe: a blip must not flip the app into
    // offline mode just because one read fell back to cache.
    const androidBranch = apiTransport.slice(
      apiTransport.indexOf("!localAgentAvailable &&\n      classification.classification"),
    );
    expect(androidBranch.slice(0, androidBranch.indexOf("throw normalized")))
      .not.toContain("setOfflineSession");
    expect(apiTransport).toContain("readBrowserOfflineCache<T>(");
    // The helper reads Dexie directly; requestLocalFallback (the Agent path) is
    // not part of its body.
    const helper = offlineSync.slice(offlineSync.indexOf("export async function readBrowserOfflineCache<T>("));
    expect(helper.slice(0, helper.indexOf("\n}")))
      .toContain("readBrowserApiFallback<T>(");
    expect(helper.slice(0, helper.indexOf("\n}"))).not.toContain("AGENT_URL");
  });

  it("lets the Desktop Agent serve a read before the OFFLINE latch", () => {
    // A shop with its LAN up and its internet down reports navigator.onLine ===
    // true, so canContinueOffline waits out three confirmed probes (~18s) and
    // every read on pos/tables surfaced axios's raw "Network Error" meanwhile.
    // Reads only, and the online attempt is already spent when this runs.
    const desktopBranch = apiTransport.slice(
      apiTransport.indexOf(
        'localAgentAvailable &&\n      classification.classification === "NETWORK_TRANSPORT" &&',
      ),
    );
    const body = desktopBranch.slice(0, desktopBranch.indexOf("// Android reaches no Agent"));
    expect(body).toContain("!prepared.eventUuid &&");
    expect(body).toContain("supportsOfflineRoute(method, url) &&");
    expect(body).toContain("requestLocalFallback<T>(");
    // The probe stays the only authority on the offline verdict: falling back for
    // one read must not flip the app into offline mode.
    expect(body).not.toContain("setOfflineSession");
    // A dead Agent must leave the Backend error intact rather than replace it.
    expect(body).not.toContain("throw new ServiceError");
  });
});
