import axios from "axios";
import { Capacitor } from "@capacitor/core";
import { apiClient } from "@/lib/api";
import * as offlineSync from "@/services/offline-sync";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BACKEND_NETWORK_STATE } from "@/lib/network-state";
import { resetLocalSyncConfiguration } from "@/services/offline-sync";
import { useAuthStore, type AuthUser } from "@/stores/auth-store";
import {
  probeBackendReachability,
  probeBackendNow,
  requestImmediateReconcile,
  getCurrentSyncPending,
  startBackendNetworkMonitor,
  offlineWorkerScopeKey,
  startOfflineTransportMonitor,
  withSyncWorkerLock,
  type BackendProbeResult,
} from "@/stores/offline-transport-monitor";
import { backendNetworkManager, useNetworkStore } from "@/stores/network-store";

function authUser(uuid = "login-1"): AuthUser {
  return {
    uuid,
    email: `${uuid}@example.com`,
    status: 1,
    profile: "",
    branch_uuid: "branch-1",
    branch_name: "Branch",
    branch_tel: "",
    branch_address: "",
    store_uuid: "store-1",
    store_uuid_fk: "store-1",
    store_name: "Store",
    store_logo: "",
    store_table_status: 1,
  };
}

function installBrowser(online: boolean) {
  const events = new EventTarget();
  const browserNavigator = { onLine: online };
  vi.stubGlobal("navigator", browserNavigator);
  vi.stubGlobal("window", {
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
    dispatchEvent: events.dispatchEvent.bind(events),
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
    location: { origin: "https://pos.example.test" },
  });
  return {
    setOnline(nextOnline: boolean) {
      browserNavigator.onLine = nextOnline;
      events.dispatchEvent(new Event(nextOnline ? "online" : "offline"));
    },
  };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

const reachable = (status = 200): BackendProbeResult => ({
  reachable: true,
  httpStatus: status,
  classification: "HTTP_RESPONSE",
  reason: status === 200 ? "backend_health_success" : `http_${status}_backend_reachable`,
});
const unreachable = (): BackendProbeResult => ({
  reachable: false,
  httpStatus: null,
  classification: "NETWORK_TRANSPORT",
  reason: "backend_fetch_network_error",
});

describe.each(["android", "ios"])("%s Dexie sync worker", (platform) => {
  beforeEach(() => {
    vi.useFakeTimers();
    installBrowser(true);
    const storage = new Map<string, string>();
    vi.stubGlobal("window", { ...window, localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    } });
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    vi.spyOn(Capacitor, "getPlatform").mockReturnValue(platform);
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    useAuthStore.getState().login(`native-${platform}`, authUser(`login-${platform}`));
    backendNetworkManager.reportReachable(200);
  });
  afterEach(() => { useAuthStore.getState().logout(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

  it("reads the cashier badge from the branch's Dexie queue, not Agent status", async () => {
    vi.spyOn(offlineSync, "getBrowserLocalSyncStatus").mockResolvedValue({ staged: 2, pending: 1, processing: 1, failed: 0, blocked: 3, synced: 5 });
    const agent = vi.spyOn(offlineSync, "getLocalSyncStatus");
    await expect(getCurrentSyncPending()).resolves.toEqual({ pending: 3, processing: 1, failed: 0, blocked: 3 });
    expect(agent).not.toHaveBeenCalled();
  });

  it("registers with Backend then starts direct push, without configuring or probing an Agent", async () => {
    const register = vi.spyOn(apiClient, "post").mockResolvedValue({ status: 200, data: { status: "success" } });
    const push = vi.spyOn(offlineSync, "pushBrowserSyncQueue").mockResolvedValue({ staged: 0, pending: 0, processing: 0, blocked: 0, failed: 0, synced: 1 });
    const agentGet = vi.spyOn(axios, "get");
    const agentPost = vi.spyOn(axios, "post");
    const stop = startOfflineTransportMonitor();
    await vi.advanceTimersByTimeAsync(1);
    expect(register).toHaveBeenCalledWith("/api/v1/sync/device/register", expect.objectContaining({ platform }), expect.anything());
    expect(push).toHaveBeenCalledWith({ storeUuid: "store-1", branchUuid: "branch-1", actorLoginUuid: `login-${platform}` }, undefined, expect.any(Function));
    expect(agentGet).not.toHaveBeenCalled();
    expect(agentPost).not.toHaveBeenCalled();
    stop();
  });

  it("does not push when registration fails and retries on a later tick", async () => {
    useAuthStore.getState().login(`native-failed-${platform}`, authUser(`failed-${platform}`));
    const register = vi.spyOn(apiClient, "post").mockRejectedValue(new Error("registration failed"));
    const push = vi.spyOn(offlineSync, "pushBrowserSyncQueue").mockResolvedValue(null);
    const stop = startOfflineTransportMonitor();
    await vi.advanceTimersByTimeAsync(1);
    expect(push).not.toHaveBeenCalled();
    register.mockResolvedValue({ status: 200, data: { status: "success" } });
    await vi.advanceTimersByTimeAsync(5000);
    expect(push).toHaveBeenCalledOnce();
    stop();
  });
});

describe("Backend NetworkManager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    resetLocalSyncConfiguration();
    backendNetworkManager.resetChecking("test_start");
    useAuthStore.getState().login("online-token", authUser());
  });

  afterEach(() => {
    useAuthStore.getState().logout();
    resetLocalSyncConfiguration();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it.each([200, 400, 401, 403, 500, 502, 503])(
    "treats health HTTP %s as Backend reachable",
    async (status) => {
      installBrowser(true);
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status })));

      await expect(probeBackendReachability()).resolves.toMatchObject({
        reachable: true,
        httpStatus: status,
      });
    },
  );

  it("needs three probe failures while the browser reports online", async () => {
    installBrowser(true);
    const probeBackend = vi.fn().mockResolvedValue(unreachable());
    const stop = startBackendNetworkMonitor({
      probeBackend,
      checkingPollMs: 500,
      offlinePollMs: 1000,
    });

    expect(useNetworkStore.getState().state).toBe(BACKEND_NETWORK_STATE.CHECKING);
    await flushPromises();
    expect(useNetworkStore.getState().state).toBe(BACKEND_NETWORK_STATE.CHECKING);
    await vi.advanceTimersByTimeAsync(500);
    expect(useNetworkStore.getState().state).toBe(BACKEND_NETWORK_STATE.CHECKING);
    await vi.advanceTimersByTimeAsync(500);
    expect(useNetworkStore.getState().state).toBe(BACKEND_NETWORK_STATE.OFFLINE);
    stop();
  });

  it("still requires three failed probes when the browser starts reporting no network", async () => {
    const browser = installBrowser(true);
    const probeBackend = vi.fn().mockResolvedValue(unreachable());
    const stop = startBackendNetworkMonitor({
      probeBackend,
      checkingPollMs: 500,
      offlinePollMs: 1000,
    });

    await flushPromises();
    // navigator still online -> one confirmed failure is not a verdict yet.
    expect(useNetworkStore.getState().state).toBe(BACKEND_NETWORK_STATE.CHECKING);

    // The offline DOM event alone only schedules a probe, it is not authority.
    browser.setOnline(false);
    expect(useNetworkStore.getState().state).toBe(BACKEND_NETWORK_STATE.CHECKING);

    // The hint cannot shorten confirmation, even when the next probe fails.
    await vi.advanceTimersByTimeAsync(0);
    expect(useNetworkStore.getState().state).toBe(BACKEND_NETWORK_STATE.CHECKING);
    expect(useAuthStore.getState().offlineSession).toBe(false);
    await vi.advanceTimersByTimeAsync(500);
    expect(useNetworkStore.getState().state).toBe(BACKEND_NETWORK_STATE.OFFLINE);
    expect(useAuthStore.getState().offlineSession).toBe(true);
    stop();
  });

  it("becomes ONLINE from Backend success even when navigator reports offline", async () => {
    installBrowser(false);
    const stop = startBackendNetworkMonitor({
      probeBackend: vi.fn().mockResolvedValue(reachable()),
    });
    expect(useNetworkStore.getState().state).toBe(BACKEND_NETWORK_STATE.CHECKING);
    expect(useAuthStore.getState().offlineSession).toBe(false);
    await flushPromises();

    expect(useNetworkStore.getState().state).toBe(BACKEND_NETWORK_STATE.ONLINE);
    expect(useAuthStore.getState().offlineSession).toBe(false);
    stop();
  });

  it("does not count a probe configuration error as an Offline failure", async () => {
    installBrowser(true);
    const stop = startBackendNetworkMonitor({
      probeBackend: vi.fn().mockResolvedValue({
        reachable: false,
        httpStatus: null,
        classification: "NON_NETWORK",
        reason: "non_network_invalid_url",
      }),
      checkingPollMs: 500,
    });
    await flushPromises();
    await vi.advanceTimersByTimeAsync(2_000);

    expect(useNetworkStore.getState()).toMatchObject({
      state: BACKEND_NETWORK_STATE.CHECKING,
      consecutiveFailures: 0,
    });
    stop();
  });

  it("recovers ONLINE immediately after a successful reconnect probe", async () => {
    const browser = installBrowser(false);
    const probeBackend = vi.fn()
      .mockResolvedValueOnce(unreachable())
      .mockResolvedValueOnce(unreachable())
      .mockResolvedValueOnce(unreachable())
      .mockResolvedValue(reachable());
    const stop = startBackendNetworkMonitor({
      probeBackend,
      checkingPollMs: 500,
      offlinePollMs: 1000,
    });

    await flushPromises();
    expect(useNetworkStore.getState().state).toBe(BACKEND_NETWORK_STATE.CHECKING);
    await vi.advanceTimersByTimeAsync(1000);
    expect(useNetworkStore.getState().state).toBe(BACKEND_NETWORK_STATE.OFFLINE);

    browser.setOnline(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(useNetworkStore.getState().state).toBe(BACKEND_NETWORK_STATE.ONLINE);
    expect(useAuthStore.getState().offlineSession).toBe(false);
    stop();
  });

  it("does not re-probe in a feedback loop after a successful health response", async () => {
    installBrowser(true);
    const probeBackend = vi.fn().mockResolvedValue(reachable());
    const stop = startBackendNetworkMonitor({ probeBackend, onlinePollMs: 5000 });
    try {
      await flushPromises();
      expect(probeBackend).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(4999);
      expect(probeBackend).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(probeBackend).toHaveBeenCalledTimes(2);

      requestImmediateReconcile();
      await vi.advanceTimersByTimeAsync(0);
      expect(probeBackend).toHaveBeenCalledTimes(3);
    } finally { stop(); }
  });

  it("does not announce an outage for a transient timeout and stale browser hint", async () => {
    installBrowser(false);
    const probeBackend = vi.fn().mockResolvedValueOnce(unreachable()).mockResolvedValue(reachable());
    const stop = startBackendNetworkMonitor({ probeBackend, checkingPollMs: 500 });
    try {
      await flushPromises();
      expect(backendNetworkManager.isOffline()).toBe(false);
      expect(useAuthStore.getState().offlineSession).toBe(false);
      await vi.advanceTimersByTimeAsync(500);
      expect(useNetworkStore.getState().state).toBe(BACKEND_NETWORK_STATE.ONLINE);
      expect(useAuthStore.getState().offlineSession).toBe(false);
    } finally { stop(); }
  });

  it.each([200, 401, 500, 503])("ignores a stale probe failure after a newer HTTP %s response", async (status) => {
    installBrowser(false);
    let finishProbe: (result: BackendProbeResult) => void = () => {};
    const delayed = new Promise<BackendProbeResult>((resolve) => { finishProbe = resolve; });
    const probeBackend = vi.fn()
      .mockResolvedValueOnce(unreachable())
      .mockResolvedValueOnce(unreachable())
      .mockReturnValueOnce(delayed);
    const stop = startBackendNetworkMonitor({ probeBackend, checkingPollMs: 500 });
    try {
      await vi.advanceTimersByTimeAsync(1000);
      expect(useNetworkStore.getState().consecutiveFailures).toBe(2);
      // Both occur at the same fake time: ordering must not rely on timestamps.
      backendNetworkManager.reportReachable(status, "new_api_response");
      finishProbe(unreachable());
      await flushPromises();
      expect(useNetworkStore.getState()).toMatchObject({
        state: BACKEND_NETWORK_STATE.ONLINE,
        consecutiveFailures: 0,
        lastHttpStatus: status,
        lastReason: "new_api_response",
      });
      expect(useAuthStore.getState().offlineSession).toBe(false);
    } finally { stop(); }
  });

  it("ignores a late rejected probe after a newer HTTP response", async () => {
    installBrowser(true);
    let rejectProbe: (error: Error) => void = () => {};
    const delayed = new Promise<BackendProbeResult>((_resolve, reject) => { rejectProbe = reject; });
    const stop = startBackendNetworkMonitor({ probeBackend: () => delayed });
    try {
      backendNetworkManager.reportReachable(200);
      rejectProbe(new TypeError("Failed to fetch"));
      await flushPromises();
      expect(useNetworkStore.getState().state).toBe(BACKEND_NETWORK_STATE.ONLINE);
      expect(useNetworkStore.getState().consecutiveFailures).toBe(0);
    } finally { stop(); }
  });

  it("also ignores stale failures from a one-shot probe", async () => {
    installBrowser(true);
    let rejectFetch: (error: Error) => void = () => {};
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((_resolve, reject) => { rejectFetch = reject; })));
    const pending = probeBackendNow();
    backendNetworkManager.reportReachable(200);
    rejectFetch(new TypeError("Failed to fetch"));
    await expect(pending).resolves.toMatchObject({ state: BACKEND_NETWORK_STATE.ONLINE, consecutiveFailures: 0 });
  });

  it("does not apply a pending failure after its monitor stops", async () => {
    installBrowser(true);
    let finishProbe: (result: BackendProbeResult) => void = () => {};
    const delayed = new Promise<BackendProbeResult>((resolve) => { finishProbe = resolve; });
    const stop = startBackendNetworkMonitor({ probeBackend: () => delayed });
    stop();
    finishProbe(unreachable());
    await flushPromises();
    expect(useNetworkStore.getState().consecutiveFailures).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not turn a local login token and offline auth flag into an outage", async () => {
    installBrowser(true);
    useAuthStore.getState().login("local.session", authUser());
    useAuthStore.getState().setOfflineSession(true);
    const stop = startBackendNetworkMonitor({ probeBackend: vi.fn().mockResolvedValue(reachable()) });
    try {
      await flushPromises();
      expect(useAuthStore.getState().offlineSession).toBe(true);
      expect(useNetworkStore.getState().state).toBe(BACKEND_NETWORK_STATE.ONLINE);
    } finally { stop(); }
  });

  it("keeps POS ONLINE when the Local Agent is unavailable", async () => {
    installBrowser(true);
    backendNetworkManager.reportReachable(200, "backend_health_success");
    const post = vi.spyOn(axios, "post").mockRejectedValue(new Error("Agent unavailable"));
    vi.spyOn(axios, "get").mockRejectedValue(new Error("Agent unavailable"));

    const stop = startOfflineTransportMonitor();
    await flushPromises();

    expect(post).toHaveBeenCalled();
    expect(useNetworkStore.getState().state).toBe(BACKEND_NETWORK_STATE.ONLINE);
    expect(useAuthStore.getState().offlineSession).toBe(false);
    stop();
  });

  it("survives ten disconnect/reconnect cycles without a stale OFFLINE state", () => {
    let snapshot = backendNetworkManager.getSnapshot();
    for (let cycle = 0; cycle < 10; cycle += 1) {
      backendNetworkManager.reportTransportFailure("backend_fetch_network_error");
      backendNetworkManager.reportTransportFailure("backend_fetch_network_error");
      snapshot = backendNetworkManager.reportReachable(200, "backend_health_success");
    }
    expect(snapshot).toMatchObject({
      state: BACKEND_NETWORK_STATE.ONLINE,
      consecutiveFailures: 0,
    });
  });
});

