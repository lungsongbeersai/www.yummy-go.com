"use client";

import { create } from "zustand";
import {
  checkedSubmenuIds,
  fetchStorePermissionRoles,
  fetchStorePermissionStores,
  fetchStorePermissionTree,
  saveStorePermissions,
  type StorePermissionRole,
  type StorePermissionStore,
  type StorePermissionTree
} from "@/services/store-permissions";
import { errorMessage } from "@/stores/store-utils";

interface StorePermissionsState {
  checkedSubIds: string[];
  error: string | null;
  loadingOptions: boolean;
  loadingTree: boolean;
  roles: StorePermissionRole[];
  saving: boolean;
  selectedRoleId: number | null;
  selectedStoreUuid: string;
  stores: StorePermissionStore[];
  tree: StorePermissionTree | null;
  loadOptions: (lang?: string) => Promise<void>;
  loadTree: (lang?: string) => Promise<void>;
  reset: () => void;
  save: (lang?: string) => Promise<void>;
  setRole: (roleId: number) => void;
  setStore: (storeUuid: string) => void;
  toggleMenu: (menuId: string, checked: boolean) => void;
  toggleSubmenu: (subId: string, checked: boolean) => void;
}

function selectedSet(ids: string[]) {
  return new Set(ids);
}

function allSubmenuIds(tree: StorePermissionTree | null, menuId: string) {
  if (!tree) return [];
  return tree.roles.flatMap((role) =>
    role.menus
      .filter((menu) => menu.menu_id === menuId)
      .flatMap((menu) => menu.sub_detail.map((submenu) => submenu.sub_id))
  );
}

export const useStorePermissionsStore = create<StorePermissionsState>((set, get) => ({
  checkedSubIds: [],
  error: null,
  loadingOptions: false,
  loadingTree: false,
  roles: [],
  saving: false,
  selectedRoleId: null,
  selectedStoreUuid: "",
  stores: [],
  tree: null,
  loadOptions: async (lang) => {
    set({ error: null, loadingOptions: true });
    try {
      const [stores, roles] = await Promise.all([
        fetchStorePermissionStores(lang),
        fetchStorePermissionRoles(lang)
      ]);
      const currentStore = get().selectedStoreUuid;
      const currentRole = get().selectedRoleId;
      const selectedStoreUuid = stores.some((store) => store.store_uuid === currentStore)
        ? currentStore
        : stores[0]?.store_uuid ?? "";
      const selectedRoleId = roles.some((role) => role.roles_id === currentRole)
        ? currentRole
        : roles[0]?.roles_id ?? null;

      set({
        loadingOptions: false,
        roles,
        selectedRoleId,
        selectedStoreUuid,
        stores
      });
    } catch (error) {
      set({ error: errorMessage(error), loadingOptions: false });
      throw error;
    }
  },
  loadTree: async (lang) => {
    const { selectedRoleId, selectedStoreUuid } = get();
    if (!selectedStoreUuid || !selectedRoleId) {
      set({ checkedSubIds: [], tree: null });
      return;
    }

    set({ error: null, loadingTree: true });
    try {
      const tree = await fetchStorePermissionTree(selectedStoreUuid, selectedRoleId, lang);
      set({
        checkedSubIds: checkedSubmenuIds(tree),
        loadingTree: false,
        tree
      });
    } catch (error) {
      set({ error: errorMessage(error), loadingTree: false });
      throw error;
    }
  },
  reset: () =>
    set({
      checkedSubIds: [],
      error: null,
      loadingOptions: false,
      loadingTree: false,
      roles: [],
      saving: false,
      selectedRoleId: null,
      selectedStoreUuid: "",
      stores: [],
      tree: null
    }),
  save: async (lang) => {
    const { checkedSubIds, selectedRoleId, selectedStoreUuid } = get();
    if (!selectedStoreUuid || !selectedRoleId) return;

    set({ error: null, saving: true });
    try {
      await saveStorePermissions({
        company_uuid_fk: selectedStoreUuid,
        role_id: selectedRoleId,
        sub_id_list: checkedSubIds
      });
      set({ saving: false });
      await get().loadTree(lang);
    } catch (error) {
      set({ error: errorMessage(error), saving: false });
      throw error;
    }
  },
  setRole: (roleId) => set({ checkedSubIds: [], selectedRoleId: roleId, tree: null }),
  setStore: (storeUuid) => set({ checkedSubIds: [], selectedStoreUuid: storeUuid, tree: null }),
  toggleMenu: (menuId, checked) =>
    set((state) => {
      const ids = allSubmenuIds(state.tree, menuId);
      const next = selectedSet(state.checkedSubIds);
      ids.forEach((id) => {
        if (checked) next.add(id);
        else next.delete(id);
      });
      return { checkedSubIds: Array.from(next) };
    }),
  toggleSubmenu: (subId, checked) =>
    set((state) => {
      const next = selectedSet(state.checkedSubIds);
      if (checked) next.add(subId);
      else next.delete(subId);
      return { checkedSubIds: Array.from(next) };
    })
}));
