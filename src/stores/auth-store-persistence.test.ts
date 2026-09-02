import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/socket", () => ({
  disconnectSocket: vi.fn()
}));

vi.mock("@/services/login", () => ({
  checkLogin: vi.fn()
}));

vi.mock("@/stores/session-store-registry", () => ({
  resetSessionStores: vi.fn()
}));

vi.mock("@/stores/store-utils", () => ({
  errorMessage: (error: unknown) => (error instanceof Error ? error.message : String(error))
}));

const STORAGE_KEY = "yummy-go-auth";

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const store = new Map(Object.entries(initial));

  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key) => store.get(key) ?? null,
    key: (index) => Array.from(store.keys())[index] ?? null,
    removeItem: (key) => {
      store.delete(key);
    },
    setItem: (key, value) => {
      store.set(key, value);
    }
  };
}

interface PersistedAuthUser {
  store_table_status?: number;
}

interface PersistedAuthSnapshot {
  state?: {
    user?: PersistedAuthUser | null;
    offlineSession?: boolean;
  };
  version?: number;
}

describe("auth store persistence", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it("migrates a persisted legacy auth user to include the table status fallback", async () => {
    const legacySnapshot = {
      state: {
        token: "legacy-token",
        user: {
          uuid: "legacy-user",
          email: "legacy@example.com",
          status: 1,
          profile: "",
          branch_uuid: "legacy-branch",
          branch_name: "Branch",
          branch_tel: "",
          branch_address: "",
          store_uuid: "legacy-store",
          store_uuid_fk: "legacy-store",
          store_name: "Store",
          store_logo: ""
        },
        isLoggedIn: true,
        rememberMe: true,
        offlineSession: true,
      },
      version: 0
    };
    const localStorage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(legacySnapshot) });
    const sessionStorage = memoryStorage();

    vi.stubGlobal("localStorage", localStorage);
    vi.stubGlobal("sessionStorage", sessionStorage);
    vi.stubGlobal("window", { localStorage, sessionStorage });

    const { useAuthStore } = await import("@/stores/auth-store");
    const storedSnapshot = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as PersistedAuthSnapshot;

    expect(useAuthStore.getState().user?.store_table_status).toBe(1);
    expect(useAuthStore.getState().offlineSession).toBe(false);
    expect(storedSnapshot.state?.user?.store_table_status).toBe(1);
    expect(storedSnapshot.state).not.toHaveProperty("offlineSession");
    expect(storedSnapshot.version).toBe(2);
  });
});
