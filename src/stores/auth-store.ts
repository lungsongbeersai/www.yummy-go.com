"use client";

import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { disconnectSocket } from "@/lib/socket";
import { checkLogin } from "@/services/login";
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
}

export function authStoreUuid(user: AuthUser | null | undefined) {
  return user?.store_uuid || user?.store_uuid_fk || "";
}

function normalizeAuthUser(user: AuthUser | null) {
  if (!user) return user;
  const storeUuid = authStoreUuid(user);
  return { ...user, store_uuid: storeUuid, store_uuid_fk: storeUuid };
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
  loginWithPassword: (email: string, password: string, rememberMe?: boolean) => Promise<AuthUser>;
  logout: () => void;
  updateUser: (updates: Partial<AuthUser>) => void;
  setHydrated: (hydrated: boolean) => void;
}

const STORAGE_KEY = "yummy-go-auth";
const isBrowser = typeof window !== "undefined";

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
      login: (token, user, rememberMe = false) =>
        set({ token, user: normalizeAuthUser(user), isLoggedIn: true, rememberMe, error: null }),
      loginWithPassword: async (email, password, rememberMe = false) => {
        set({ loading: true, error: null });
        try {
          const result = await checkLogin(email, password);
          get().login(result.token, result.user, rememberMe);
          set({ loading: false });
          return result.user;
        } catch (error) {
          set({ loading: false, error: errorMessage(error) });
          throw error;
        }
      },
      logout: () => {
        disconnectSocket();
        set({ token: null, user: null, isLoggedIn: false, rememberMe: false, error: null });
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
