"use client";

import { create } from "zustand";
import {
  checkedSubmenuIds,
  fetchStorePermissionOptions,
  fetchStorePermissionSavedList,
  fetchStorePermissionTree,
  saveStorePermissions,
  type StorePermissionRole,
  type StorePermissionStore,
  type StorePermissionTree
} from "@/services/permissions/access";
import {
  createSessionGuard,
  registerSessionStoreReset
} from "@/stores/session-store-registry";
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
  loadOptions: (
    loginUuid: string,
    lang?: string
  ) => Promise<void>;
  loadTree: (
    viewerRoleId: number,
    lang?: string
  ) => Promise<void>;
  reset: () => void;
  resetChanges: () => void;
  save: (
    viewerRoleId: number,
    lang?: string
  ) => Promise<boolean>;
  clearAllSubmenus: () => void;
  selectAllSubmenus: () => void;
  setRole: (roleId: number) => void;
  setStore: (storeUuid: string) => void;
  toggleMenu: (
    menuId: string,
    checked: boolean
  ) => void;
  toggleSubmenu: (
    subId: string,
    checked: boolean
  ) => void;
}

function selectedSet(ids: string[]) {
  return new Set(ids);
}

function normalizeIds(ids: string[]) {
  return Array.from(
    new Set(ids.map(String).filter(Boolean))
  ).sort();
}

function sameIds(left: string[], right: string[]) {
  const a = normalizeIds(left);
  const b = normalizeIds(right);

  return (
    a.length === b.length &&
    a.every((id, index) => id === b[index])
  );
}

function allSubmenuIds(
  tree: StorePermissionTree | null,
  menuId: string
) {
  if (!tree) return [];

  return tree.roles.flatMap((role) =>
    role.menus
      .filter((menu) => menu.menu_id === menuId)
      .flatMap((menu) =>
        menu.sub_detail.map(
          (submenu) => submenu.sub_id
        )
      )
  );
}

function roleSubmenuIds(
  tree: StorePermissionTree | null,
  roleId: number | null
) {
  if (!tree || !roleId) return [];

  const role =
    tree.roles.find(
      (item) => item.role_id === roleId
    ) ?? tree.roles[0];

  return (
    role?.menus.flatMap((menu) =>
      menu.sub_detail.map(
        (submenu) => submenu.sub_id
      )
    ) ?? []
  );
}

let treeRequestId = 0;
let saveRequestId = 0;
const SAVE_VERIFICATION_MESSAGE = "The server returned different menu permissions after saving. Your selections have been kept.";

