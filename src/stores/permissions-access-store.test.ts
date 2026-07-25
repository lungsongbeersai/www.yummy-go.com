import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchStorePermissionSavedList,
  fetchStorePermissionTree,
  saveStorePermissions,
  type StorePermissionTree
} from "@/services/permissions/access";
import { usePermissionsAccessStore } from "@/stores/permissions-access-store";

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

describe("permissions access store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePermissionsAccessStore.setState({
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

    await usePermissionsAccessStore.getState().save(1, "la");

    expect(saveStorePermissionsMock).toHaveBeenCalledWith({
      company_uuid_fk: "store-1",
      role_id: 1,
      sub_id_list: [MANAGE_MENU_SUB_ID]
    });
    expect(usePermissionsAccessStore.getState().checkedSubIds).toEqual([MANAGE_MENU_SUB_ID]);
    expect(usePermissionsAccessStore.getState().dirty).toBe(false);
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
});
