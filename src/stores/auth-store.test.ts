import { beforeEach, describe, expect, it, vi } from "vitest";
import { disconnectSocket } from "@/lib/socket";
import { getBranchOptions, type Branch } from "@/services/branch";
import { getExecutiveDashboard, type ExecutiveDashboardResponse } from "@/services/dashboard";
import { checkLogin, type LoginResult } from "@/services/login";
import { getProducts, type Product } from "@/services/product";
import { useAuthStore, type AuthUser } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";
import { useDashboardStore } from "@/stores/dashboard-store";
import { useNotificationStore } from "@/stores/notification-store";
import { useProductStore } from "@/stores/product-store";
import { useReferenceStore } from "@/stores/reference-store";
import { useSidebarMenuStore } from "@/stores/sidebar-menu-store";
import { useStorePermissionsStore } from "@/stores/store-permissions-store";

vi.mock("@/lib/socket", () => ({
  disconnectSocket: vi.fn()
}));

vi.mock("@/services/login", () => ({
  checkLogin: vi.fn()
}));

vi.mock("@/services/branch", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/branch")>();
  return {
    ...actual,
    getBranchOptions: vi.fn()
  };
});

vi.mock("@/services/dashboard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/dashboard")>();
  return {
    ...actual,
    getExecutiveDashboard: vi.fn()
  };
});

vi.mock("@/services/product", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/product")>();
  return {
    ...actual,
    getProducts: vi.fn()
  };
});

const checkLoginMock = vi.mocked(checkLogin);
const disconnectSocketMock = vi.mocked(disconnectSocket);
const getBranchOptionsMock = vi.mocked(getBranchOptions);
const getExecutiveDashboardMock = vi.mocked(getExecutiveDashboard);
const getProductsMock = vi.mocked(getProducts);

