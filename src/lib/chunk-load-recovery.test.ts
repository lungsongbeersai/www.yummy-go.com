import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isChunkLoadError,
  recoverFromChunkLoadError,
} from "@/lib/chunk-load-recovery";

function memorySessionStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("chunk load recovery", () => {
  it("recognizes version-mismatch chunk failures", () => {
    expect(isChunkLoadError(new Error("Failed to load chunk /_next/static/chunks/123.js"))).toBe(true);
    expect(isChunkLoadError(new Error("Failed to fetch dynamically imported module"))).toBe(true);
    expect(isChunkLoadError(new Error("Validation failed"))).toBe(false);
  });

  it("clears only app-shell caches, updates the worker, and reloads", async () => {
    const reload = vi.fn();
    const update = vi.fn().mockResolvedValue(undefined);
    const deleteCache = vi.fn().mockResolvedValue(true);
    vi.stubGlobal("window", {
      location: { reload },
      sessionStorage: memorySessionStorage(),
    });
    vi.stubGlobal("navigator", {
      serviceWorker: {
        getRegistration: vi.fn().mockResolvedValue({ update }),
      },
    });
    vi.stubGlobal("caches", {
      keys: vi.fn().mockResolvedValue([
        "pages",
        "pages-rsc",
        "next-static-js-assets",
        "serwist-precache-v2-example",
      ]),
      delete: deleteCache,
    });

    await expect(recoverFromChunkLoadError(
      new Error("ChunkLoadError: Loading chunk 42 failed"),
    )).resolves.toBe(true);

    expect(deleteCache.mock.calls.map(([name]) => name)).toEqual([
      "pages",
      "pages-rsc",
      "next-static-js-assets",
    ]);
    expect(update).toHaveBeenCalledOnce();
    expect(reload).toHaveBeenCalledOnce();
  });

  it("leaves normal application errors to the existing error boundary", async () => {
    vi.stubGlobal("window", {
      location: { reload: vi.fn() },
      sessionStorage: memorySessionStorage(),
    });

    await expect(recoverFromChunkLoadError(new Error("Validation failed"))).resolves.toBe(false);
  });

  it("preserves offline caches when the browser is actually offline", async () => {
    const reload = vi.fn();
    const deleteCache = vi.fn();
    vi.stubGlobal("window", {
      location: { reload },
      sessionStorage: memorySessionStorage(),
    });
    vi.stubGlobal("navigator", { onLine: false });
    vi.stubGlobal("caches", {
      keys: vi.fn().mockResolvedValue(["pages"]),
      delete: deleteCache,
    });

    await expect(recoverFromChunkLoadError(
      new Error("Failed to load chunk /_next/static/chunks/123.js"),
    )).resolves.toBe(false);
    expect(deleteCache).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });
});
