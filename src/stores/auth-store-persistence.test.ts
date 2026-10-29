import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/socket", () => ({
  disconnectSocket: vi.fn()
}));

vi.mock("@/services/login", () => ({
  checkLogin: vi.fn(),
  validateLoginSession: vi.fn()
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
    token?: string | null;
    isLoggedIn?: boolean;
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
    expect(storedSnapshot.state?.user?.store_table_status).toBe(1);
    expect(storedSnapshot.state).not.toHaveProperty("offlineSession");
    expect(storedSnapshot.version).toBe(3);
  });

  it("logs out a retired persisted local session", async () => {
    const localStorage = memoryStorage({
      [STORAGE_KEY]: JSON.stringify({
        state: {
          token: "local.retired-session",
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
            store_name: "Store",
            store_logo: "",
          },
          isLoggedIn: true,
          rememberMe: true,
        },
        version: 2,
      }),
    });
    const sessionStorage = memoryStorage();
    vi.stubGlobal("localStorage", localStorage);
    vi.stubGlobal("sessionStorage", sessionStorage);
    vi.stubGlobal("window", { localStorage, sessionStorage });

    const { useAuthStore } = await import("@/stores/auth-store");

    expect(useAuthStore.getState()).toMatchObject({
      token: null,
      user: null,
      isLoggedIn: false,
    });
  });

  it("retains a non-PLC branch date but never restores a persisted expiry reason", async () => {
    const localStorage = memoryStorage({ [STORAGE_KEY]: JSON.stringify({ version: 3, state: {
      token: "online-token", isLoggedIn: true, rememberMe: true,
      user: { uuid: "cashier", email: "cashier@example.test", status: 4, profile: "", branch_uuid: "branch-1",
        branch_name: "Branch", branch_tel: "", branch_address: "", store_uuid: "store-1", store_name: "Store", store_logo: "",
        store_status: 2, store_table_status: 1, contract_end_on: "2027-01-12", contract_days_remaining: 77 },
      contractExpiry: { endOn: "2000-01-01", daysRemaining: -100 },
    } }) });
    const sessionStorage = memoryStorage();
    vi.stubGlobal("localStorage", localStorage);
    vi.stubGlobal("sessionStorage", sessionStorage);
    vi.stubGlobal("window", { localStorage, sessionStorage });
    const { useAuthStore } = await import("@/stores/auth-store");
    expect(useAuthStore.getState()).toMatchObject({ token: "online-token", isLoggedIn: true, contractExpiry: null,
      user: { store_status: 2, contract_end_on: "2027-01-12", contract_days_remaining: 77 } });
    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as { state?: Record<string, unknown> };
    expect(persisted.state).not.toHaveProperty("contractExpiry");
  });

  it("removes persisted credentials on expiry and keeps renewal metadata only in memory", async () => {
    const localStorage = memoryStorage();
    const sessionStorage = memoryStorage();
    vi.stubGlobal("localStorage", localStorage);
    vi.stubGlobal("sessionStorage", sessionStorage);
    vi.stubGlobal("window", { localStorage, sessionStorage });
    const { useAuthStore } = await import("@/stores/auth-store");
    useAuthStore.getState().login("online-token", {
      uuid: "cashier", email: "cashier@example.test", status: 4, profile: "", branch_uuid: "branch-1",
      branch_name: "Branch", branch_tel: "", branch_address: "", store_uuid: "store-1", store_name: "Store", store_logo: "",
      store_status: 2, store_table_status: 1,
    }, true);
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
    useAuthStore.getState().expireContract({ endOn: "2026-10-28", daysRemaining: -1 });
    expect(useAuthStore.getState()).toMatchObject({ token: null, user: null, isLoggedIn: false,
      contractExpiry: { endOn: "2026-10-28", daysRemaining: -1 } });
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    vi.resetModules();
    const fresh = await import("@/stores/auth-store");
    expect(fresh.useAuthStore.getState()).toMatchObject({ token: null, user: null, isLoggedIn: false, contractExpiry: null });
  });
});