function authUser(uuid: string): AuthUser {
  return {
    uuid,
    email: `${uuid}@example.com`,
    status: 1,
    profile: "",
    branch_uuid: `${uuid}-branch`,
    branch_name: "Branch",
    branch_tel: "",
    branch_address: "",
    store_uuid: `${uuid}-store`,
    store_name: "Store",
    store_logo: ""
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

describe("auth store session isolation", () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
    vi.clearAllMocks();
  });

  it("resets loaded user-scoped stores on logout", () => {
    useAuthStore.getState().login("token-1", authUser("user-1"));
    useDashboardStore.setState({ data: { owner: "user-1" } });
    useNotificationStore.getState().clear();
    useProductStore.setState({ search: "private products" });
    useReferenceStore.setState({ storeUuid: "user-1-store", selectedUser: { login_uuid: "user-1" } });
    useSidebarMenuStore.setState({ requestKey: "user-1:1:la" });
    useStorePermissionsStore.setState({ selectedStoreUuid: "user-1-store" });

    useAuthStore.getState().logout();

    expect(useAuthStore.getState()).toMatchObject({
      token: null,
      user: null,
      isLoggedIn: false,
      loading: false
    });
    expect(useDashboardStore.getState().data).toBeNull();
    expect(useNotificationStore.getState().items).toHaveLength(4);
    expect(useProductStore.getState().search).toBe("");
    expect(useReferenceStore.getState()).toMatchObject({ storeUuid: "", selectedUser: null });
    expect(useSidebarMenuStore.getState().requestKey).toBe("");
    expect(useStorePermissionsStore.getState().selectedStoreUuid).toBe("");
    expect(disconnectSocketMock).toHaveBeenCalledOnce();
  });

  it("resets the previous session before applying a new login", () => {
    useAuthStore.getState().login("token-1", authUser("user-1"));
    useProductStore.setState({ search: "user-1 products" });
    useSidebarMenuStore.setState({ requestKey: "user-1:1:la" });

    useAuthStore.getState().login("token-2", authUser("user-2"));

    expect(useAuthStore.getState()).toMatchObject({ token: "token-2", isLoggedIn: true });
    expect(useAuthStore.getState().user?.uuid).toBe("user-2");
    expect(useProductStore.getState().search).toBe("");
    expect(useSidebarMenuStore.getState().requestKey).toBe("");
  });

  it("does not let an older login response overwrite the active session", async () => {
    const first = deferred<LoginResult>();
    const second = deferred<LoginResult>();
    checkLoginMock
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const firstLogin = useAuthStore.getState().loginWithPassword("first@example.com", "password");
    const secondLogin = useAuthStore.getState().loginWithPassword("second@example.com", "password");

    second.resolve({ token: "token-2", user: authUser("user-2") });
    await secondLogin;
    useProductStore.setState({ search: "user-2 products" });

    first.resolve({ token: "token-1", user: authUser("user-1") });
    await expect(firstLogin).resolves.toBeNull();

    expect(useAuthStore.getState()).toMatchObject({ token: "token-2", isLoggedIn: true, loading: false });
    expect(useAuthStore.getState().user?.uuid).toBe("user-2");
    expect(useProductStore.getState().search).toBe("user-2 products");
  });

  it("silently cancels a failed pending login after logout", async () => {
    const pending = deferred<LoginResult>();
    checkLoginMock.mockReturnValueOnce(pending.promise);

    const login = useAuthStore.getState().loginWithPassword("user@example.com", "password");
    useAuthStore.getState().logout();
    pending.reject(new Error("late failure"));

    await expect(login).resolves.toBeNull();
    expect(useAuthStore.getState()).toMatchObject({
      token: null,
      user: null,
      isLoggedIn: false,
      loading: false,
      error: null
    });
  });

  it("does not let an old store load overwrite the next session", async () => {
    const pending = deferred<Awaited<ReturnType<typeof getProducts>>>();
    getProductsMock.mockReturnValueOnce(pending.promise);
    useAuthStore.getState().login("token-1", authUser("user-1"));

    const load = useProductStore.getState().load();
    useAuthStore.getState().logout();
    useAuthStore.getState().login("token-2", authUser("user-2"));
    useProductStore.setState({ search: "user-2 products" });

    const oldRows: Product[] = [{ prod_uuid: "old-product" }];
    pending.resolve({ data: oldRows, message: "ok", status: "success", total: 1, totalPages: 1 });

    await expect(load).resolves.toEqual(oldRows);
    expect(useProductStore.getState()).toMatchObject({
      rows: [],
      search: "user-2 products",
      loading: false
    });
  });

  it("keeps the latest branch request when an older store request finishes last", async () => {
    const first = deferred<Branch[]>();
    const second = deferred<Branch[]>();
    getBranchOptionsMock
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const firstLoad = useBranchStore.getState().loadBranches("store-1");
    const secondLoad = useBranchStore.getState().loadBranches("store-2");
    const store2Branches: Branch[] = [{ branch_uuid: "branch-2" }];

    second.resolve(store2Branches);
    await secondLoad;
    first.resolve([{ branch_uuid: "branch-1" }]);
    await firstLoad;

    expect(useBranchStore.getState()).toMatchObject({
      branches: store2Branches,
      selectedBranchUuid: "branch-2",
      storeUuid: "store-2",
      loading: false
    });
  });

  it("keeps the latest reference options when an older store request finishes last", async () => {
    const first = deferred<Branch[]>();
    const second = deferred<Branch[]>();
    getBranchOptionsMock
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const currentBranches: Branch[] = [{ branch_uuid: "branch-2" }];

    const firstLoad = useReferenceStore.getState().loadBranches("store-1");
    const secondLoad = useReferenceStore.getState().loadBranches("store-2");

    second.resolve(currentBranches);
    await secondLoad;
    first.resolve([{ branch_uuid: "branch-1" }]);
    await firstLoad;

    expect(useReferenceStore.getState().options.branches).toEqual(currentBranches);
    expect(useReferenceStore.getState().loadingKeys.branches).toBe(false);
  });

  it("keeps the latest product query when an older response finishes last", async () => {
    const first = deferred<Awaited<ReturnType<typeof getProducts>>>();
    const second = deferred<Awaited<ReturnType<typeof getProducts>>>();
    getProductsMock
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const currentRows: Product[] = [{ prod_uuid: "current-product" }];

    const firstLoad = useProductStore.getState().load({ search: "old" });
    const secondLoad = useProductStore.getState().load({ search: "current" });

    second.resolve({ data: currentRows, message: "ok", status: "success", total: 1, totalPages: 1 });
    await secondLoad;
    first.resolve({
      data: [{ prod_uuid: "old-product" }],
      message: "ok",
      status: "success",
      total: 1,
      totalPages: 1
    });
    await firstLoad;

    expect(useProductStore.getState()).toMatchObject({
      rows: currentRows,
      loading: false,
      total: 1,
      totalPages: 1
    });
  });

  it("does not let an old dashboard promise clear the next session's in-flight request", async () => {
    const first = deferred<ExecutiveDashboardResponse>();
    const second = deferred<ExecutiveDashboardResponse>();
    getExecutiveDashboardMock
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const params = { branch_uuid_fk: "branch-1", lang: "la" };

    const firstLoad = useDashboardStore.getState().load(params);
    useDashboardStore.getState().reset();
    const secondLoad = useDashboardStore.getState().load(params);

    first.resolve({ data: { owner: "old" }, message: "ok", status: "success" });
    await firstLoad;
    const sharedSecondLoad = useDashboardStore.getState().load(params);

    expect(getExecutiveDashboardMock).toHaveBeenCalledTimes(2);

    second.resolve({ data: { owner: "current" }, message: "ok", status: "success" });
    await Promise.all([secondLoad, sharedSecondLoad]);
    expect(useDashboardStore.getState().data).toEqual({ owner: "current" });
  });
});
