import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function memoryStorage(initial: string | null): Storage {
  const values = new Map<string, string>();
  if (initial !== null) values.set("yummy-go-app", initial);

  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); },
  };
}

async function restoreApp(state?: Record<string, unknown>) {
  const storage = memoryStorage(state ? JSON.stringify({ state, version: 1 }) : null);
  vi.stubGlobal("window", { localStorage: storage });
  const { useAppStore } = await import("@/stores/app-store");
  await useAppStore.persist.rehydrate();
  return { useAppStore, storage };
}

describe("app background persistence", () => {
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("defaults to the original emerald floral background", async () => {
    const { useAppStore } = await restoreApp();
    expect(useAppStore.getState()).toMatchObject({
      decorBackground: true,
      decorBackgroundColor: "emerald",
      decorBackgroundStyle: "floral",
      hydrated: true,
    });
  });

  it("inherits a legacy accent color before merging defaults and keeps its disabled flag", async () => {
    const { useAppStore } = await restoreApp({ themeColor: "blue", decorBackground: false });
    expect(useAppStore.getState()).toMatchObject({
      themeColor: "blue",
      decorBackground: false,
      decorBackgroundColor: "blue",
      decorBackgroundStyle: "floral",
    });
  });

  it("repairs invalid saved background preferences using the valid accent color", async () => {
    const { useAppStore } = await restoreApp({
      themeColor: "violet",
      decorBackgroundColor: "unknown",
      decorBackgroundStyle: 12,
    });
    expect(useAppStore.getState()).toMatchObject({ decorBackgroundColor: "violet", decorBackgroundStyle: "floral" });
  });

  it("repairs invalid accent and background colors to emerald", async () => {
    const { useAppStore } = await restoreApp({ themeColor: "unknown", decorBackgroundColor: null });
    expect(useAppStore.getState()).toMatchObject({ themeColor: "emerald", decorBackgroundColor: "emerald" });
  });

  it("persists selections independently of the accent and restores them after reopening", async () => {
    const { useAppStore } = await restoreApp({ themeColor: "blue", decorBackground: false });
    useAppStore.getState().setDecorBackgroundColor("rose");
    useAppStore.getState().setDecorBackgroundStyle("waves");
    useAppStore.getState().setThemeColor("amber");

    vi.resetModules();
    const reopened = await import("@/stores/app-store");
    await reopened.useAppStore.persist.rehydrate();
    expect(reopened.useAppStore.getState()).toMatchObject({
      themeColor: "amber",
      decorBackground: false,
      decorBackgroundColor: "rose",
      decorBackgroundStyle: "waves",
    });
  });
});
