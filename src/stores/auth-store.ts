"use client";

import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { disconnectSocket } from "@/lib/socket";
import { checkLogin } from "@/services/login";
import { resetSessionStores } from "@/stores/session-store-registry";
import { errorMessage } from "@/stores/store-utils";

export interface AuthUser {
  uuid: string;
  email: string;
  status: number;
  profile: string;
  branch_uuid: string;
  branch_name: string;
  branch_tel: string;
  branch_address: string;
  store_uuid: string;
  store_uuid_fk?: string;
  store_name: string;
  store_logo: string;
  store_table_status: number;
}

type AuthStoreUuidSource = { store_uuid?: string; store_uuid_fk?: string } | null | undefined;
type NormalizableAuthUser = Omit<AuthUser, "store_uuid" | "store_uuid_fk" | "store_table_status"> &
  Partial<Pick<AuthUser, "store_uuid" | "store_uuid_fk" | "store_table_status">>;

interface PersistedAuthState {
  token?: string | null;
  user?: NormalizableAuthUser | null;
  isLoggedIn?: boolean;
  rememberMe?: boolean;
}

export function authStoreUuid(user: AuthStoreUuidSource) {
  return user?.store_uuid || user?.store_uuid_fk || "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeAuthUser(user: NormalizableAuthUser | null): AuthUser | null {
  if (!user) return user;
  const storeUuid = authStoreUuid(user);
  const storeTableStatus = Number(user.store_table_status) === 2 ? 2 : 1;
  return { ...user, store_uuid: storeUuid, store_uuid_fk: storeUuid, store_table_status: storeTableStatus };
}

function normalizePersistedAuthState(persistedState: unknown): PersistedAuthState {
  if (!isRecord(persistedState)) return {};
  const state = persistedState as PersistedAuthState;
  return {
    ...state,
    user: isRecord(state.user) ? normalizeAuthUser(state.user as NormalizableAuthUser) : null
  };
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isLoggedIn: boolean;
  rememberMe: boolean;
  hydrated: boolean;
  loading: boolean;
  error: string | null;
  login: (token: string, user: AuthUser, rememberMe?: boolean) => void;
  loginWithPassword: (email: string, password: string, rememberMe?: boolean) => Promise<AuthUser | null>;
  logout: () => void;
  updateUser: (updates: Partial<AuthUser>) => void;
  setHydrated: (hydrated: boolean) => void;
}

const STORAGE_KEY = "yummy-go-auth";
const isBrowser = typeof window !== "undefined";
let loginRequestId = 0;

function authenticatedState(token: string, user: AuthUser, rememberMe: boolean) {
  return {
    token,
    user: normalizeAuthUser(user),
    isLoggedIn: true,
    rememberMe,
    loading: false,
    error: null
  };
}

const dualStorage: StateStorage = {
  getItem: (name) => {
    if (!isBrowser) return null;
    return localStorage.getItem(name) ?? sessionStorage.getItem(name);
  },
  setItem: (name, value) => {
    if (!isBrowser) return;
    const parsed = JSON.parse(value) as { state?: { rememberMe?: boolean } };
    if (parsed.state?.rememberMe) {
      sessionStorage.removeItem(name);
      localStorage.setItem(name, value);
    } else {
      localStorage.removeItem(name);
      sessionStorage.setItem(name, value);
    }
  },
  removeItem: (name) => {
    if (!isBrowser) return;
    localStorage.removeItem(name);
    sessionStorage.removeItem(name);
  }
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isLoggedIn: false,
      rememberMe: false,
      hydrated: false,
      loading: false,
      error: null,
      login: (token, user, rememberMe = false) => {
        loginRequestId += 1;
        resetSessionStores();
        set(authenticatedState(token, user, rememberMe));
      },
      loginWithPassword: async (email, password, rememberMe = false) => {
        const requestId = ++loginRequestId;
        set({ loading: true, error: null });
        try {
          const result = await checkLogin(email, password);
          if (requestId !== loginRequestId) return null;

          resetSessionStores();
          set(authenticatedState(result.token, result.user, rememberMe));
          return result.user;
        } catch (error) {
          if (requestId !== loginRequestId) return null;

          set({ loading: false, error: errorMessage(error) });
          throw error;
        }
      },
      logout: () => {
        loginRequestId += 1;
        disconnectSocket();
        resetSessionStores();
        set({
          token: null,
          user: null,
          isLoggedIn: false,
          rememberMe: false,
          loading: false,
          error: null
        });
        dualStorage.removeItem(STORAGE_KEY);
      },
      updateUser: (updates) => {
        const user = get().user;
        if (user) set({ user: normalizeAuthUser({ ...user, ...updates }) });
      },
      setHydrated: (hydrated) => set({ hydrated })
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => dualStorage),
      version: 1,
      migrate: (persistedState) => normalizePersistedAuthState(persistedState),
      partialize: ({ token, user, isLoggedIn, rememberMe }) => ({
        token,
        user,
        isLoggedIn,
        rememberMe
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.user) state.updateUser(state.user);
        state?.setHydrated(true);
      }
    }
  )
);
