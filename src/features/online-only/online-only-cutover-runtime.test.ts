import { afterEach, describe, expect, it, vi } from "vitest";
import { retireBrowserOfflineState } from "./online-only-cutover-runtime";

function memoryStorage(values: Record<string, string>): Storage {
  const store = new Map(Object.entries(values));
  return {
    get length() { return store.size; },
    clear: () => store.clear(),
    getItem: (key) => store.get(key) ?? null,
    key: (index) => Array.from(store.keys())[index] ?? null,
    removeItem: (key) => { store.delete(key); },
    setItem: (key, value) => { store.set(key, value); },
  };
}

describe("online-only browser cutover", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("removes offline queues and workers while preserving printer pairing", async () => {
    const localStorage = memoryStorage({
      "yummy-go:offline-sync-device": "old-device",
      "yummy-go-local-recovery:branch": "1",
      "yummy-go-blocked-notice:branch": "4",
      "yummy-go-paired-agent": "keep-printer-pairing",
    });
    const sessionStorage = memoryStorage({ "yummy-go-local-recovery:session": "1" });
    const unregister = vi.fn().mockResolvedValue(true);
    const deleteCache = vi.fn().mockResolvedValue(true);
    const deleteDatabase = vi.fn(() => {
      const request: Record<string, unknown> = { error: null };
      queueMicrotask(() => (request.onsuccess as (() => void) | undefined)?.());
      return request;
    });

    vi.stubGlobal("window", {
      localStorage,
      sessionStorage,
      caches: { keys: vi.fn().mockResolvedValue(["pages", "offline-images"]), delete: deleteCache },
    });
    vi.stubGlobal("navigator", {
      serviceWorker: { getRegistrations: vi.fn().mockResolvedValue([{ unregister }]) },
    });
    vi.stubGlobal("indexedDB", { deleteDatabase });

    await retireBrowserOfflineState();

    expect(localStorage.getItem("yummy-go:offline-sync-device")).toBeNull();
    expect(localStorage.getItem("yummy-go-local-recovery:branch")).toBeNull();
    expect(localStorage.getItem("yummy-go-blocked-notice:branch")).toBeNull();
    expect(localStorage.getItem("yummy-go-paired-agent")).toBe("keep-printer-pairing");
    expect(sessionStorage.length).toBe(0);
    expect(unregister).toHaveBeenCalledOnce();
    expect(deleteCache).toHaveBeenCalledTimes(2);
    expect(deleteDatabase).toHaveBeenCalledWith("yummy-go-browser-offline-v1");
  });
});
