"use client";

import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { toLanguage } from "@/lib/language";
import {
  fetchSidebarPermissionMenu,
  type SidebarPermissionMenuItem
} from "@/services/sidebar-menu";
import { errorMessage } from "@/stores/store-utils";

interface SidebarMenuState {
  cache: Record<string, SidebarPermissionMenuItem[]>;
  error: string | null;
  items: SidebarPermissionMenuItem[];
  loading: boolean;
  requestKey: string;
  clearActive: () => void;
  load: (companyUuid: string, roleId: number, lang?: string) => Promise<void>;
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

export const useSidebarMenuStore = create<SidebarMenuState>()(
  persist(
    (set, get) => ({
      ...initialState,
      clearActive: () => set({ error: null, items: [], loading: false, requestKey: "" }),
      load: async (companyUuid, roleId, lang) => {
        const requestKey = sidebarMenuCacheKey(companyUuid, roleId, lang);
        const cachedItems = get().cache[requestKey] ?? [];
        set({ error: null, items: cachedItems, loading: true, requestKey });

        try {
          const items = await fetchSidebarPermissionMenu({ companyUuid, lang, roleId });
          set((state) => ({
            cache: { ...state.cache, [requestKey]: items },
            error: null,
            items,
            loading: false,
            requestKey
          }));
        } catch (error) {
          set({
            error: errorMessage(error),
            items: get().cache[requestKey] ?? [],
            loading: false,
            requestKey
          });
        }
      },
      reset: () => set(initialState)
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => sidebarMenuStorage),
      partialize: ({ cache }) => ({ cache })
    }
  )
);