export const usePermissionsAccessStore =
  create<StorePermissionsState>((set, get) => ({
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

    loadOptions: async (loginUuid, lang) => {
      const isCurrentSession = createSessionGuard();

      set({
        error: null,
        loadingOptions: true
      });

      try {
        const { stores, roles } =
          await fetchStorePermissionOptions(
            loginUuid,
            lang
          );

        if (!isCurrentSession()) return;

        const currentStore =
          get().selectedStoreUuid;
        const currentRole =
          get().selectedRoleId;

        const selectedStoreUuid = stores.some(
          (store) =>
            store.store_uuid === currentStore
        )
          ? currentStore
          : stores[0]?.store_uuid ?? "";

        const selectedRoleId = roles.some(
          (role) =>
            role.roles_id === currentRole
        )
          ? currentRole
          : roles[0]?.roles_id ?? null;

        const selectionChanged =
          selectedStoreUuid !== currentStore ||
          selectedRoleId !== currentRole;

        if (selectionChanged) {
          treeRequestId += 1;
          saveRequestId += 1;
        }

        set({
          ...(selectionChanged
            ? {
                checkedSubIds: [],
                dirty: false,
                loadingSaved: false,
                loadingTree: false,
                savedCheckedSubIds: [],
                savedList: null,
                saving: false,
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
        if (isCurrentSession()) {
          set({
            error: errorMessage(error),
            loadingOptions: false
          });
        }

        throw error;
      }
    },

    loadTree: async (viewerRoleId, lang) => {
      const requestId = ++treeRequestId;
      const isCurrentSession = createSessionGuard();
      const {
        selectedRoleId,
        selectedStoreUuid
      } = get();
      const isCurrentRequest = () =>
        requestId === treeRequestId &&
        isCurrentSession() &&
        get().selectedStoreUuid === selectedStoreUuid &&
        get().selectedRoleId === selectedRoleId;

      if (
        !selectedStoreUuid ||
        !selectedRoleId
      ) {
        set({
          checkedSubIds: [],
          dirty: false,
          loadingSaved: false,
          loadingTree: false,
          savedCheckedSubIds: [],
          savedList: null,
          tree: null
        });
        return;
      }

      set({
        error: null,
        loadingSaved: true,
        loadingTree: true
      });

      try {
        const [tree, savedList] =
          await Promise.all([
            fetchStorePermissionTree(
              selectedStoreUuid,
              selectedRoleId,
              lang
            ),
            fetchStorePermissionSavedList(
              selectedStoreUuid,
              viewerRoleId,
              lang
            )
          ]);

        if (!isCurrentRequest()) return;

        const savedCheckedSubIds =
          checkedSubmenuIds(tree);

        set({
          checkedSubIds:
            savedCheckedSubIds,
          dirty: false,
          loadingSaved: false,
          loadingTree: false,
          savedCheckedSubIds,
          savedList,
          tree
        });
      } catch (error) {
        if (!isCurrentRequest()) return;
        set({
          error: errorMessage(error),
          loadingSaved: false,
          loadingTree: false
        });
        throw error;
      }
    },

    reset: () => {
      treeRequestId += 1;
      saveRequestId += 1;
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
      });
    },

    resetChanges: () =>
      set((state) => ({
        checkedSubIds:
          state.savedCheckedSubIds,
        dirty: false
      })),

    save: async (viewerRoleId, lang) => {
      const isCurrentSession =
        createSessionGuard();

      const {
        checkedSubIds,
        dirty,
        loadingSaved,
        loadingTree,
        selectedRoleId,
        selectedStoreUuid,
        saving,
        tree
      } = get();

      if (
        !selectedStoreUuid ||
        !selectedRoleId ||
        !dirty ||
        loadingSaved ||
        loadingTree ||
        saving ||
        !tree ||
        tree.company_uuid_fk !== selectedStoreUuid ||
        !tree.roles.some((role) => role.role_id === selectedRoleId)
      ) {
        return false;
      }

      const currentSaveRequestId = ++saveRequestId;
      let currentTreeRequestId = ++treeRequestId;
      let saved = false;
      const isCurrentSave = () =>
        currentSaveRequestId === saveRequestId &&
        isCurrentSession() &&
        get().selectedStoreUuid === selectedStoreUuid &&
        get().selectedRoleId === selectedRoleId;

      set({
        error: null,
        saving: true
      });

      try {
        await saveStorePermissions({
          company_uuid_fk:
            selectedStoreUuid,
          role_id: selectedRoleId,
          sub_id_list: checkedSubIds
        });

        saved = true;
        if (!isCurrentSave()) return false;

        // Reads started before the write completed may still contain the old policy.
        currentTreeRequestId = ++treeRequestId;
        set({ error: null, loadingSaved: true, loadingTree: true });
        const [savedTree, savedList] =
          await Promise.all([
            fetchStorePermissionTree(
              selectedStoreUuid,
              selectedRoleId,
              lang
            ),
            fetchStorePermissionSavedList(
              selectedStoreUuid,
              viewerRoleId,
              lang
            )
          ]);

        if (!isCurrentSave()) return false;
        if (currentTreeRequestId !== treeRequestId) {
          set({ saving: false });
          return false;
        }

        if (!savedTree || savedTree.company_uuid_fk !== selectedStoreUuid ||
          !savedTree.roles.some((role) => role.role_id === selectedRoleId)) {
          throw new Error(SAVE_VERIFICATION_MESSAGE);
        }
        const savedCheckedSubIds =
          checkedSubmenuIds(savedTree);

        if (!sameIds(checkedSubIds, savedCheckedSubIds)) {
          set({
            checkedSubIds: [...checkedSubIds],
            dirty: true,
            savedCheckedSubIds,
            savedList,
            tree: savedTree
          });
          throw new Error(SAVE_VERIFICATION_MESSAGE);
        }

        set({
          checkedSubIds:
            savedCheckedSubIds,
          dirty: false,
          loadingSaved: false,
          loadingTree: false,
          savedCheckedSubIds,
          savedList,
          saving: false,
          tree: savedTree
        });
        return true;
      } catch (error) {
        if (!isCurrentSave()) return false;
        const ownsTree = currentTreeRequestId === treeRequestId;
        set({
          ...(ownsTree ? {
            error: errorMessage(error),
            loadingSaved: false,
            loadingTree: false
          } : {}),
          saving: false
        });
        if (saved && !ownsTree) return false;
        throw error;
      }
    },

    clearAllSubmenus: () =>
      set((state) => ({
        checkedSubIds: [],
        dirty: !sameIds(
          [],
          state.savedCheckedSubIds
        )
      })),

    selectAllSubmenus: () =>
      set((state) => {
        const checkedSubIds =
          roleSubmenuIds(
            state.tree,
            state.selectedRoleId
          );

        return {
          checkedSubIds,
          dirty: !sameIds(
            checkedSubIds,
            state.savedCheckedSubIds
          )
        };
      }),

    setRole: (roleId) => {
      treeRequestId += 1;
      saveRequestId += 1;
      set({
        checkedSubIds: [],
        dirty: false,
        error: null,
        loadingSaved: false,
        loadingTree: false,
        savedCheckedSubIds: [],
        selectedRoleId: roleId,
        saving: false,
        tree: null
      });
    },

    setStore: (storeUuid) => {
      treeRequestId += 1;
      saveRequestId += 1;
      set({
        checkedSubIds: [],
        dirty: false,
        error: null,
        loadingSaved: false,
        loadingTree: false,
        savedCheckedSubIds: [],
        savedList: null,
        selectedStoreUuid: storeUuid,
        saving: false,
        tree: null
      });
    },

    toggleMenu: (menuId, checked) =>
      set((state) => {
        const ids = allSubmenuIds(
          state.tree,
          menuId
        );
        const next = selectedSet(
          state.checkedSubIds
        );

        ids.forEach((id) => {
          if (checked) {
            next.add(id);
          } else {
            next.delete(id);
          }
        });

        const checkedSubIds =
          Array.from(next);

        return {
          checkedSubIds,
          dirty: !sameIds(
            checkedSubIds,
            state.savedCheckedSubIds
          )
        };
      }),

    toggleSubmenu: (subId, checked) =>
      set((state) => {
        const next = selectedSet(
          state.checkedSubIds
        );

        if (checked) {
          next.add(subId);
        } else {
          next.delete(subId);
        }

        const checkedSubIds =
          Array.from(next);

        return {
          checkedSubIds,
          dirty: !sameIds(
            checkedSubIds,
            state.savedCheckedSubIds
          )
        };
      })
  }));

registerSessionStoreReset(
  "permissions-access",
  () =>
    usePermissionsAccessStore.getState().reset()
);
