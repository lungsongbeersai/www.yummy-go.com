"use client";

import { create } from "zustand";
import {
  createPermissionMainMenu,
  createPermissionSubMenu,
  deletePermissionMainMenu,
  deletePermissionSubMenu,
  fetchPermissionMenuTree,
  sortPermissionMainMenus,
  sortPermissionSubMenus,
  type CreateMainMenuInput,
  type CreateSubMenuInput,
  type PermissionMainMenu,
  type PermissionSubMenu
} from "@/services/permission-menu";
import { errorMessage } from "@/stores/store-utils";

interface PermissionMenuState {
  error: string | null;
  hasLoaded: boolean;
  loading: boolean;
  menus: PermissionMainMenu[];
  refreshing: boolean;
  saving: boolean;
  sorting: boolean;
  total: number;
  createMain: (input: CreateMainMenuInput, lang?: string) => Promise<void>;
  createSub: (input: CreateSubMenuInput, lang?: string) => Promise<void>;
  deleteMain: (menuId: string, lang?: string) => Promise<void>;
  deleteSub: (subId: string, lang?: string) => Promise<void>;
  load: (lang?: string, options?: { background?: boolean }) => Promise<void>;
  reset: () => void;
  sortMain: (menus: PermissionMainMenu[], lang?: string) => Promise<void>;
  sortSub: (menuId: string, submenus: PermissionSubMenu[], lang?: string) => Promise<void>;
}

function withSubmenuSort(menuId: string, submenus: PermissionSubMenu[]) {
  return submenus.map((submenu, index) => ({
    ...submenu,
    menu_id: submenu.menu_id || menuId,
    sub_sort: index + 1
  }));
}

export const usePermissionMenuStore = create<PermissionMenuState>((set, get) => ({
  error: null,
  hasLoaded: false,
  loading: false,
  menus: [],
  refreshing: false,
  saving: false,
  sorting: false,
  total: 0,
  createMain: async (input, lang) => {
    set({ error: null, saving: true });
    try {
      await createPermissionMainMenu(input);
      set({ saving: false });
      await get().load(lang, { background: true });
    } catch (error) {
      set({ error: errorMessage(error), saving: false });
      throw error;
    }
  },
  createSub: async (input, lang) => {
    set({ error: null, saving: true });
    try {
      await createPermissionSubMenu(input);
      set({ saving: false });
      await get().load(lang, { background: true });
    } catch (error) {
      set({ error: errorMessage(error), saving: false });
      throw error;
    }
  },
  deleteMain: async (menuId, lang) => {
    set({ error: null, saving: true });
    try {
      await deletePermissionMainMenu(menuId);
      set({ saving: false });
      await get().load(lang, { background: true });
    } catch (error) {
      set({ error: errorMessage(error), saving: false });
      throw error;
    }
  },
  deleteSub: async (subId, lang) => {
    set({ error: null, saving: true });
    try {
      await deletePermissionSubMenu(subId);
      set({ saving: false });
      await get().load(lang, { background: true });
    } catch (error) {
      set({ error: errorMessage(error), saving: false });
      throw error;
    }
  },
  load: async (lang, options) => {
    const background = Boolean(options?.background && get().hasLoaded);
    set({ error: null, loading: !background, refreshing: background });
    try {
      const result = await fetchPermissionMenuTree(lang);
      set({
        hasLoaded: true,
        loading: false,
        menus: result.menus,
        refreshing: false,
        total: result.total
      });
    } catch (error) {
      set({ error: errorMessage(error), loading: false, refreshing: false });
      throw error;
    }
  },
  reset: () => set({
    error: null,
    hasLoaded: false,
    loading: false,
    menus: [],
    refreshing: false,
    saving: false,
    sorting: false,
    total: 0
  }),
  sortMain: async (menus, lang) => {
    const previous = get().menus;
    const next = menus.map((menu, index) => ({ ...menu, menu_sort: index + 1 }));
    set({ error: null, menus: next, sorting: true });
    try {
      await sortPermissionMainMenus(next);
      set({ sorting: false });
      await get().load(lang, { background: true });
    } catch (error) {
      set({ error: errorMessage(error), menus: previous, sorting: false });
      throw error;
    }
  },
  sortSub: async (menuId, submenus, lang) => {
    const previous = get().menus;
    const sortedSubmenus = withSubmenuSort(menuId, submenus);
    const next = previous.map((menu) =>
      menu.menu_id === menuId ? { ...menu, sub_detail: sortedSubmenus } : menu
    );
    set({ error: null, menus: next, sorting: true });
    try {
      await sortPermissionSubMenus(menuId, sortedSubmenus);
      set({ sorting: false });
      await get().load(lang, { background: true });
    } catch (error) {
      set({ error: errorMessage(error), menus: previous, sorting: false });
      throw error;
    }
  }
}));
