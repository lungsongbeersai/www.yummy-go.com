import { beforeEach, describe, expect, it, vi } from "vitest";
import { disconnectSocket } from "@/lib/socket";
import { getBranchOptions, type Branch } from "@/services/branch";
import { getExecutiveDashboard, type ExecutiveDashboardResponse } from "@/services/dashboard";
import { checkLogin, validateLoginSession, type LoginResult } from "@/services/login";
import { getProducts, type Product } from "@/services/product";
import { useAuthStore, type AuthUser } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";
import { useDashboardStore } from "@/stores/dashboard-store";
import { useProductStore } from "@/stores/product-store";
import { useReferenceStore } from "@/stores/reference-store";
import { usePermissionsSidebarStore } from "@/stores/permissions-sidebar-store";
import { usePermissionsAccessStore } from "@/stores/permissions-access-store";
import { ServiceError } from "@/lib/api";

vi.mock("@/lib/socket", () => ({
  disconnectSocket: vi.fn()
}));

vi.mock("@/services/login", () => ({
  checkLogin: vi.fn(),
  validateLoginSession: vi.fn()
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
const validateLoginSessionMock = vi.mocked(validateLoginSession);
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
    store_logo: "",
    store_table_status: 2
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

  it("logs in with the Backend session", async () => {
    const user = authUser("cashier");
    checkLoginMock.mockResolvedValue({ token: "online-token", user, source: "online" });

    await expect(useAuthStore.getState().loginWithPassword("cashier@example.com", "password"))
      .resolves.toEqual(user);
    expect(useAuthStore.getState()).toMatchObject({
      token: "online-token",
      user,
      isLoggedIn: true,
      loading: false,
    });
  });

  it("resets loaded user-scoped stores on logout", () => {
    useAuthStore.getState().login("token-1", authUser("user-1"));
    useDashboardStore.setState({ data: { owner: "user-1" } });
    useProductStore.setState({ search: "private products" });
    useReferenceStore.setState({ storeUuid: "user-1-store", selectedUser: { login_uuid: "user-1" } });
    usePermissionsSidebarStore.setState({ requestKey: "user-1:1:la" });
    usePermissionsAccessStore.setState({ selectedStoreUuid: "user-1-store" });

    useAuthStore.getState().logout();

    expect(useAuthStore.getState()).toMatchObject({
      token: null,
      user: null,
      isLoggedIn: false,
      loading: false
    });
    expect(useDashboardStore.getState().data).toBeNull();
    expect(useProductStore.getState().search).toBe("");
    expect(useReferenceStore.getState()).toMatchObject({ storeUuid: "", selectedUser: null });
    expect(usePermissionsSidebarStore.getState().requestKey).toBe("");
    expect(usePermissionsAccessStore.getState().selectedStoreUuid).toBe("");
    expect(disconnectSocketMock).toHaveBeenCalledOnce();
  });

  it("deduplicates validation requests and refreshes the current POS display name", async () => {
    const pending = deferred<Awaited<ReturnType<typeof validateLoginSession>>>();
    validateLoginSessionMock.mockReturnValueOnce(pending.promise);
    useAuthStore.getState().login("token-1", { ...authUser("user-1"), name: "Old name" });

    const first = useAuthStore.getState().validateSession();
    const second = useAuthStore.getState().validateSession();
    pending.resolve({
      uuid: "user-1",
      login_email: "user-1@example.com",
      login_name: "Noy",
      branch_uuid: "user-1-branch",
      store_uuid_fk: "user-1-store",
      login_status: 1,
    });

    await expect(first).resolves.toBe(true);
    await expect(second).resolves.toBe(true);
    expect(validateLoginSessionMock).toHaveBeenCalledOnce();
    expect(useAuthStore.getState().user?.name).toBe("Noy");
  });

  it("resets the previous session before applying a new login", () => {
    useAuthStore.getState().login("token-1", authUser("user-1"));
    useProductStore.setState({ search: "user-1 products" });
    usePermissionsSidebarStore.setState({ requestKey: "user-1:1:la" });

    useAuthStore.getState().login("token-2", authUser("user-2"));

    expect(useAuthStore.getState()).toMatchObject({ token: "token-2", isLoggedIn: true });
    expect(useAuthStore.getState().user?.uuid).toBe("user-2");
    expect(useProductStore.getState().search).toBe("");
    expect(usePermissionsSidebarStore.getState().requestKey).toBe("");
  });

  it.each([1, 2, 3])("refreshes live store classification %s even when the display name is unchanged", async (store_status) => {
    useAuthStore.getState().login("token-1", { ...authUser("user-1"), name: "Noy", store_status: 2 });
    validateLoginSessionMock.mockResolvedValueOnce({
      uuid: "user-1", login_email: "user-1@example.com", login_name: "Noy",
      branch_uuid: "user-1-branch", store_uuid_fk: "user-1-store", login_status: 1, store_status,
    });
    await expect(useAuthStore.getState().validateSession()).resolves.toBe(true);
    expect(useAuthStore.getState().user?.store_status).toBe(store_status);
  });

  it("revokes cached PLC visibility when session metadata does not confirm PLC access", async () => {
    useAuthStore.getState().login("token-1", { ...authUser("user-1"), name: "Noy", store_status: 1 });
    validateLoginSessionMock.mockResolvedValueOnce({
      uuid: "user-1", login_email: "user-1@example.com", login_name: "Noy",
      branch_uuid: "user-1-branch", store_uuid_fk: "user-1-store", login_status: 1,
    });
    await useAuthStore.getState().validateSession();
    expect(useAuthStore.getState().user?.store_status).toBe(2);
  });

  it("does not apply an older session's PLC classification to a new login", async () => {
    const pending = deferred<Awaited<ReturnType<typeof validateLoginSession>>>();
    useAuthStore.getState().login("token-1", authUser("user-1"));
    validateLoginSessionMock.mockReturnValueOnce(pending.promise);
    const validation = useAuthStore.getState().validateSession();
    useAuthStore.getState().login("token-2", { ...authUser("user-2"), store_status: 2 });
    pending.resolve({ uuid: "user-1", login_email: "user-1@example.com", login_name: "Noy",
      branch_uuid: "user-1-branch", store_uuid_fk: "user-1-store", login_status: 1, store_status: 1 });
    await expect(validation).resolves.toBe(false);
    expect(useAuthStore.getState().user).toMatchObject({ uuid: "user-2", store_status: 2 });
  });

  it("refreshes the current branch expiry even when profile metadata is unchanged", async () => {
    useAuthStore.getState().login("token-1", { ...authUser("user-1"), name: "Noy", store_status: 1,
      contract_end_on: "2027-01-12", contract_days_remaining: 77 });
    validateLoginSessionMock.mockResolvedValueOnce({ uuid: "user-1", login_email: "user-1@example.com", login_name: "Noy",
      branch_uuid: "user-1-branch", store_uuid_fk: "user-1-store", login_status: 1, store_status: 1,
      contract_end_on: "2026-11-01", contract_days_remaining: 5 });
    await useAuthStore.getState().validateSession();
    expect(useAuthStore.getState().user).toMatchObject({ contract_end_on: "2026-11-01", contract_days_remaining: 5 });
  });

  it.each([{}, { branch_uuid: "reassigned-branch" }, { store_uuid_fk: "reassigned-store" }])(
    "clears obsolete expiry when live metadata does not match the saved branch: %j", async (changed) => {
      useAuthStore.getState().login("token-1", { ...authUser("user-1"), name: "Noy", store_status: 1,
        contract_end_on: "2027-01-12", contract_days_remaining: 77 });
      validateLoginSessionMock.mockResolvedValueOnce({ uuid: "user-1", login_email: "user-1@example.com", login_name: "Noy",
        branch_uuid: "user-1-branch", store_uuid_fk: "user-1-store", login_status: 1, store_status: 1,
        ...(Object.keys(changed).length ? { contract_end_on: "2026-11-01", contract_days_remaining: 5 } : {}), ...changed });
      await useAuthStore.getState().validateSession();
      expect(useAuthStore.getState().user?.contract_end_on).toBeNull();
      expect(useAuthStore.getState().user?.contract_days_remaining).toBeNull();
    },
  );

  it("retains current-branch expiry when PLC package-management access is revoked", () => {
    useAuthStore.getState().login("token-1", { ...authUser("user-1"), store_status: 1,
      contract_end_on: "2027-01-12", contract_days_remaining: 77 });
    useAuthStore.getState().updateUser({ store_status: 2 });
    expect(useAuthStore.getState().user).toMatchObject({ store_status: 2, contract_end_on: "2027-01-12", contract_days_remaining: 77 });
  });

  it.each([1, 2, 3])("retains login and refreshed contract metadata for store classification %s", async (store_status) => {
    useAuthStore.getState().login("token-1", { ...authUser("user-1"), store_status,
      contract_end_on: "2027-01-12", contract_days_remaining: 77 });
    expect(useAuthStore.getState().user?.contract_end_on).toBe("2027-01-12");
    validateLoginSessionMock.mockResolvedValueOnce({ uuid: "user-1", login_email: "user-1@example.com", login_name: "Noy",
      branch_uuid: "user-1-branch", store_uuid_fk: "user-1-store", login_status: 1, store_status,
      contract_end_on: "2026-11-01", contract_days_remaining: 5 });
    await expect(useAuthStore.getState().validateSession()).resolves.toBe(true);
    expect(useAuthStore.getState().user).toMatchObject({ contract_end_on: "2026-11-01", contract_days_remaining: 5 });
  });

  it("clears authenticated data and scoped stores on an authoritative expired-session rejection", async () => {
    useAuthStore.getState().login("token-1", authUser("user-1"), true);
    useProductStore.setState({ search: "private products" });
    validateLoginSessionMock.mockRejectedValueOnce(new ServiceError("Renew contract", 401, undefined, {
      code: "BRANCH_CONTRACT_EXPIRED", contract_end_on: "2026-10-28", contract_days_remaining: -1,
    }));
    await expect(useAuthStore.getState().validateSession()).resolves.toBe(false);
    expect(useAuthStore.getState()).toMatchObject({ token: null, user: null, isLoggedIn: false, rememberMe: false,
      contractExpiry: { endOn: "2026-10-28", daysRemaining: -1 } });
    expect(useProductStore.getState().search).toBe("");
    expect(disconnectSocketMock).toHaveBeenCalled();
  });

  it("does not revoke a newer login when an older validation rejects with contract expiry", async () => {
    const pending = deferred<Awaited<ReturnType<typeof validateLoginSession>>>();
    useAuthStore.getState().login("token-1", authUser("user-1"));
    validateLoginSessionMock.mockReturnValueOnce(pending.promise);
    const validation = useAuthStore.getState().validateSession();
    useAuthStore.getState().login("token-2", authUser("user-2"));
    pending.reject(new ServiceError("Expired", 401, undefined, { code: "BRANCH_CONTRACT_EXPIRED" }));
    await expect(validation).resolves.toBe(false);
    expect(useAuthStore.getState()).toMatchObject({ token: "token-2", isLoggedIn: true, contractExpiry: null });
  });

  it("also discards a stale validation when the next login reuses the same token string", async () => {
    const pending = deferred<Awaited<ReturnType<typeof validateLoginSession>>>();
    useAuthStore.getState().login("same-token", authUser("user-1"));
    validateLoginSessionMock.mockReturnValueOnce(pending.promise);
    const validation = useAuthStore.getState().validateSession();
    useAuthStore.getState().logout();
    useAuthStore.getState().login("same-token", authUser("user-2"));
    pending.reject(new ServiceError("Expired", 401, undefined, { code: "BRANCH_CONTRACT_EXPIRED" }));
    await expect(validation).resolves.toBe(false);
    expect(useAuthStore.getState()).toMatchObject({ token: "same-token", isLoggedIn: true, contractExpiry: null });
  });

  it("keeps a transport failure distinct from contract expiry", async () => {
    useAuthStore.getState().login("token-1", authUser("user-1"));
    validateLoginSessionMock.mockRejectedValueOnce(new ServiceError("Network unavailable", 0));
    await expect(useAuthStore.getState().validateSession()).rejects.toThrow("Network unavailable");
    expect(useAuthStore.getState()).toMatchObject({ token: "token-1", isLoggedIn: true, contractExpiry: null });
  });

  it("blocks expired password login and allows a renewed successful login to clear the reason", async () => {
    const error = new ServiceError("Renew contract", 401, undefined, { code: "BRANCH_CONTRACT_EXPIRED", contract_end_on: "2026-10-28" });
    checkLoginMock.mockRejectedValueOnce(error);
    await expect(useAuthStore.getState().loginWithPassword("user-1@example.com", "password")).rejects.toBe(error);
    expect(useAuthStore.getState()).toMatchObject({ token: null, user: null, isLoggedIn: false,
      contractExpiry: { endOn: "2026-10-28" } });
    const user = { ...authUser("user-1"), store_status: 2, contract_end_on: "2027-01-12", contract_days_remaining: 77 };
    checkLoginMock.mockResolvedValueOnce({ token: "renewed-token", user });
    await expect(useAuthStore.getState().loginWithPassword("user-1@example.com", "password")).resolves.toEqual(user);
    expect(useAuthStore.getState()).toMatchObject({ token: "renewed-token", isLoggedIn: true, contractExpiry: null });
  });

  it("does not let an older expired password response clear a subsequent successful login", async () => {
    const old = deferred<LoginResult>();
    checkLoginMock.mockReturnValueOnce(old.promise).mockResolvedValueOnce({ token: "token-2", user: authUser("user-2") });
    const first = useAuthStore.getState().loginWithPassword("user-1@example.com", "password");
    await useAuthStore.getState().loginWithPassword("user-2@example.com", "password");
    old.reject(new ServiceError("Expired", 401, undefined, { code: "BRANCH_CONTRACT_EXPIRED" }));
    await expect(first).resolves.toBeNull();
    expect(useAuthStore.getState()).toMatchObject({ token: "token-2", isLoggedIn: true, contractExpiry: null });
  });

  it("invalidates pending logins when expiry clears a live session", async () => {
    const pending = deferred<LoginResult>();
    checkLoginMock.mockReturnValueOnce(pending.promise);
    const login = useAuthStore.getState().loginWithPassword("user-1@example.com", "password");
    useAuthStore.getState().expireContract({ endOn: "2026-10-28" });
    pending.resolve({ token: "late-token", user: authUser("user-1") });
    await expect(login).resolves.toBeNull();
    expect(useAuthStore.getState()).toMatchObject({ token: null, isLoggedIn: false, contractExpiry: { endOn: "2026-10-28" } });
    useAuthStore.getState().clearContractExpiry();
    expect(useAuthStore.getState().contractExpiry).toBeNull();
  });

  it("does not block a valid session with no configured expiry", async () => {
    const user = authUser("user-1");
    useAuthStore.getState().login("token-1", user);
    validateLoginSessionMock.mockResolvedValueOnce({ uuid: user.uuid, login_email: user.email, login_name: "Noy",
      branch_uuid: user.branch_uuid, store_uuid_fk: user.store_uuid, login_status: 1,
      contract_end_on: null, contract_days_remaining: null });
    await expect(useAuthStore.getState().validateSession()).resolves.toBe(true);
    expect(useAuthStore.getState()).toMatchObject({ token: "token-1", isLoggedIn: true, contractExpiry: null });
  });

  it("defaults a legacy session without table status to a store with tables", () => {
    const legacyUser: Partial<AuthUser> = { ...authUser("legacy-user") };
    delete legacyUser.store_table_status;
    delete legacyUser.lak_rounding_version;

    useAuthStore.getState().login("legacy-token", legacyUser as AuthUser);

    expect(useAuthStore.getState().user?.store_table_status).toBe(1);
    expect(useAuthStore.getState().user?.lak_rounding_version).toBe(1);
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
