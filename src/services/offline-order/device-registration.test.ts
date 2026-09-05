import { beforeEach, describe, expect, it } from "vitest";
import { ensureOfflineSyncDevice, getOfflineSyncDeviceAuth } from "./device-registration";

const STORAGE_KEY = "yummy-go:offline-sync-device";

// No jsdom in this project (vitest.config.ts runs the "node" environment) —
// device-registration.ts only needs `window.localStorage`, so a minimal
// stand-in is enough rather than pulling in a DOM environment for one file.
class MemoryLocalStorage {
  private readonly store = new Map<string, string>();
  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
  clear() {
    this.store.clear();
  }
}

describe("ensureOfflineSyncDevice", () => {
  beforeEach(() => {
    (globalThis as { window?: unknown }).window = { localStorage: new MemoryLocalStorage() };
  });

  it("mints a device identity that satisfies Backend's minimums", () => {
    const device = ensureOfflineSyncDevice();
    expect(device.deviceCode.length).toBeGreaterThan(0);
    // Backend rejects a secret shorter than 24 chars (back-end/api/v1/sync/create.js).
    expect(device.agentSecret.length).toBeGreaterThanOrEqual(24);
  });

  it("persists the same identity across calls, not a fresh one each time", () => {
    const first = ensureOfflineSyncDevice();
    const second = ensureOfflineSyncDevice();
    expect(second).toEqual(first);
    expect(getOfflineSyncDeviceAuth()).toEqual(first);
  });

  it("mints a fresh identity if storage holds a secret shorter than Backend accepts", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ deviceCode: "android-x", agentSecret: "too-short" }));
    expect(getOfflineSyncDeviceAuth()).toBeNull();
    const device = ensureOfflineSyncDevice();
    expect(device.agentSecret.length).toBeGreaterThanOrEqual(24);
  });

  it("returns null when nothing has been minted yet", () => {
    expect(getOfflineSyncDeviceAuth()).toBeNull();
  });
});
