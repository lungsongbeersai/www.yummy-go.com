import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchSidebarPermissionMenu,
  type SidebarPermissionMenuItem
} from "@/services/sidebar-menu";
import {
  sidebarMenuCacheKey,
  useSidebarMenuStore
} from "@/stores/sidebar-menu-store";

vi.mock("@/services/sidebar-menu", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/sidebar-menu")>();
  return {
    ...actual,
    fetchSidebarPermissionMenu: vi.fn()
  };
});

const fetchSidebarPermissionMenuMock = vi.mocked(fetchSidebarPermissionMenu);

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const menuItems: SidebarPermissionMenuItem[] = [
  {
    iconName: "home",
    label: "Home",
    path: "/",
    source: "permission-api",
    title: "home"
  }
];

describe("sidebar menu store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSidebarMenuStore.setState({
      cache: {},
      error: null,
      items: [],
      loading: false,
      requestKey: ""
    });
  });

  it("uses api menu items and caches them on success", async () => {
    fetchSidebarPermissionMenuMock.mockResolvedValueOnce(menuItems);

    await useSidebarMenuStore.getState().load("store-1", 1, "la");

    const key = sidebarMenuCacheKey("store-1", 1, "la");
    const state = useSidebarMenuStore.getState();
    expect(fetchSidebarPermissionMenuMock).toHaveBeenCalledWith({
      companyUuid: "store-1",
      lang: "la",
      roleId: 1
    });
    expect(state.items).toEqual(menuItems);
    expect(state.cache[key]).toEqual(menuItems);
    expect(state.error).toBeNull();
  });

  it("keeps same-key cached menu items when the api fails", async () => {
    const key = sidebarMenuCacheKey("store-1", 1, "la");
    useSidebarMenuStore.setState({ cache: { [key]: menuItems } });
    fetchSidebarPermissionMenuMock.mockRejectedValueOnce(new Error("offline"));

    await useSidebarMenuStore.getState().load("store-1", 1, "la");

    const state = useSidebarMenuStore.getState();
    expect(state.items).toEqual(menuItems);
    expect(state.error).toBe("offline");
    expect(state.loading).toBe(false);
  });

  it("uses empty active items when the api fails without cache", async () => {
    fetchSidebarPermissionMenuMock.mockRejectedValueOnce(new Error("offline"));

    await useSidebarMenuStore.getState().load("store-2", 2, "en");

    const state = useSidebarMenuStore.getState();
    expect(state.items).toEqual([]);
    expect(state.error).toBe("offline");
    expect(state.requestKey).toBe(sidebarMenuCacheKey("store-2", 2, "en"));
  });

  it("keeps the latest request active when an older response finishes last", async () => {
    const first = deferred<SidebarPermissionMenuItem[]>();
    const second = deferred<SidebarPermissionMenuItem[]>();
    const latestItems = [{ ...menuItems[0], label: "Latest", path: "/latest" }];
    fetchSidebarPermissionMenuMock
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const firstLoad = useSidebarMenuStore.getState().load("store-1", 1, "la");
    const secondLoad = useSidebarMenuStore.getState().load("store-2", 2, "en");

    second.resolve(latestItems);
    await secondLoad;
    first.resolve(menuItems);
    await firstLoad;

    expect(useSidebarMenuStore.getState()).toMatchObject({
      items: latestItems,
      loading: false,
      requestKey: sidebarMenuCacheKey("store-2", 2, "en")
    });
  });
});
