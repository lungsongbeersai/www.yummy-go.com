"use client";

import { create } from "zustand";
import {
  checkedSubmenuIds,
  fetchStorePermissionSavedList,
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
  dirty: boolean;
  error: string | null;
  loadingOptions: boolean;
  loadingSaved: boolean;
  loadingTree: boolean;
  roles: StorePermissionRole[];
  savedCheckedSubIds: string[];
  savedList: StorePermissionTree | null;
  saving: boolean;
  selectedRoleId: number | null;
  selectedStoreUuid: string;
  stores: StorePermissionStore[];
  tree: StorePermissionTree | null;
  loadOptions: (userStatus: number, lang?: string) => Promise<void>;
  loadTree: (viewerRoleId: number, lang?: string) => Promise<void>;
  reset: () => void;
  resetChanges: () => void;
  save: (viewerRoleId: number, lang?: string) => Promise<void>;
  setRole: (roleId: number) => void;
  setStore: (storeUuid: string) => void;
  toggleMenu: (menuId: string, checked: boolean) => void;
  toggleSubmenu: (subId: string, checked: boolean) => void;
}

function selectedSet(ids: string[]) {
  return new Set(ids);
}

function normalizeIds(ids: string[]) {
  return Array.from(new Set(ids.map(String).filter(Boolean))).sort();
}

function sameIds(left: string[], right: string[]) {
  const a = normalizeIds(left);
  const b = normalizeIds(right);
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

function storeStatusForUser(status: number) {
  return Number(status) === 1 ? 1 : 2;
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
  dirty: false,
  error: null,
  loadingOptions: false,
  loadingSaved: false,
  loadingTree: false,
  roles: [],
  savedCheckedSubIds: [],
  savedList: null,
  saving: false,
  selectedRoleId: null,
  selectedStoreUuid: "",
  stores: [],
  tree: null,
  loadOptions: async (userStatus, lang) => {
    set({ error: null, loadingOptions: true });
    try {
      const [stores, roles] = await Promise.all([
        fetchStorePermissionStores(storeStatusForUser(userStatus), lang),
        fetchStorePermissionRoles(userStatus, lang)
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
        ...(selectedStoreUuid !== currentStore || selectedRoleId !== currentRole
          ? {
            checkedSubIds: [],
            dirty: false,
            savedCheckedSubIds: [],
            savedList: null,
            tree: null
          }
          : {}),
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
  loadTree: async (viewerRoleId, lang) => {
    const { selectedRoleId, selectedStoreUuid } = get();
    if (!selectedStoreUuid || !selectedRoleId) {
      set({
        checkedSubIds: [],
        dirty: false,
        savedCheckedSubIds: [],
        savedList: null,
        tree: null
      });
      return;
    }

    set({ error: null, loadingSaved: true, loadingTree: true });
    try {
      const [tree, savedList] = await Promise.all([
        fetchStorePermissionTree(selectedStoreUuid, selectedRoleId, lang),
        fetchStorePermissionSavedList(selectedStoreUuid, viewerRoleId, lang)
      ]);
      const savedCheckedSubIds = checkedSubmenuIds(tree);
      set({
        checkedSubIds: savedCheckedSubIds,
        dirty: false,
        loadingSaved: false,
        loadingTree: false,
        savedCheckedSubIds,
        savedList,
        tree
      });
    } catch (error) {
      set({ error: errorMessage(error), loadingSaved: false, loadingTree: false });
      throw error;
    }
  },
  reset: () =>
    set({
      checkedSubIds: [],
      dirty: false,
      error: null,
      loadingOptions: false,
      loadingSaved: false,
      loadingTree: false,
      roles: [],
      savedCheckedSubIds: [],
      savedList: null,
      saving: false,
      selectedRoleId: null,
      selectedStoreUuid: "",
      stores: [],
      tree: null
    }),
  resetChanges: () =>
    set((state) => ({
      checkedSubIds: state.savedCheckedSubIds,
      dirty: false
    })),
  save: async (viewerRoleId, lang) => {
    const { checkedSubIds, dirty, selectedRoleId, selectedStoreUuid } = get();
    if (!selectedStoreUuid || !selectedRoleId || !dirty) return;

    set({ error: null, saving: true });
    try {
      await saveStorePermissions({
        company_uuid_fk: selectedStoreUuid,
        role_id: selectedRoleId,
        sub_id_list: checkedSubIds
      });
      const [tree, savedList] = await Promise.all([
        fetchStorePermissionTree(selectedStoreUuid, selectedRoleId, lang),
        fetchStorePermissionSavedList(selectedStoreUuid, viewerRoleId, lang)
      ]);
      const savedCheckedSubIds = checkedSubmenuIds(tree);
      set({
        checkedSubIds: savedCheckedSubIds,
        dirty: false,
        savedCheckedSubIds,
        savedList,
        saving: false,
        tree
      });
    } catch (error) {
      set({ error: errorMessage(error), saving: false });
      throw error;
    }
  },
  setRole: (roleId) =>
    set({
      checkedSubIds: [],
      dirty: false,
      savedCheckedSubIds: [],
      selectedRoleId: roleId,
      tree: null
    }),
  setStore: (storeUuid) =>
    set({
      checkedSubIds: [],
      dirty: false,
      savedCheckedSubIds: [],
      savedList: null,
      selectedStoreUuid: storeUuid,
      tree: null
    }),
  toggleMenu: (menuId, checked) =>
    set((state) => {
      const ids = allSubmenuIds(state.tree, menuId);
      const next = selectedSet(state.checkedSubIds);
      ids.forEach((id) => {
        if (checked) next.add(id);
        else next.delete(id);
      });
      const checkedSubIds = Array.from(next);
      return {
        checkedSubIds,
        dirty: !sameIds(checkedSubIds, state.savedCheckedSubIds)
      };
    }),
  toggleSubmenu: (subId, checked) =>
    set((state) => {
      const next = selectedSet(state.checkedSubIds);
      if (checked) next.add(subId);
      else next.delete(subId);
      const checkedSubIds = Array.from(next);
      return {
        checkedSubIds,
        dirty: !sameIds(checkedSubIds, state.savedCheckedSubIds)
      };
    })
}));
