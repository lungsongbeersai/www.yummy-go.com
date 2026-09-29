"use client";

import { create } from "zustand";
import {
  createPermissionMainMenu,
  createPermissionSubMenu,
  deletePermissionMainMenu,
  deletePermissionSubMenu,
  buildMoveSubMenuInput,
  buildPromotedMainMenuInput,
  fetchPermissionMenuTree,
  findSubMenuParent,
  PermissionSubMenuMoveError,
  sortPermissionMainMenus,
  sortPermissionSubMenus,
  type CreateMainMenuInput,
  type CreateSubMenuInput,
  type PermissionMainMenu,
  type PermissionSubMenu
} from "@/services/permissions/menu-admin";
import { createSessionGuard, registerSessionStoreReset } from "@/stores/session-store-registry";
import { errorMessage, type AsyncSlice } from "@/stores/store-utils";

interface PermissionMenuState extends AsyncSlice {
  hasLoaded: boolean;
  menus: PermissionMainMenu[];
  refreshing: boolean;
  sorting: boolean;
  total: number;
  createMain: (input: CreateMainMenuInput, lang?: string) => Promise<void>;
  createSub: (input: CreateSubMenuInput, lang?: string) => Promise<void>;
  deleteMain: (menuId: string, lang?: string) => Promise<void>;
  deleteSub: (subId: string, lang?: string) => Promise<void>;
  load: (lang?: string, options?: { background?: boolean }) => Promise<void>;
  /** Moves a submenu under another main menu, keeping its sub_id (and so its permissions). */
  moveSub: (subId: string, targetMenuId: string, lang?: string) => Promise<void>;
  /** Turns a submenu into a main menu of its own, placed right after its old main menu. */
  promoteSub: (subId: string, lang?: string) => Promise<void>;
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

function requireSubmenu(menus: PermissionMainMenu[], subId: string) {
  const parent = findSubMenuParent(menus, subId);
  const submenu = parent?.sub_detail.find((item) => item.sub_id === subId);
  if (!parent || !submenu) throw new Error("Submenu not found");
  return { parent, submenu };
}

// Saves the submenu under targetMenuId, then reads the tree back to prove the backend moved it:
// the create API is also its update API, and nothing documents that it honours a new menu_id.
// If the backend inserted a copy instead of moving, the copy is deleted again. On success the
// submenu goes last in its new main menu.
async function moveSubmenuAndVerify(submenu: PermissionSubMenu, targetMenuId: string, lang?: string) {
  const before = await fetchPermissionMenuTree(lang);
  const targetBefore = new Set(
    before.menus.find((menu) => menu.menu_id === targetMenuId)?.sub_detail.map((item) => item.sub_id) ?? []
  );
  await createPermissionSubMenu(buildMoveSubMenuInput(submenu, targetMenuId));
  const after = await fetchPermissionMenuTree(lang);
  const target = after.menus.find((menu) => menu.menu_id === targetMenuId);

  if (findSubMenuParent(after.menus, submenu.sub_id)?.menu_id !== targetMenuId) {
    const copies = (target?.sub_detail ?? []).filter((item) => !targetBefore.has(item.sub_id));
    await Promise.all(copies.map((copy) => deletePermissionSubMenu(copy.sub_id)));
    throw new PermissionSubMenuMoveError();
  }

  const siblings = (target?.sub_detail ?? []).filter((item) => item.sub_id !== submenu.sub_id);
  await sortPermissionSubMenus(targetMenuId, [...siblings, submenu]);
}

export const usePermissionsMenuStore = create<PermissionMenuState>((set, get) => ({
  error: null,
  hasLoaded: false,
  loading: false,
  menus: [],
  refreshing: false,
  saving: false,
  sorting: false,
  total: 0,
  createMain: async (input, lang) => {
    const isCurrentSession = createSessionGuard();
    set({ error: null, saving: true });
    try {
      await createPermissionMainMenu(input);
      if (!isCurrentSession()) return;
      set({ saving: false });
      await get().load(lang, { background: true });
    } catch (error) {
      if (isCurrentSession()) set({ error: errorMessage(error), saving: false });
      throw error;
    }
  },
  createSub: async (input, lang) => {
    const isCurrentSession = createSessionGuard();
    set({ error: null, saving: true });
    try {
      await createPermissionSubMenu(input);
      if (!isCurrentSession()) return;
      set({ saving: false });
      await get().load(lang, { background: true });
    } catch (error) {
      if (isCurrentSession()) set({ error: errorMessage(error), saving: false });
      throw error;
    }
  },
  deleteMain: async (menuId, lang) => {
    const isCurrentSession = createSessionGuard();
    set({ error: null, saving: true });
    try {
      await deletePermissionMainMenu(menuId);
      if (!isCurrentSession()) return;
      set({ saving: false });
      await get().load(lang, { background: true });
    } catch (error) {
      if (isCurrentSession()) set({ error: errorMessage(error), saving: false });
      throw error;
    }
  },
  deleteSub: async (subId, lang) => {
    const isCurrentSession = createSessionGuard();
    set({ error: null, saving: true });
    try {
      await deletePermissionSubMenu(subId);
      if (!isCurrentSession()) return;
      set({ saving: false });
      await get().load(lang, { background: true });
    } catch (error) {
      if (isCurrentSession()) set({ error: errorMessage(error), saving: false });
      throw error;
    }
  },
  load: async (lang, options) => {
    const isCurrentSession = createSessionGuard();
    const background = Boolean(options?.background && get().hasLoaded);
    set({ error: null, loading: !background, refreshing: background });
    try {
      const result = await fetchPermissionMenuTree(lang);
      if (isCurrentSession()) {
        set({
          hasLoaded: true,
          loading: false,
          menus: result.menus,
          refreshing: false,
          total: result.total
        });
      }
    } catch (error) {
      if (isCurrentSession()) {
        set({ error: errorMessage(error), loading: false, refreshing: false });
      }
      throw error;
    }
  },
  moveSub: async (subId, targetMenuId, lang) => {
    const isCurrentSession = createSessionGuard();
    set({ error: null, saving: true });
    try {
      const { submenu } = requireSubmenu(get().menus, subId);
      await moveSubmenuAndVerify(submenu, targetMenuId, lang);
      if (!isCurrentSession()) return;
      set({ saving: false });
      await get().load(lang, { background: true });
    } catch (error) {
      if (isCurrentSession()) set({ error: errorMessage(error), saving: false });
      throw error;
    }
  },
  promoteSub: async (subId, lang) => {
    const isCurrentSession = createSessionGuard();
    set({ error: null, saving: true });
    try {
      const { parent, submenu } = requireSubmenu(get().menus, subId);
      const existingIds = new Set(get().menus.map((menu) => menu.menu_id));
      const created = await createPermissionMainMenu(buildPromotedMainMenuInput(submenu, parent.menu_icon));
      // Fall back to finding the new record when the create response carries no id.
      const menuId =
        created?.menu_id ||
        (await fetchPermissionMenuTree(lang)).menus.find(
          (menu) => !existingIds.has(menu.menu_id) && menu.menu_path === submenu.sub_path
        )?.menu_id;
      if (!menuId) throw new Error("The new main menu was not found");

      try {
        await moveSubmenuAndVerify(submenu, menuId, lang);
      } catch (error) {
        // Don't leave an empty main menu behind.
        await deletePermissionMainMenu(menuId).catch(() => undefined);
        throw error;
      }

      const { menus } = await fetchPermissionMenuTree(lang);
      const promoted = menus.find((menu) => menu.menu_id === menuId);
      const rest = menus.filter((menu) => menu.menu_id !== menuId);
      const parentIndex = rest.findIndex((menu) => menu.menu_id === parent.menu_id);
      if (promoted && parentIndex >= 0) {
        await sortPermissionMainMenus([...rest.slice(0, parentIndex + 1), promoted, ...rest.slice(parentIndex + 1)]);
      }
      if (!isCurrentSession()) return;
      set({ saving: false });
      await get().load(lang, { background: true });
    } catch (error) {
      if (isCurrentSession()) set({ error: errorMessage(error), saving: false });
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
    const isCurrentSession = createSessionGuard();
    const previous = get().menus;
    const next = menus.map((menu, index) => ({ ...menu, menu_sort: index + 1 }));
    set({ error: null, menus: next, sorting: true });
    try {
      await sortPermissionMainMenus(next);
      if (!isCurrentSession()) return;
      set({ sorting: false });
      await get().load(lang, { background: true });
    } catch (error) {
      if (isCurrentSession()) {
        set({ error: errorMessage(error), menus: previous, sorting: false });
      }
      throw error;
    }
  },
  sortSub: async (menuId, submenus, lang) => {
    const isCurrentSession = createSessionGuard();
    const previous = get().menus;
    const sortedSubmenus = withSubmenuSort(menuId, submenus);
    const next = previous.map((menu) =>
      menu.menu_id === menuId ? { ...menu, sub_detail: sortedSubmenus } : menu
    );
    set({ error: null, menus: next, sorting: true });
    try {
      await sortPermissionSubMenus(menuId, sortedSubmenus);
      if (!isCurrentSession()) return;
      set({ sorting: false });
      await get().load(lang, { background: true });
    } catch (error) {
      if (isCurrentSession()) {
        set({ error: errorMessage(error), menus: previous, sorting: false });
      }
      throw error;
    }
  }
}));

registerSessionStoreReset("permissions-menu", () => usePermissionsMenuStore.getState().reset());