describe("multi-tab sync worker lock", () => {
  // Exclusive per lock name, exactly like the Web Locks API.
  function locksWithOneHolder(): LockManager {
    const held = new Set<string>();
    return {
      async request(
        name: string,
        _options: LockOptions,
        callback: (lock: Lock | null) => Promise<void>,
      ) {
        if (held.has(name)) return callback(null);
        held.add(name);
        try {
          await callback({ name, mode: "exclusive" });
        } finally {
          held.delete(name);
        }
      },
    } as unknown as LockManager;
  }

  const branchA = offlineWorkerScopeKey({
    storeUuid: "store-1",
    branchUuid: "branch-a",
    actorLoginUuid: "login-1",
  });
  const branchB = offlineWorkerScopeKey({
    storeUuid: "store-1",
    branchUuid: "branch-b",
    actorLoginUuid: "login-2",
  });

  it("lets only one tab drain the queue while a tab already holds the lock", async () => {
    const locks = locksWithOneHolder();
    const order: string[] = [];
    let releaseFirst = () => {};
    const firstHolderDone = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const firstTab = withSyncWorkerLock(branchA, async () => {
      order.push("first");
      await firstHolderDone;
    }, locks);

    await Promise.resolve();
    const secondTab = await withSyncWorkerLock(branchA, async () => {
      order.push("second");
    }, locks);

    expect(secondTab).toBe(false);
    expect(order).toEqual(["first"]);

    releaseFirst();
    expect(await firstTab).toBe(true);
  });

  it("hands the work to the next tab once the lock is free", async () => {
    const locks = locksWithOneHolder();
    expect(await withSyncWorkerLock(branchA, async () => undefined, locks)).toBe(true);
    expect(await withSyncWorkerLock(branchA, async () => undefined, locks)).toBe(true);
  });

  it("does not let one branch's worker block another branch's tab", async () => {
    const locks = locksWithOneHolder();
    const drained: string[] = [];
    let releaseA = () => {};
    const branchAHolding = new Promise<void>((resolve) => {
      releaseA = resolve;
    });

    const tabA = withSyncWorkerLock(branchA, async () => {
      drained.push("branch-a");
      await branchAHolding;
    }, locks);
    await Promise.resolve();

    // Branch B is a different scope, so it must get its own worker immediately.
    expect(await withSyncWorkerLock(branchB, async () => {
      drained.push("branch-b");
    }, locks)).toBe(true);
    // ...while a second branch A tab still has to wait.
    expect(await withSyncWorkerLock(branchA, async () => {
      drained.push("branch-a-second");
    }, locks)).toBe(false);

    releaseA();
    await tabA;
    expect(drained).toEqual(["branch-a", "branch-b"]);
  });

  it("keeps working on browsers without Web Locks", async () => {
    let ran = false;
    // A LockManager-shaped value with no request(): the pre-Web-Locks fallback.
    const result = await withSyncWorkerLock(branchA, async () => {
      ran = true;
    }, {} as LockManager);
    expect(result).toBe(true);
    expect(ran).toBe(true);
  });
});
