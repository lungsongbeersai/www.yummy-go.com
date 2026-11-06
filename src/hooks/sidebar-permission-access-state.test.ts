import { beforeEach, describe, expect, it, vi } from "vitest";
import { menuGrantsPath } from "@/components/layout/shell-menu-helpers";
import {
  fetchSidebarPermissionMenu,
  type SidebarPermissionMenuItem,
} from "@/services/permissions/sidebar";
import {
  sidebarMenuCacheKey,
  usePermissionsSidebarStore,
} from "@/stores/permissions-sidebar-store";
import { resolveSidebarPermissionAccess } from "./sidebar-permission-access-state";

vi.mock("@/services/permissions/sidebar", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/permissions/sidebar")>();
  return { ...actual, fetchSidebarPermissionMenu: vi.fn() };
});

const fetchMenu = vi.mocked(fetchSidebarPermissionMenu);
const dashboardMenu: SidebarPermissionMenuItem[] = [
  { title: "home", label: "Home", path: "/", iconName: "home", source: "permission-api" },
];

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function access(store = "store-1", role = 3, language = "la") {
  return resolveSidebarPermissionAccess({
    ...usePermissionsSidebarStore.getState(),
    targetRequestKey: sidebarMenuCacheKey(store, role, language),
  });
}

async function verifyActiveMenu() {
  fetchMenu.mockResolvedValueOnce(dashboardMenu);
  await usePermissionsSidebarStore.getState().load("store-1", 3, "la");
}

describe("sidebar permission access during session refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePermissionsSidebarStore.getState().reset();
  });

  it("blocks a restored cache until the first API request verifies it", async () => {
    const key = sidebarMenuCacheKey("store-1", 3, "la");
    usePermissionsSidebarStore.setState({ cache: { [key]: dashboardMenu } });
    const pending = deferred<SidebarPermissionMenuItem[]>();
    fetchMenu.mockReturnValueOnce(pending.promise);

    const request = usePermissionsSidebarStore.getState().load("store-1", 3, "la");
    expect(access().loading).toBe(true);
    expect(menuGrantsPath(access().menuItems, "/")).toBe(false);

    pending.resolve(dashboardMenu);
    await request;
    expect(access().loading).toBe(false);
    expect(menuGrantsPath(access().menuItems, "/")).toBe(true);
  });

  it("keeps verified dashboard access ready during polling, then applies revocation", async () => {
    await verifyActiveMenu();
    const verifiedItems = access().menuItems;
    const pending = deferred<SidebarPermissionMenuItem[]>();
    fetchMenu.mockReturnValueOnce(pending.promise);

    const refresh = usePermissionsSidebarStore.getState().load("store-1", 3, "la");
    expect(usePermissionsSidebarStore.getState().loading).toBe(true);
    expect(access().loading).toBe(false);
    expect(access().menuItems).toBe(verifiedItems);
    expect(menuGrantsPath(access().menuItems, "/")).toBe(true);

    pending.resolve([]);
    await refresh;
    expect(access().loading).toBe(false);
    expect(menuGrantsPath(access().menuItems, "/")).toBe(false);
  });

  it("closes access when a background permission request fails", async () => {
    await verifyActiveMenu();
    const pending = deferred<SidebarPermissionMenuItem[]>();
    fetchMenu.mockReturnValueOnce(pending.promise);
    const refresh = usePermissionsSidebarStore.getState().load("store-1", 3, "la");
    expect(access().loading).toBe(false);

    pending.reject(new Error("Permission check failed"));
    await refresh;
    expect(usePermissionsSidebarStore.getState().error).toBe("Permission check failed");
    expect(menuGrantsPath(access().menuItems, "/")).toBe(false);
  });

  it.each([
    { store: "store-2", role: 3, language: "la" },
    { store: "store-1", role: 4, language: "la" },
    { store: "store-1", role: 3, language: "en" },
  ])("blocks old permissions while verifying scope $store/$role/$language", async ({ store, role, language }) => {
    await verifyActiveMenu();
    expect(access(store, role, language).loading).toBe(true);
    expect(access(store, role, language).menuItems).toEqual([]);
    const pending = deferred<SidebarPermissionMenuItem[]>();
    fetchMenu.mockReturnValueOnce(pending.promise);
    const request = usePermissionsSidebarStore.getState().load(store, role, language);
    expect(access(store, role, language).loading).toBe(true);
    expect(menuGrantsPath(access(store, role, language).menuItems, "/")).toBe(false);

    pending.resolve([]);
    await request;
    expect(access(store, role, language).loading).toBe(false);
    expect(menuGrantsPath(access(store, role, language).menuItems, "/")).toBe(false);
  });

  it("blocks the active policy immediately when a saved policy requires rechecking", async () => {
    await verifyActiveMenu();
    const pending = deferred<SidebarPermissionMenuItem[]>();
    fetchMenu.mockReturnValueOnce(pending.promise);

    const request = usePermissionsSidebarStore.getState().refreshPolicy("store-1", 3);
    expect(access().loading).toBe(true);
    expect(menuGrantsPath(access().menuItems, "/")).toBe(false);

    pending.resolve(dashboardMenu);
    await request;
    expect(access().loading).toBe(false);
    expect(menuGrantsPath(access().menuItems, "/")).toBe(true);
  });
});
