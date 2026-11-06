"use client";

import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { toLanguage } from "@/lib/language";
import {
  fetchSidebarPermissionMenu,
  type SidebarPermissionMenuItem
} from "@/services/permissions/sidebar";
import { createSessionGuard, registerSessionStoreReset } from "@/stores/session-store-registry";
import { errorMessage } from "@/stores/store-utils";

interface SidebarMenuState {
  cache: Record<string, SidebarPermissionMenuItem[]>;
  error: string | null;
  items: SidebarPermissionMenuItem[];
  loading: boolean;
  requestKey: string;
  clearActive: () => void;
  load: (companyUuid: string, roleId: number, lang?: string) => Promise<void>;
  refreshPolicy: (companyUuid: string, roleId: number) => Promise<void>;
  reset: () => void;
}

const STORAGE_KEY = "yummy-go-sidebar-menu";
const isBrowser = typeof window !== "undefined";

const sidebarMenuStorage: StateStorage = {
  getItem: (name) => {
    if (!isBrowser) return null;
    return localStorage.getItem(name);
  },
  setItem: (name, value) => {
    if (!isBrowser) return;
    localStorage.setItem(name, value);
  },
  removeItem: (name) => {
    if (!isBrowser) return;
    localStorage.removeItem(name);
  }
};

export function sidebarMenuCacheKey(companyUuid: string, roleId: number, lang?: string) {
  return [companyUuid.trim(), Number(roleId), toLanguage(lang)].join(":");
}

const initialState = {
  cache: {},
  error: null,
  items: [],
  loading: false,
  requestKey: ""
};

let requestId = 0;
let pendingRequest: { id: number; key: string; promise: Promise<void> } | null = null;

export const usePermissionsSidebarStore = create<SidebarMenuState>()(
  persist(
    (set, get) => ({
      ...initialState,
      clearActive: () => {
        requestId += 1;
        pendingRequest = null;
        set({ error: null, items: [], loading: false, requestKey: "" });
      },
      load: (companyUuid, roleId, lang) => {
        const requestKey = sidebarMenuCacheKey(companyUuid, roleId, lang);
        if (pendingRequest?.key === requestKey && get().loading) return pendingRequest.promise;
        const currentRequestId = ++requestId;
        const isCurrentSession = createSessionGuard();
        // Keep an already verified menu during background refreshes. A restored
        // cache or different scope must be checked against the API first.
        const currentItems = get().requestKey === requestKey ? get().items : [];
        set({ error: null, items: currentItems, loading: true, requestKey });

        const promise = (async () => {
          try {
            const items = await fetchSidebarPermissionMenu({ companyUuid, lang, roleId });
            if (currentRequestId === requestId && isCurrentSession()) {
              set((state) => ({
                cache: { ...state.cache, [requestKey]: items },
                error: null,
                items,
                loading: false,
                requestKey
              }));
            }
          } catch (error) {
            if (currentRequestId === requestId && isCurrentSession()) {
              set((state) => ({
                cache: Object.fromEntries(Object.entries(state.cache).filter(([key]) => key !== requestKey)),
                error: errorMessage(error),
                items: [],
                loading: false,
                requestKey
              }));
            }
          } finally {
            if (pendingRequest?.id === currentRequestId) pendingRequest = null;
          }
        })();
        pendingRequest = { id: currentRequestId, key: requestKey, promise };
        return promise;
      },
      refreshPolicy: async (companyUuid, roleId) => {
        const prefix = `${companyUuid.trim()}:${Number(roleId)}:`;
        const activeKey = get().requestKey;
        set((state) => ({
          cache: Object.fromEntries(Object.entries(state.cache).filter(([key]) => !key.startsWith(prefix)))
        }));
        if (!activeKey.startsWith(prefix)) return;
        requestId += 1;
        pendingRequest = null;
        set({ error: null, items: [] });
        await get().load(companyUuid, roleId, activeKey.slice(prefix.length));
      },
      reset: () => {
        requestId += 1;
        pendingRequest = null;
        set(initialState);
      }
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => sidebarMenuStorage),
      partialize: ({ cache }) => ({ cache })
    }
  )
);

registerSessionStoreReset("permissions-sidebar", () => usePermissionsSidebarStore.getState().reset());
