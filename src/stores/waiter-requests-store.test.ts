import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetSessionStores } from "@/stores/session-store-registry";
import type { CustomerWaiterState, WaiterRequest } from "@/services/waiter-requests";
import * as api from "@/services/waiter-requests";
import { useWaiterRequestsStore as store } from "./waiter-requests-store";
vi.mock("@/services/waiter-requests", () => ({
  fetchCustomerWaiterState: vi.fn(),
  sendCustomerWaiterRequest: vi.fn(),
  fetchStaffWaiterRequests: vi.fn(),
  updateStaffWaiterRequest: vi.fn(),
}));
const row: WaiterRequest = {
  request_uuid: "request",
  table_uuid: "table",
  branch_uuid: "branch",
  items: [{ kind: "bowl", qty: 2 }],
  message: "help",
  status: 0,
  created_at: "2026-10-02T00:00:00Z",
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { resolve, promise };
}
beforeEach(() => {
  vi.resetAllMocks();
  store.setState({
    publicRequests: [],
    staffRequests: [],
    publicKey: "",
    staffKey: "",
    publicLoading: false,
    publicBillRequestsEnabled: false,
    staffLoading: false,
    staffPanelOpen: false,
    sending: false,
    handling: "",
    publicError: null,
    staffError: null,
  });
  vi.mocked(api.fetchCustomerWaiterState).mockResolvedValue({ requests: [], billRequestsEnabled: false });
  vi.mocked(api.fetchStaffWaiterRequests).mockResolvedValue([]);
});
describe("waiter request store", () => {
  it("reports a refresh as successful only after its response is applied", async () => {
    const response = deferred<CustomerWaiterState>();
    vi.mocked(api.fetchCustomerWaiterState).mockReturnValueOnce(response.promise);
    const refresh = store.getState().loadPublic("token");
    expect(store.getState()).toMatchObject({ publicLoading: true, publicRequests: [] });

    response.resolve({ requests: [row], billRequestsEnabled: true });
    expect(await refresh).toBe(true);
    expect(store.getState()).toMatchObject({
      publicRequests: [row],
      publicBillRequestsEnabled: true,
      publicLoading: false,
      publicError: null,
    });
  });
  it("reports failed refreshes without claiming success or discarding visible requests", async () => {
    store.setState({ publicKey: "token", publicRequests: [row], publicBillRequestsEnabled: true });
    vi.mocked(api.fetchCustomerWaiterState).mockRejectedValueOnce(new Error("Unavailable"));

    expect(await store.getState().loadPublic("token")).toBe(false);
    expect(store.getState()).toMatchObject({
      publicRequests: [row],
      publicError: "Unavailable",
      publicLoading: false,
      publicBillRequestsEnabled: false,
    });
  });
  it("does not report success for an older refresh while a newer one is pending", async () => {
    const older = deferred<CustomerWaiterState>();
    const latest = deferred<CustomerWaiterState>();
    vi.mocked(api.fetchCustomerWaiterState)
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(latest.promise);
    const first = store.getState().loadPublic("token");
    const second = store.getState().loadPublic("token");

    older.resolve({ requests: [row], billRequestsEnabled: true });
    expect(await first).toBe(false);
    expect(store.getState()).toMatchObject({ publicLoading: true, publicRequests: [], publicBillRequestsEnabled: false });

    const accepted: WaiterRequest = { ...row, status: 1 };
    latest.resolve({ requests: [accepted], billRequestsEnabled: true });
    expect(await second).toBe(true);
    expect(store.getState()).toMatchObject({ publicLoading: false, publicRequests: [accepted] });
  });
  it("does not report success when the session ends before a public refresh completes", async () => {
    const response = deferred<CustomerWaiterState>();
    vi.mocked(api.fetchCustomerWaiterState).mockReturnValueOnce(response.promise);
    const refresh = store.getState().loadPublic("token");
    resetSessionStores();

    response.resolve({ requests: [row], billRequestsEnabled: true });
    expect(await refresh).toBe(false);
    expect(store.getState()).toMatchObject({ publicKey: "", publicRequests: [], publicBillRequestsEnabled: false });
  });
  it("discards stale customer responses after changing QR", async () => {
    const old = deferred<CustomerWaiterState>();
    vi.mocked(api.fetchCustomerWaiterState)
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce({ requests: [row], billRequestsEnabled: false });
    const first = store.getState().loadPublic("old");
    await store.getState().loadPublic("new");
    old.resolve({ requests: [], billRequestsEnabled: true });
    await first;
    expect(store.getState().publicRequests).toEqual([row]);
    expect(store.getState().publicKey).toBe("new");
    expect(store.getState().publicBillRequestsEnabled).toBe(false);
  });
  it("clears old branch data and ignores its late response", async () => {
    const old = deferred<WaiterRequest[]>();
    vi.mocked(api.fetchStaffWaiterRequests)
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce([]);
    const first = store.getState().loadStaff("old");
    await store.getState().loadStaff("new");
    old.resolve([row]);
    await first;
    expect(store.getState().staffRequests).toEqual([]);
    expect(store.getState().staffKey).toBe("new");
  });
  it("does not claim success or create local requests on failed sends", async () => {
    store.setState({ publicKey: "token" });
    vi.mocked(api.sendCustomerWaiterRequest).mockRejectedValue(
      new Error("Unavailable")
    );
    expect(
      await store.getState().send("token", {
        client_request_uuid: "id",
        items: row.items,
        message: "help",
      })
    ).toBe(false);
    expect(store.getState()).toMatchObject({
      publicRequests: [],
      publicError: "Unavailable",
      sending: false,
    });
  });
  it("blocks double taps and reconciles after a committed send", async () => {
    const result = deferred<WaiterRequest>();
    store.setState({ publicKey: "token" });
    vi.mocked(api.sendCustomerWaiterRequest).mockReturnValue(result.promise);
    vi.mocked(api.fetchCustomerWaiterState).mockResolvedValue({ requests: [row], billRequestsEnabled: false });
    const input = {
      client_request_uuid: "id",
      items: row.items,
      message: "help",
    };
    const first = store.getState().send("token", input);
    expect(await store.getState().send("token", input)).toBe(false);
    result.resolve(row);
    expect(await first).toBe(true);
    await Promise.resolve();
    expect(api.sendCustomerWaiterRequest).toHaveBeenCalledTimes(1);
    expect(store.getState().publicRequests).toEqual([row]);
  });
  it("reports acceptance only after Backend accepts the request", async () => {
    store.setState({ staffKey: "branch", staffRequests: [row] });
    vi.mocked(api.updateStaffWaiterRequest).mockResolvedValue({ ...row, status: 1 });
    vi.mocked(api.fetchStaffWaiterRequests).mockResolvedValue([{ ...row, status: 1 }]);
    expect(await store.getState().handle("request", 1)).toBe(true);
    expect(api.updateStaffWaiterRequest).toHaveBeenCalledWith("request", 1);
    expect(store.getState().staffRequests[0]?.status).toBe(1);
  });
  it("reports an update failure so callers keep the request panel open", async () => {
    store.setState({ staffKey: "branch", staffRequests: [row] });
    vi.mocked(api.updateStaffWaiterRequest).mockRejectedValue(new Error("Unavailable"));
    expect(await store.getState().handle("request", 1)).toBe(false);
    expect(store.getState().staffRequests).toEqual([row]);
  });
  it("blocks duplicate accepts and discards a late result after switching branches", async () => {
    const response = deferred<WaiterRequest>();
    store.setState({ staffKey: "branch", staffRequests: [row] });
    vi.mocked(api.updateStaffWaiterRequest).mockReturnValue(response.promise);
    const accepting = store.getState().handle("request", 1);
    expect(await store.getState().handle("request", 1)).toBe(false);
    store.setState({ staffKey: "other", staffRequests: [] });
    response.resolve({ ...row, status: 1 });
    expect(await accepting).toBe(false);
    expect(api.fetchStaffWaiterRequests).not.toHaveBeenCalled();
  });
  it("discards an acceptance after the session ends", async () => {
    const response = deferred<WaiterRequest>();
    store.setState({ staffKey: "branch", staffRequests: [row] });
    vi.mocked(api.updateStaffWaiterRequest).mockReturnValue(response.promise);
    const accepting = store.getState().handle("request", 1);
    resetSessionStores();
    response.resolve({ ...row, status: 1 });
    expect(await accepting).toBe(false);
    expect(store.getState().staffRequests).toEqual([]);
  });
  it("keeps cashier requests visible if completion fails", async () => {
    store.setState({ staffKey: "branch", staffRequests: [row] });
    vi.mocked(api.updateStaffWaiterRequest).mockRejectedValue(
      new Error("Unavailable")
    );
    await store.getState().handle("request", 2);
    expect(store.getState()).toMatchObject({
      staffRequests: [row],
      handling: "",
      staffError: "Unavailable",
    });
  });

  it("sends a bill request only after the current QR's server confirms support", async () => {
    const bill: WaiterRequest = { ...row, request_type: "bill", items: [] };
    const input = { client_request_uuid: "bill-attempt", request_type: "bill" as const, items: [], message: "Bring the bill" };
    store.setState({ publicKey: "token" });
    expect(await store.getState().send("token", input)).toBe(false);
    expect(api.sendCustomerWaiterRequest).not.toHaveBeenCalled();
    vi.mocked(api.fetchCustomerWaiterState).mockResolvedValue({ requests: [], billRequestsEnabled: true });
    await store.getState().loadPublic("token");
    vi.mocked(api.sendCustomerWaiterRequest).mockResolvedValue(bill);
    vi.mocked(api.fetchCustomerWaiterState).mockResolvedValue({ requests: [bill], billRequestsEnabled: true });
    expect(await store.getState().send("token", input)).toBe(true);
    expect(api.sendCustomerWaiterRequest).toHaveBeenCalledWith("token", input);
    expect(store.getState().publicRequests).toEqual([bill]);
  });

  it("removes bill capability immediately when switching QR or reloading fails", async () => {
    store.setState({ publicKey: "old", publicBillRequestsEnabled: true });
    const response = deferred<CustomerWaiterState>();
    vi.mocked(api.fetchCustomerWaiterState).mockReturnValueOnce(response.promise);
    const loading = store.getState().loadPublic("new");
    expect(store.getState().publicBillRequestsEnabled).toBe(false);
    response.resolve({ requests: [], billRequestsEnabled: true });
    await loading;
    expect(store.getState().publicBillRequestsEnabled).toBe(true);
    vi.mocked(api.fetchCustomerWaiterState).mockRejectedValueOnce(new Error("Unavailable"));
    await store.getState().loadPublic("new");
    expect(store.getState()).toMatchObject({ publicBillRequestsEnabled: false, publicError: "Unavailable" });
  });

  it("does not send a bill with capability from another QR", async () => {
    store.setState({ publicKey: "other-table", publicBillRequestsEnabled: true });
    expect(await store.getState().send("token", { client_request_uuid: "id", request_type: "bill", items: [], message: "Bill" })).toBe(false);
    expect(api.sendCustomerWaiterRequest).not.toHaveBeenCalled();
  });
});

it("clears request data on logout and discards in-flight responses", async () => {
  const response = deferred<WaiterRequest[]>();
  vi.mocked(api.fetchStaffWaiterRequests).mockReturnValueOnce(response.promise);
  const loading = store.getState().loadStaff("branch");
  store.getState().setStaffPanelOpen(true);
  store.setState({ publicBillRequestsEnabled: true });
  resetSessionStores();
  response.resolve([row]);
  await loading;
  expect(store.getState()).toMatchObject({
    staffRequests: [],
    staffKey: "",
    staffLoading: false,
    staffPanelOpen: false,
    publicBillRequestsEnabled: false,
  });
});
