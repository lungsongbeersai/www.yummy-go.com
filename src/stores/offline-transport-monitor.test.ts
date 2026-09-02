import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BACKEND_NETWORK_STATE } from "@/lib/network-state";
import { resetLocalSyncConfiguration } from "@/services/offline-sync";
import { useAuthStore, type AuthUser } from "@/stores/auth-store";
import {
  probeBackendReachability,
  startBackendNetworkMonitor,
  startOfflineTransportMonitor,
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

  it("starts CHECKING, requires three probe failures, and ignores offline event as authority", async () => {
    const browser = installBrowser(true);
    const probeBackend = vi.fn().mockResolvedValue(unreachable());
    const stop = startBackendNetworkMonitor({
      probeBackend,
      checkingPollMs: 500,
      offlinePollMs: 1000,
    });

    expect(useNetworkStore.getState().state).toBe(BACKEND_NETWORK_STATE.CHECKING);
    await flushPromises();
    expect(useNetworkStore.getState().state).toBe(BACKEND_NETWORK_STATE.CHECKING);

    browser.setOnline(false);
    expect(useNetworkStore.getState().state).toBe(BACKEND_NETWORK_STATE.CHECKING);
    await vi.advanceTimersByTimeAsync(0);
    expect(useNetworkStore.getState().state).toBe(BACKEND_NETWORK_STATE.CHECKING);

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
    await vi.advanceTimersByTimeAsync(1000);
    expect(useNetworkStore.getState().state).toBe(BACKEND_NETWORK_STATE.OFFLINE);

    browser.setOnline(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(useNetworkStore.getState().state).toBe(BACKEND_NETWORK_STATE.ONLINE);
    expect(useAuthStore.getState().offlineSession).toBe(false);
    stop();
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
