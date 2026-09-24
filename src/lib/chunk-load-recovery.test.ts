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

  it("reloads from the deployed application", async () => {
    const reload = vi.fn();
    vi.stubGlobal("window", {
      location: { reload },
      sessionStorage: memorySessionStorage(),
    });
    vi.stubGlobal("navigator", { onLine: true });

    await expect(recoverFromChunkLoadError(
      new Error("ChunkLoadError: Loading chunk 42 failed"),
    )).resolves.toBe(true);

    expect(reload).toHaveBeenCalledOnce();
  });

  it("leaves normal application errors to the existing error boundary", async () => {
    vi.stubGlobal("window", {
      location: { reload: vi.fn() },
      sessionStorage: memorySessionStorage(),
    });

    await expect(recoverFromChunkLoadError(new Error("Validation failed"))).resolves.toBe(false);
  });

  it("waits for network connectivity before reloading", async () => {
    const reload = vi.fn();
    vi.stubGlobal("window", {
      location: { reload },
      sessionStorage: memorySessionStorage(),
    });
    vi.stubGlobal("navigator", { onLine: false });

    await expect(recoverFromChunkLoadError(
      new Error("Failed to load chunk /_next/static/chunks/123.js"),
    )).resolves.toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});
