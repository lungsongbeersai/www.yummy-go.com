import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  probeAndroidBackend,
  startAndroidOnlineRecoveryMonitor,
  startOfflineTransportMonitor,
} from "@/stores/offline-transport-monitor";
import { resetLocalSyncConfiguration } from "@/services/offline-sync";
import { useAuthStore, type AuthUser } from "@/stores/auth-store";

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

describe("Android online recovery monitor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetLocalSyncConfiguration();
    useAuthStore.getState().login("online-token", authUser());
  });

  afterEach(() => {
    useAuthStore.getState().logout();
    resetLocalSyncConfiguration();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("uses the authenticated Backend health endpoint and validates the active scope", async () => {
    const get = vi.spyOn(axios, "get").mockResolvedValue({
      data: {
        status: "success",
        data: {
          online: true,
          store_uuid_fk: "store-1",
          branch_uuid_fk: "branch-1",
        },
      },
    });

    await expect(probeAndroidBackend({
      token: "online-token",
      storeUuid: "store-1",
      branchUuid: "branch-1",
    })).resolves.toBe(true);
    expect(get).toHaveBeenCalledWith("/api/v1/sync/health", expect.objectContaining({
      timeout: 5000,
      headers: {
        Authorization: "Bearer online-token",
        "x-access-token": "online-token",
      },
    }));

    await expect(probeAndroidBackend({
      token: "online-token",
      storeUuid: "another-store",
      branchUuid: "branch-1",
    })).resolves.toBe(false);
  });

  it("clears a persisted offline session as soon as Backend is reachable", async () => {
    installBrowser(true);
    useAuthStore.getState().setOfflineSession(true);
    const probeBackend = vi.fn().mockResolvedValue(true);

    const stop = startAndroidOnlineRecoveryMonitor({ probeBackend });
    await flushPromises();

    expect(probeBackend).toHaveBeenCalledWith({
      token: "online-token",
      storeUuid: "store-1",
      branchUuid: "branch-1",
    });
    expect(useAuthStore.getState().offlineSession).toBe(false);
    stop();
  });

  it("does not trust navigator.onLine alone and never contacts the Desktop Agent", async () => {
    installBrowser(true);
    const axiosGet = vi.spyOn(axios, "get");
    const axiosPost = vi.spyOn(axios, "post");
    const probeBackend = vi.fn().mockResolvedValue(false);

    const stop = startAndroidOnlineRecoveryMonitor({
      probeBackend,
      recoveryPollMs: 500,
      failuresBeforeOffline: 2,
    });
    await flushPromises();
    expect(useAuthStore.getState().offlineSession).toBe(false);

    await vi.advanceTimersByTimeAsync(500);
    expect(useAuthStore.getState().offlineSession).toBe(true);
    expect(axiosGet).not.toHaveBeenCalled();
    expect(axiosPost).not.toHaveBeenCalled();
    stop();
  });

  it("switches offline immediately on a network event and recovers after Backend answers", async () => {
    const browser = installBrowser(true);
    const probeBackend = vi.fn().mockResolvedValue(true);
    const stop = startAndroidOnlineRecoveryMonitor({ probeBackend });
    await flushPromises();

    browser.setOnline(false);
    expect(useAuthStore.getState().offlineSession).toBe(true);

    browser.setOnline(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(useAuthStore.getState().offlineSession).toBe(false);
    stop();
  });

  it("clears a stale desktop offline session when Backend is healthy and no local work is pending", async () => {
    installBrowser(true);
    useAuthStore.getState().setOfflineSession(true);
    expect(useAuthStore.getState().isLoggedIn).toBe(true);
    expect(useAuthStore.getState().offlineSession).toBe(true);
    const post = vi.spyOn(axios, "post").mockRejectedValue(new Error("Agent unavailable"));
    const get = vi.spyOn(axios, "get")
      .mockRejectedValueOnce(new Error("Agent unavailable"))
      .mockResolvedValueOnce({
        data: {
          status: "success",
          data: {
            online: true,
            store_uuid_fk: "store-1",
            branch_uuid_fk: "branch-1",
          },
        },
      });

    const stop = startOfflineTransportMonitor();
    try {
      await vi.waitFor(() => expect(post).toHaveBeenCalled());
      await vi.waitFor(() => expect(useAuthStore.getState().offlineSession).toBe(false));
      expect(get).toHaveBeenCalledWith("/api/v1/sync/health", expect.objectContaining({
        headers: {
          Authorization: "Bearer online-token",
          "x-access-token": "online-token",
        },
      }));
    } finally {
      stop();
    }
  });
});
