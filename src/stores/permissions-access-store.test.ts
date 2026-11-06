import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchStorePermissionSavedList,
  fetchStorePermissionTree,
  saveStorePermissions,
  type StorePermissionTree
} from "@/services/permissions/access";
import { usePermissionsAccessStore } from "@/stores/permissions-access-store";
import { resetSessionStores } from "@/stores/session-store-registry";

vi.mock("@/services/permissions/access", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/permissions/access")>();
  return {
    ...actual,
    fetchStorePermissionSavedList: vi.fn(),
    fetchStorePermissionTree: vi.fn(),
    saveStorePermissions: vi.fn()
  };
});

const MANAGE_MENU_SUB_ID = "d01dcd72-6da2-495b-a56f-54a58bcec6f8";
const USER_SUB_ID = "6dab4efe-65b5-4ea9-80fe-a31762ee3f6c";
const OTHER_ROLE_SUB_ID = "ab3f0030-2186-41ca-a52c-d6acb72f708e";

const fetchStorePermissionSavedListMock = vi.mocked(fetchStorePermissionSavedList);
const fetchStorePermissionTreeMock = vi.mocked(fetchStorePermissionTree);
const saveStorePermissionsMock = vi.mocked(saveStorePermissions);

function permissionTree(checked = false): StorePermissionTree {
  return {
    company_uuid_fk: "store-1",
    roles: [
      {
        menus: [
          {
            menu_badge: 1,
            menu_icon: "settings",
            menu_id: "setting",
            menu_path: "/setting",
            menu_sort: 1,
            menu_status: 1,
            menu_title: "Setting",
            sub_detail: [
              {
                checked,
                sub_id: MANAGE_MENU_SUB_ID,
                sub_path: "/setting/manage-menu",
                sub_sort: 18,
                sub_status: 1,
                sub_title: "Manage Menu"
              }
            ]
          }
        ],
        role_id: 1,
        role_name: "Super Admin",
        roles_name: "Super Admin",
        roles_name_eng: "Super Admin"
      }
    ],
    store_active: 1,
    store_name: "Store",
    store_name_eng: "Store",
    store_name_la: "Store",
    store_status: 1
  };
}

function multiRolePermissionTree(): StorePermissionTree {
  const tree = permissionTree(false);
  return {
    ...tree,
    roles: [
      {
        ...tree.roles[0],
        menus: [
          {
            ...tree.roles[0].menus[0],
            sub_detail: [
              ...tree.roles[0].menus[0].sub_detail,
              {
                checked: false,
                sub_id: USER_SUB_ID,
                sub_path: "/setting/user",
                sub_sort: 16,
                sub_status: 1,
                sub_title: "User"
              }
            ]
          }
        ]
      },
      {
        menus: [
          {
            menu_badge: 2,
            menu_icon: "shopping-cart",
            menu_id: "sales",
            menu_path: "/sale",
            menu_sort: 2,
            menu_status: 1,
            menu_title: "Sales",
            sub_detail: [
              {
                checked: false,
                sub_id: OTHER_ROLE_SUB_ID,
                sub_path: "/sales/sales-list",
                sub_sort: 1,
                sub_status: 1,
                sub_title: "Sales list"
              }
            ]
          }
        ],
        role_id: 2,
        role_name: "Staff",
        roles_name: "Staff",
        roles_name_eng: "Staff"
      }
    ]
  };
}

function scopedTree(store: string, role: number, checked = true): StorePermissionTree {
  const tree = permissionTree(checked);
  return {
    ...tree,
    company_uuid_fk: store,
    roles: tree.roles.map((entry) => ({ ...entry, role_id: role }))
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, reject, resolve };
}

function editableScope(store = "store-1", role = 1) {
  usePermissionsAccessStore.setState({
    checkedSubIds: [MANAGE_MENU_SUB_ID],
    dirty: true,
    selectedRoleId: role,
    selectedStoreUuid: store,
    tree: scopedTree(store, role, false)
  });
}

