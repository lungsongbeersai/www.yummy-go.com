import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetSessionStores } from "@/stores/session-store-registry";
import type { WaiterRequest } from "@/services/waiter-requests";
import * as api from "@/services/waiter-requests";
import { useWaiterRequestsStore as store } from "./waiter-requests-store";
vi.mock("@/services/waiter-requests", () => ({
  fetchCustomerWaiterRequests: vi.fn(),
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
    staffLoading: false,
    sending: false,
    handling: "",
    publicError: null,
    staffError: null,
  });
  vi.mocked(api.fetchCustomerWaiterRequests).mockResolvedValue([]);
  vi.mocked(api.fetchStaffWaiterRequests).mockResolvedValue([]);
});
describe("waiter request store", () => {
  it("discards stale customer responses after changing QR", async () => {
    const old = deferred<WaiterRequest[]>();
    vi.mocked(api.fetchCustomerWaiterRequests)
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce([row]);
    const first = store.getState().loadPublic("old");
    await store.getState().loadPublic("new");
    old.resolve([]);
    await first;
    expect(store.getState().publicRequests).toEqual([row]);
    expect(store.getState().publicKey).toBe("new");
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
    vi.mocked(api.fetchCustomerWaiterRequests).mockResolvedValue([row]);
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
});

it("clears request data on logout and discards in-flight responses", async () => {
  const response = deferred<WaiterRequest[]>();
  vi.mocked(api.fetchStaffWaiterRequests).mockReturnValueOnce(response.promise);
  const loading = store.getState().loadStaff("branch");
  resetSessionStores();
  response.resolve([row]);
  await loading;
  expect(store.getState()).toMatchObject({
    staffRequests: [],
    staffKey: "",
    staffLoading: false,
  });
});
