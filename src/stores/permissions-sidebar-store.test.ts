import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchSidebarPermissionMenu,
  type SidebarPermissionMenuItem
} from "@/services/permissions/sidebar";
import {
  sidebarMenuCacheKey,
  usePermissionsSidebarStore
} from "@/stores/permissions-sidebar-store";

vi.mock("@/services/permissions/sidebar", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/permissions/sidebar")>();
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

describe("permissions sidebar store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePermissionsSidebarStore.getState().reset();
  });

  it("uses api menu items and caches them on success", async () => {
    fetchSidebarPermissionMenuMock.mockResolvedValueOnce(menuItems);

    await usePermissionsSidebarStore.getState().load("store-1", 1, "la");

    const key = sidebarMenuCacheKey("store-1", 1, "la");
    const state = usePermissionsSidebarStore.getState();
    expect(fetchSidebarPermissionMenuMock).toHaveBeenCalledWith({
      companyUuid: "store-1",
      lang: "la",
      roleId: 1
    });
    expect(state.items).toEqual(menuItems);
    expect(state.cache[key]).toEqual(menuItems);
    expect(state.error).toBeNull();
  });

  it("removes old cached menus when the current permission request fails", async () => {
    const key = sidebarMenuCacheKey("store-1", 1, "la");
    usePermissionsSidebarStore.setState({ cache: { [key]: menuItems } });
    fetchSidebarPermissionMenuMock.mockRejectedValueOnce(new Error("offline"));

    await usePermissionsSidebarStore.getState().load("store-1", 1, "la");

    const state = usePermissionsSidebarStore.getState();
    expect(state.items).toEqual([]);
    expect(state.cache[key]).toBeUndefined();
    expect(state.error).toBe("offline");
    expect(state.loading).toBe(false);
  });

  it("uses empty active items when the api fails without cache", async () => {
    fetchSidebarPermissionMenuMock.mockRejectedValueOnce(new Error("offline"));

    await usePermissionsSidebarStore.getState().load("store-2", 2, "en");

    const state = usePermissionsSidebarStore.getState();
    expect(state.items).toEqual([]);
    expect(state.error).toBe("offline");
    expect(state.requestKey).toBe(sidebarMenuCacheKey("store-2", 2, "en"));
  });

  it("does not reuse cached items from a different store, role, or language", async () => {
    const otherKey = sidebarMenuCacheKey("store-1", 1, "la");
    usePermissionsSidebarStore.setState({
      cache: { [otherKey]: menuItems },
      items: menuItems,
      requestKey: otherKey,
    });
    fetchSidebarPermissionMenuMock.mockRejectedValueOnce(new Error("offline"));

    await usePermissionsSidebarStore.getState().load("store-2", 2, "en");

    expect(usePermissionsSidebarStore.getState()).toMatchObject({
      items: [],
      error: "offline",
      requestKey: sidebarMenuCacheKey("store-2", 2, "en"),
    });
  });

  it("checks a restored cache against the server before displaying it", async () => {
    const key = sidebarMenuCacheKey("store-1", 1, "la");
    const pending = deferred<SidebarPermissionMenuItem[]>();
    usePermissionsSidebarStore.setState({ cache: { [key]: menuItems } });
    fetchSidebarPermissionMenuMock.mockReturnValueOnce(pending.promise);

    const load = usePermissionsSidebarStore
      .getState()
      .load("store-1", 1, "la");

    expect(usePermissionsSidebarStore.getState()).toMatchObject({
      items: [],
      loading: true,
      requestKey: key,
    });

    pending.resolve(menuItems);
    await load;
  });

  it("keeps a verified active menu during a background refresh and applies revocations", async () => {
    fetchSidebarPermissionMenuMock.mockResolvedValueOnce(menuItems);
    await usePermissionsSidebarStore.getState().load("store-1", 3, "la");
    const pending = deferred<SidebarPermissionMenuItem[]>();
    fetchSidebarPermissionMenuMock.mockReturnValueOnce(pending.promise);

    const refresh = usePermissionsSidebarStore.getState().load("store-1", 3, "la");
    expect(usePermissionsSidebarStore.getState()).toMatchObject({ items: menuItems, loading: true });
    pending.resolve([]);
    await refresh;
    expect(usePermissionsSidebarStore.getState()).toMatchObject({ items: [], loading: false, error: null });
  });

  it("shares a pending request so focus and visibility refreshes wait for the same result", async () => {
    const pending = deferred<SidebarPermissionMenuItem[]>();
    fetchSidebarPermissionMenuMock.mockReturnValueOnce(pending.promise);
    const first = usePermissionsSidebarStore.getState().load("store-1", 3, "la");
    const second = usePermissionsSidebarStore.getState().load("store-1", 3, "la");
    expect(first).toBe(second);
    expect(fetchSidebarPermissionMenuMock).toHaveBeenCalledOnce();
    pending.resolve(menuItems);
    await second;
    expect(usePermissionsSidebarStore.getState().items).toEqual(menuItems);
  });

  it("refreshes a saved active policy and invalidates all cached languages for it", async () => {
    const activeKey = sidebarMenuCacheKey("store-1", 3, "la");
    const englishKey = sidebarMenuCacheKey("store-1", 3, "en");
    const otherKey = sidebarMenuCacheKey("store-2", 3, "la");
    usePermissionsSidebarStore.setState({ requestKey: activeKey, items: menuItems, cache: {
      [activeKey]: menuItems, [englishKey]: menuItems, [otherKey]: menuItems,
    } });
    fetchSidebarPermissionMenuMock.mockResolvedValueOnce([]);

    await usePermissionsSidebarStore.getState().refreshPolicy("store-1", 3);

    expect(fetchSidebarPermissionMenuMock).toHaveBeenCalledWith({ companyUuid: "store-1", roleId: 3, lang: "la" });
    expect(usePermissionsSidebarStore.getState()).toMatchObject({ items: [], cache: { [activeKey]: [], [otherKey]: menuItems } });
    expect(usePermissionsSidebarStore.getState().cache[englishKey]).toBeUndefined();
  });

  it("does not switch the PLC sidebar when saving another store or role", async () => {
    const activeKey = sidebarMenuCacheKey("plc", 1, "la");
    const demoKey = sidebarMenuCacheKey("demo", 3, "la");
    usePermissionsSidebarStore.setState({ requestKey: activeKey, items: menuItems, cache: { [activeKey]: menuItems, [demoKey]: menuItems } });

    await usePermissionsSidebarStore.getState().refreshPolicy("demo", 3);

    expect(fetchSidebarPermissionMenuMock).not.toHaveBeenCalled();
    expect(usePermissionsSidebarStore.getState()).toMatchObject({ requestKey: activeKey, items: menuItems });
    expect(usePermissionsSidebarStore.getState().cache[demoKey]).toBeUndefined();
  });

  it("does not let an older response restore revoked menus after saving the active policy", async () => {
    const old = deferred<SidebarPermissionMenuItem[]>();
    fetchSidebarPermissionMenuMock.mockReturnValueOnce(old.promise).mockResolvedValueOnce([]);
    const oldLoad = usePermissionsSidebarStore.getState().load("demo", 3, "la");

    await usePermissionsSidebarStore.getState().refreshPolicy("demo", 3);
    old.resolve(menuItems);
    await oldLoad;

    expect(usePermissionsSidebarStore.getState()).toMatchObject({ items: [], loading: false, error: null });
  });

  it("does not reuse an old session request for the same store and role after reset", async () => {
    const old = deferred<SidebarPermissionMenuItem[]>();
    const fresh = deferred<SidebarPermissionMenuItem[]>();
    fetchSidebarPermissionMenuMock.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    const oldLoad = usePermissionsSidebarStore.getState().load("demo", 3, "la");
    usePermissionsSidebarStore.getState().reset();
    const freshLoad = usePermissionsSidebarStore.getState().load("demo", 3, "la");
    expect(fetchSidebarPermissionMenuMock).toHaveBeenCalledTimes(2);
    old.resolve(menuItems);
    await oldLoad;
    expect(usePermissionsSidebarStore.getState()).toMatchObject({ items: [], loading: true });
    fresh.resolve([]);
    await freshLoad;
    expect(usePermissionsSidebarStore.getState()).toMatchObject({ items: [], loading: false });
  });

  it("keeps the latest request active when an older response finishes last", async () => {
    const first = deferred<SidebarPermissionMenuItem[]>();
    const second = deferred<SidebarPermissionMenuItem[]>();
    const latestItems = [{ ...menuItems[0], label: "Latest", path: "/latest" }];
    fetchSidebarPermissionMenuMock
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const firstLoad = usePermissionsSidebarStore.getState().load("store-1", 1, "la");
    const secondLoad = usePermissionsSidebarStore.getState().load("store-2", 2, "en");

    second.resolve(latestItems);
    await secondLoad;
    first.resolve(menuItems);
    await firstLoad;

    expect(usePermissionsSidebarStore.getState()).toMatchObject({
      items: latestItems,
      loading: false,
      requestKey: sidebarMenuCacheKey("store-2", 2, "en")
    });
  });
});