describe("permissions access store", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    fetchStorePermissionSavedListMock.mockResolvedValue(null);
    saveStorePermissionsMock.mockResolvedValue(undefined);
    usePermissionsAccessStore.getState().reset();
  });

  it("tracks the Manage Menu submenu id when toggled", () => {
    usePermissionsAccessStore.setState({
      savedCheckedSubIds: [],
      tree: permissionTree(false)
    });

    usePermissionsAccessStore.getState().toggleSubmenu(MANAGE_MENU_SUB_ID, true);

    expect(usePermissionsAccessStore.getState().checkedSubIds).toEqual([MANAGE_MENU_SUB_ID]);
    expect(usePermissionsAccessStore.getState().dirty).toBe(true);

    usePermissionsAccessStore.getState().toggleSubmenu(MANAGE_MENU_SUB_ID, false);

    expect(usePermissionsAccessStore.getState().checkedSubIds).toEqual([]);
    expect(usePermissionsAccessStore.getState().dirty).toBe(false);
  });

  it("saves Manage Menu through sub_id_list", async () => {
    const savedTree = permissionTree(true);
    fetchStorePermissionSavedListMock.mockResolvedValue(savedTree);
    fetchStorePermissionTreeMock.mockResolvedValue(savedTree);
    saveStorePermissionsMock.mockResolvedValue(undefined);
    usePermissionsAccessStore.setState({
      checkedSubIds: [MANAGE_MENU_SUB_ID],
      dirty: true,
      savedCheckedSubIds: [],
      selectedRoleId: 1,
      selectedStoreUuid: "store-1",
      tree: permissionTree(false)
    });

    await expect(usePermissionsAccessStore.getState().save(1, "la")).resolves.toBe(true);

    expect(saveStorePermissionsMock).toHaveBeenCalledWith({
      company_uuid_fk: "store-1",
      role_id: 1,
      sub_id_list: [MANAGE_MENU_SUB_ID]
    });
    expect(usePermissionsAccessStore.getState().checkedSubIds).toEqual([MANAGE_MENU_SUB_ID]);
    expect(usePermissionsAccessStore.getState().dirty).toBe(false);
  });

  it("keeps the requested draft dirty when an acknowledged save reads back broader grants", async () => {
    const observedTree = multiRolePermissionTree();
    observedTree.roles = observedTree.roles.filter((role) => role.role_id === 1).map((role) => ({
      ...role,
      menus: role.menus.map((menu) => ({
        ...menu,
        sub_detail: menu.sub_detail.map((submenu) => ({ ...submenu, checked: true }))
      }))
    }));
    fetchStorePermissionTreeMock.mockResolvedValueOnce(observedTree);
    fetchStorePermissionSavedListMock.mockResolvedValueOnce(observedTree);
    editableScope();

    await expect(usePermissionsAccessStore.getState().save(1)).rejects.toThrow("different menu permissions after saving");

    expect(saveStorePermissionsMock).toHaveBeenCalledTimes(1);
    expect(fetchStorePermissionTreeMock).toHaveBeenCalledTimes(1);
    expect(usePermissionsAccessStore.getState()).toMatchObject({
      checkedSubIds: [MANAGE_MENU_SUB_ID], dirty: true,
      savedCheckedSubIds: [MANAGE_MENU_SUB_ID, USER_SUB_ID],
      tree: observedTree, saving: false, loadingSaved: false, loadingTree: false
    });
    expect(usePermissionsAccessStore.getState().error).toContain("Your selections have been kept");
  });

  it("verifies matching read-back grants as a set despite ordering and duplicate requested IDs", async () => {
    const observedTree = multiRolePermissionTree();
    observedTree.roles = observedTree.roles.filter((role) => role.role_id === 1).map((role) => ({
      ...role,
      menus: role.menus.map((menu) => ({
        ...menu,
        sub_detail: menu.sub_detail.map((submenu) => ({ ...submenu, checked: true }))
      }))
    }));
    fetchStorePermissionTreeMock.mockResolvedValueOnce(observedTree);
    editableScope();
    usePermissionsAccessStore.setState({ checkedSubIds: [USER_SUB_ID, MANAGE_MENU_SUB_ID, USER_SUB_ID] });

    await expect(usePermissionsAccessStore.getState().save(1)).resolves.toBe(true);

    expect(saveStorePermissionsMock).toHaveBeenCalledWith({
      company_uuid_fk: "store-1", role_id: 1, sub_id_list: [USER_SUB_ID, MANAGE_MENU_SUB_ID, USER_SUB_ID]
    });
    expect(usePermissionsAccessStore.getState()).toMatchObject({
      checkedSubIds: [MANAGE_MENU_SUB_ID, USER_SUB_ID], dirty: false, saving: false, error: null
    });
  });

  it.each(["matching", "missing"] as const)("validates an empty selection against a %s role tree", async (response) => {
    editableScope();
    usePermissionsAccessStore.setState({ checkedSubIds: [], savedCheckedSubIds: [MANAGE_MENU_SUB_ID] });
    fetchStorePermissionTreeMock.mockResolvedValueOnce(response === "matching" ? scopedTree("store-1", 1, false) : null);
    const pendingSave = usePermissionsAccessStore.getState().save(1);
    if (response === "matching") await expect(pendingSave).resolves.toBe(true);
    else await expect(pendingSave).rejects.toThrow("different menu permissions after saving");

    expect(usePermissionsAccessStore.getState()).toMatchObject({ checkedSubIds: [], dirty: response === "missing", saving: false });
  });

  it.each(["store", "role"] as const)("rejects a read-back tree for a different %s even if its IDs match", async (mismatch) => {
    editableScope();
    fetchStorePermissionTreeMock.mockResolvedValueOnce(scopedTree(mismatch === "store" ? "store-2" : "store-1", mismatch === "role" ? 3 : 1));
    await expect(usePermissionsAccessStore.getState().save(1)).rejects.toThrow("different menu permissions after saving");
    expect(usePermissionsAccessStore.getState()).toMatchObject({
      checkedSubIds: [MANAGE_MENU_SUB_ID], dirty: true, saving: false,
      tree: { company_uuid_fk: "store-1", roles: [{ role_id: 1 }] }
    });
  });

  it("selects every submenu for the current role only", () => {
    usePermissionsAccessStore.setState({
      savedCheckedSubIds: [],
      selectedRoleId: 1,
      tree: multiRolePermissionTree()
    });

    usePermissionsAccessStore.getState().selectAllSubmenus();

    expect(usePermissionsAccessStore.getState().checkedSubIds).toEqual([
      MANAGE_MENU_SUB_ID,
      USER_SUB_ID
    ]);
    expect(usePermissionsAccessStore.getState().checkedSubIds).not.toContain(OTHER_ROLE_SUB_ID);
    expect(usePermissionsAccessStore.getState().dirty).toBe(true);
  });

  it("marks select all clean when it matches saved permissions", () => {
    usePermissionsAccessStore.setState({
      checkedSubIds: [],
      dirty: true,
      savedCheckedSubIds: [MANAGE_MENU_SUB_ID, USER_SUB_ID],
      selectedRoleId: 1,
      tree: multiRolePermissionTree()
    });

    usePermissionsAccessStore.getState().selectAllSubmenus();

    expect(usePermissionsAccessStore.getState().checkedSubIds).toEqual([
      MANAGE_MENU_SUB_ID,
      USER_SUB_ID
    ]);
    expect(usePermissionsAccessStore.getState().dirty).toBe(false);
  });

  it("clears all submenu selections and updates dirty state", () => {
    usePermissionsAccessStore.setState({
      checkedSubIds: [MANAGE_MENU_SUB_ID, USER_SUB_ID],
      savedCheckedSubIds: [MANAGE_MENU_SUB_ID],
      selectedRoleId: 1,
      tree: multiRolePermissionTree()
    });

    usePermissionsAccessStore.getState().clearAllSubmenus();

    expect(usePermissionsAccessStore.getState().checkedSubIds).toEqual([]);
    expect(usePermissionsAccessStore.getState().dirty).toBe(true);
  });

  it("marks clear all clean when saved permissions are empty", () => {
    usePermissionsAccessStore.setState({
      checkedSubIds: [MANAGE_MENU_SUB_ID],
      dirty: true,
      savedCheckedSubIds: [],
      selectedRoleId: 1,
      tree: multiRolePermissionTree()
    });

    usePermissionsAccessStore.getState().clearAllSubmenus();

    expect(usePermissionsAccessStore.getState().checkedSubIds).toEqual([]);
    expect(usePermissionsAccessStore.getState().dirty).toBe(false);
  });

  it("keeps the selected role and its unsaved ticks when an older role response arrives last", async () => {
    const older = deferred<StorePermissionTree | null>();
    const newer = deferred<StorePermissionTree | null>();
    fetchStorePermissionTreeMock.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
    usePermissionsAccessStore.setState({ selectedStoreUuid: "store-1", selectedRoleId: 1 });
    const previousLoad = usePermissionsAccessStore.getState().loadTree(1);
    usePermissionsAccessStore.getState().setRole(3);
    const selectedLoad = usePermissionsAccessStore.getState().loadTree(1);
    const selectedTree = scopedTree("store-1", 3, false);
    newer.resolve(selectedTree);
    await selectedLoad;
    usePermissionsAccessStore.getState().toggleSubmenu(MANAGE_MENU_SUB_ID, true);
    older.resolve(scopedTree("store-1", 1));
    await previousLoad;

    expect(usePermissionsAccessStore.getState()).toMatchObject({
      selectedRoleId: 3, tree: selectedTree, checkedSubIds: [MANAGE_MENU_SUB_ID],
      savedCheckedSubIds: [], dirty: true, loadingSaved: false, loadingTree: false
    });
  });

  it("keeps the latest refresh when two requests target the same store and role", async () => {
    const older = deferred<StorePermissionTree | null>();
    const newer = deferred<StorePermissionTree | null>();
    fetchStorePermissionTreeMock.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
    usePermissionsAccessStore.setState({ selectedStoreUuid: "store-1", selectedRoleId: 1 });
    const previousLoad = usePermissionsAccessStore.getState().loadTree(1);
    const selectedLoad = usePermissionsAccessStore.getState().loadTree(1);
    newer.resolve(scopedTree("store-1", 1, false));
    await selectedLoad;
    older.resolve(scopedTree("store-1", 1, true));
    await previousLoad;

    expect(usePermissionsAccessStore.getState().checkedSubIds).toEqual([]);
    expect(usePermissionsAccessStore.getState().savedCheckedSubIds).toEqual([]);
  });

  it("ignores a stale failure without clearing the current request's loading state", async () => {
    const older = deferred<StorePermissionTree | null>();
    const newer = deferred<StorePermissionTree | null>();
    fetchStorePermissionTreeMock.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
    usePermissionsAccessStore.setState({ selectedStoreUuid: "store-1", selectedRoleId: 1 });
    const previousLoad = usePermissionsAccessStore.getState().loadTree(1);
    usePermissionsAccessStore.getState().setRole(3);
    const selectedLoad = usePermissionsAccessStore.getState().loadTree(1);
    older.reject(new Error("Previous role failed"));
    await expect(previousLoad).resolves.toBeUndefined();
    expect(usePermissionsAccessStore.getState()).toMatchObject({ loadingSaved: true, loadingTree: true, error: null });
    newer.reject(new Error("Selected role failed"));
    await expect(selectedLoad).rejects.toThrow("Selected role failed");
    expect(usePermissionsAccessStore.getState()).toMatchObject({ loadingSaved: false, loadingTree: false, error: "Selected role failed" });
  });

  it.each(["role", "store", "reset", "session"] as const)("invalidates pending tree work on a %s change", async (change) => {
    const response = deferred<StorePermissionTree | null>();
    fetchStorePermissionTreeMock.mockReturnValueOnce(response.promise);
    usePermissionsAccessStore.setState({ selectedStoreUuid: "store-1", selectedRoleId: 1 });
    const pendingLoad = usePermissionsAccessStore.getState().loadTree(1);
    if (change === "role") usePermissionsAccessStore.getState().setRole(3);
    else if (change === "store") usePermissionsAccessStore.getState().setStore("store-2");
    else if (change === "reset") usePermissionsAccessStore.getState().reset();
    else resetSessionStores();
    expect(usePermissionsAccessStore.getState()).toMatchObject({ loadingSaved: false, loadingTree: false, error: null, tree: null });
    if (change === "role") usePermissionsAccessStore.getState().setRole(1);
    else if (change === "store") usePermissionsAccessStore.getState().setStore("store-1");
    response.resolve(scopedTree("store-1", 1));
    await pendingLoad;
    expect(usePermissionsAccessStore.getState()).toMatchObject({ checkedSubIds: [], savedCheckedSubIds: [], tree: null });
  });

  it("keeps a save bound to its original target without refreshing a newly selected scope", async () => {
    const mutation = deferred<void>();
    const current = deferred<StorePermissionTree | null>();
    saveStorePermissionsMock.mockReturnValueOnce(mutation.promise);
    fetchStorePermissionTreeMock.mockReturnValueOnce(current.promise);
    editableScope();
    const previousSave = usePermissionsAccessStore.getState().save(1);
    usePermissionsAccessStore.getState().setStore("store-2");
    usePermissionsAccessStore.getState().setRole(3);
    const currentLoad = usePermissionsAccessStore.getState().loadTree(1);
    mutation.resolve();
    await expect(previousSave).resolves.toBe(false);

    expect(saveStorePermissionsMock).toHaveBeenCalledWith({ company_uuid_fk: "store-1", role_id: 1, sub_id_list: [MANAGE_MENU_SUB_ID] });
    expect(fetchStorePermissionTreeMock).toHaveBeenCalledTimes(1);
    expect(fetchStorePermissionTreeMock).toHaveBeenCalledWith("store-2", 3, undefined);
    expect(usePermissionsAccessStore.getState()).toMatchObject({ selectedStoreUuid: "store-2", selectedRoleId: 3, saving: false, loadingTree: true });
    const selectedTree = scopedTree("store-2", 3);
    current.resolve(selectedTree);
    await currentLoad;
    expect(usePermissionsAccessStore.getState().tree).toBe(selectedTree);
  });

  it.each(["success", "failure"] as const)("does not let an older save refresh %s overwrite a newer tree and draft", async (outcome) => {
    const saveRefresh = deferred<StorePermissionTree | null>();
    const current = deferred<StorePermissionTree | null>();
    fetchStorePermissionTreeMock.mockReturnValueOnce(saveRefresh.promise).mockReturnValueOnce(current.promise);
    editableScope();
    const pendingSave = usePermissionsAccessStore.getState().save(1);
    await Promise.resolve();
    expect(fetchStorePermissionTreeMock).toHaveBeenCalledTimes(1);
    const currentLoad = usePermissionsAccessStore.getState().loadTree(1);
    const selectedTree = scopedTree("store-1", 1, false);
    current.resolve(selectedTree);
    await currentLoad;
    usePermissionsAccessStore.getState().toggleSubmenu(MANAGE_MENU_SUB_ID, true);
    if (outcome === "success") saveRefresh.resolve(scopedTree("store-1", 1));
    else saveRefresh.reject(new Error("Stale refresh failed"));
    await expect(pendingSave).resolves.toBe(false);

    expect(usePermissionsAccessStore.getState()).toMatchObject({
      tree: selectedTree, checkedSubIds: [MANAGE_MENU_SUB_ID], savedCheckedSubIds: [],
      dirty: true, error: null, saving: false, loadingSaved: false, loadingTree: false
    });
  });

  it("does not let an old save completion clear a newer tree request's loading flags", async () => {
    const saveRefresh = deferred<StorePermissionTree | null>();
    const current = deferred<StorePermissionTree | null>();
    fetchStorePermissionTreeMock.mockReturnValueOnce(saveRefresh.promise).mockReturnValueOnce(current.promise);
    editableScope();
    const pendingSave = usePermissionsAccessStore.getState().save(1);
    await Promise.resolve();
    const currentLoad = usePermissionsAccessStore.getState().loadTree(1);
    saveRefresh.resolve(scopedTree("store-1", 1));
    await expect(pendingSave).resolves.toBe(false);
    expect(usePermissionsAccessStore.getState()).toMatchObject({ saving: false, loadingSaved: true, loadingTree: true, error: null });
    current.resolve(scopedTree("store-1", 1));
    await currentLoad;
  });

  it("clears a failed interim read when the committed save starts its newer refresh", async () => {
    const mutation = deferred<void>();
    saveStorePermissionsMock.mockReturnValueOnce(mutation.promise);
    fetchStorePermissionTreeMock
      .mockRejectedValueOnce(new Error("Interim read failed"))
      .mockResolvedValueOnce(scopedTree("store-1", 1));
    editableScope();
    const pendingSave = usePermissionsAccessStore.getState().save(1);
    await expect(usePermissionsAccessStore.getState().loadTree(1)).rejects.toThrow("Interim read failed");
    mutation.resolve();
    await expect(pendingSave).resolves.toBe(true);
    expect(usePermissionsAccessStore.getState()).toMatchObject({ dirty: false, saving: false, error: null });
  });

  it("ignores an old save failure after a session reset", async () => {
    const mutation = deferred<void>();
    saveStorePermissionsMock.mockReturnValueOnce(mutation.promise);
    editableScope();
    const pendingSave = usePermissionsAccessStore.getState().save(1);
    resetSessionStores();
    mutation.reject(new Error("Previous session failed"));
    await expect(pendingSave).resolves.toBe(false);

    expect(fetchStorePermissionTreeMock).not.toHaveBeenCalled();
    expect(usePermissionsAccessStore.getState()).toMatchObject({ selectedStoreUuid: "", selectedRoleId: null, tree: null, saving: false, error: null });
  });

  it("reports a current save failure and retains its unsaved selection", async () => {
    saveStorePermissionsMock.mockRejectedValueOnce(new Error("Save failed"));
    editableScope();
    await expect(usePermissionsAccessStore.getState().save(1)).rejects.toThrow("Save failed");
    expect(usePermissionsAccessStore.getState()).toMatchObject({ checkedSubIds: [MANAGE_MENU_SUB_ID], dirty: true, saving: false, error: "Save failed" });
  });

  it("does not save ticks from a tree that belongs to another selected role", async () => {
    editableScope();
    usePermissionsAccessStore.setState({ selectedRoleId: 3 });
    await expect(usePermissionsAccessStore.getState().save(1)).resolves.toBe(false);
    expect(saveStorePermissionsMock).not.toHaveBeenCalled();
  });

  it("returns false when there is no selected scope or pending edit to save", async () => {
    await expect(usePermissionsAccessStore.getState().save(1)).resolves.toBe(false);
    editableScope();
    usePermissionsAccessStore.setState({ dirty: false });
    await expect(usePermissionsAccessStore.getState().save(1)).resolves.toBe(false);
    expect(saveStorePermissionsMock).not.toHaveBeenCalled();
  });
});
