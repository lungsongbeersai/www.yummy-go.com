import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/simulator", () => ({
  getSimulatorBootstrap: vi.fn(), listSimulatorSessions: vi.fn(), createSimulatorSession: vi.fn(),
  getSimulatorSession: vi.fn(), runSimulatorAction: vi.fn(), watchSimulatorSession: vi.fn(),
}));
vi.mock("@/lib/api", () => ({
  ServiceError: class ServiceError extends Error {
    constructor(message: string, public statusCode = 500) { super(message); }
  },
}));

import { ServiceError } from "@/lib/api";
import * as api from "@/services/simulator";
import type { SimulatorBootstrap, SimulatorOrder, SimulatorSession } from "@/services/simulator";
import { resetSessionStores } from "@/stores/session-store-registry";
import { isSimulatorConnectionError, useSimulatorStore as store } from "./simulator-store";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { resolve, reject, promise };
}

function bootstrap(branch = "branch-1"): SimulatorBootstrap {
  return {
    branch: { branch_uuid: branch, branch_name: branch, store_uuid: "store-1" },
    branches: [{ branch_uuid: branch, branch_name: branch, store_uuid: "store-1" }],
    actor: { login_uuid: "cashier-1", name: "Cashier", role_id: 1 },
    catalog: [], tables: [],
    permissions: { operate: true, confirm: true, pay: true, discount: true, cancel: true, transfer: true, split: true },
  };
}

function session(overrides: Partial<SimulatorSession> = {}): SimulatorSession {
  return {
    session_uuid: "session-1", branch_uuid: "branch-1", store_uuid: "store-1", name: "Lunch", version: 7,
    status: "running", mode: "manual", tick: 0, config: bootstrap().branch,
    catalog: [], tables: [], orders: [], kitchen: [], customers: [], activity: [],
    sales: { total: 0, bills: 0, guests: 0 }, ...overrides,
  };
}

function order(overrides: Partial<SimulatorOrder> = {}): SimulatorOrder {
  return {
    order_uuid: "order-1", table_uuid: "table-1", customer_name: "Customer", guests: 2, status: "open",
    items: [], discount_type: 1, discount_value: 0,
    totals: { subtotal: 10000, item_discount: 0, bill_discount: 0, service: 0, vat: 0, total: 10000, paid: 0, balance: 10000 },
    payments: [], created_at: "2026-10-27T12:00:00Z", ...overrides,
  };
}

function activate(snapshot = session()) {
  store.setState({ bootstrap: bootstrap(snapshot.branch_uuid), session: snapshot, connected: true });
}

beforeEach(() => {
  vi.resetAllMocks();
  store.getState().reset();
  vi.mocked(api.getSimulatorBootstrap).mockResolvedValue(bootstrap());
  vi.mocked(api.listSimulatorSessions).mockResolvedValue([]);
  vi.mocked(api.getSimulatorSession).mockResolvedValue(session());
  vi.mocked(api.createSimulatorSession).mockResolvedValue(session({ session_uuid: "session-new", version: 1 }));
  vi.mocked(api.runSimulatorAction).mockResolvedValue(session({ version: 8 }));
});

describe("server-authoritative simulator state", () => {
  it("loads authorized bootstrap and existing sessions before allowing a new server session", async () => {
    vi.mocked(api.listSimulatorSessions).mockResolvedValue([{ session_uuid: "saved-1", name: "Dinner", status: "paused", version: 3 }]);
    await store.getState().initialize("branch-1");
    expect(store.getState()).toMatchObject({ connected: true, loading: false, session: null, bootstrap: bootstrap() });
    expect(api.listSimulatorSessions).toHaveBeenCalledWith("branch-1");
    vi.mocked(api.runSimulatorAction).mockResolvedValueOnce(session({ session_uuid: "session-new", version: 2 }));
    await store.getState().startSession("Lunch");
    expect(api.createSimulatorSession).toHaveBeenCalledWith("branch-1", "Lunch");
    expect(store.getState().session?.session_uuid).toBe("session-new");
    expect(store.getState().sessions.map((entry) => entry.session_uuid)).toEqual(["session-new", "saved-1"]);
    expect(api.runSimulatorAction).toHaveBeenCalledWith("session-new", expect.objectContaining({ type: "start", expected_version: 1 }));
  });

  it("blocks duplicate session creation while the first online request is pending", async () => {
    const created = deferred<SimulatorSession>();
    store.setState({ bootstrap: bootstrap(), connected: true });
    vi.mocked(api.createSimulatorSession).mockReturnValue(created.promise);
    const first = store.getState().startSession();
    await store.getState().startSession();
    expect(api.createSimulatorSession).toHaveBeenCalledOnce();
    expect(store.getState().session).toBeNull();
    created.resolve(session());
    await first;
    expect(store.getState().saving).toBe(false);
  });

  it("discards an earlier branch load that finishes after switching branches", async () => {
    const old = deferred<SimulatorBootstrap>();
    vi.mocked(api.getSimulatorBootstrap).mockReturnValueOnce(old.promise).mockResolvedValueOnce(bootstrap("branch-2"));
    const first = store.getState().initialize("branch-1");
    await store.getState().initialize("branch-2");
    old.resolve(bootstrap("branch-1"));
    await first;
    expect(store.getState().bootstrap?.branch.branch_uuid).toBe("branch-2");
    expect(store.getState().session).toBeNull();
    expect(store.getState().connected).toBe(true);
  });

  it("clears old branch state and exposes failed bootstrap without allowing session creation", async () => {
    activate();
    vi.mocked(api.getSimulatorBootstrap).mockRejectedValueOnce(new ServiceError("Branch access denied", 403));
    await store.getState().initialize("branch-forbidden");
    expect(store.getState()).toMatchObject({
      bootstrap: null, session: null, sessions: [], connected: false, loading: false, error: "Branch access denied",
    });
    expect(api.listSimulatorSessions).not.toHaveBeenCalled();
    await store.getState().startSession("Unauthorized");
    expect(api.createSimulatorSession).not.toHaveBeenCalled();
  });

  it("does not restore bootstrap or session state after logout interrupts initialization", async () => {
    const old = deferred<SimulatorBootstrap>();
    vi.mocked(api.getSimulatorBootstrap).mockReturnValueOnce(old.promise);
    const request = store.getState().initialize("branch-1");
    resetSessionStores();
    old.resolve(bootstrap());
    await request;
    expect(store.getState()).toMatchObject({ bootstrap: null, session: null, sessions: [], loading: false, connected: false });
  });

  it("does not load a different branch session under the currently selected branch header", async () => {
    const original = session();
    activate(original);
    vi.mocked(api.getSimulatorSession).mockResolvedValueOnce(session({ session_uuid: "other-session", branch_uuid: "branch-2", config: bootstrap("branch-2").branch }));
    await store.getState().loadSession("other-session");
    expect(store.getState().session).toBe(original);
    expect(store.getState().bootstrap?.branch.branch_uuid).toBe("branch-1");
    expect(store.getState().error).toEqual(expect.any(String));
    expect(api.runSimulatorAction).not.toHaveBeenCalled();
  });

  it("blocks double taps and keeps the existing authoritative snapshot until the server commits", async () => {
    const updated = deferred<SimulatorSession>();
    const original = session({ orders: [order()] });
    activate(original);
    vi.mocked(api.runSimulatorAction).mockReturnValue(updated.promise);
    const first = store.getState().command("pay", { order_uuid: "order-1", amount: 10000 });
    await expect(store.getState().command("pay", { order_uuid: "order-1", amount: 10000 })).resolves.toBe(false);
    expect(api.runSimulatorAction).toHaveBeenCalledOnce();
    expect(store.getState().session).toBe(original);
    expect(store.getState().saving).toBe(true);
    const paid = session({ version: 8, orders: [order({ status: "paid" })], sales: { total: 10000, bills: 1, guests: 2 } });
    updated.resolve(paid);
    await expect(first).resolves.toBe(true);
    expect(store.getState().session).toBe(paid);
    expect(store.getState().pending).toBeNull();
    expect(store.getState().saving).toBe(false);
  });

  it("rejects new transactions while disconnected, loading, or unresolved", async () => {
    activate();
    store.getState().disconnect();
    expect(await store.getState().command("open_table")).toBe(false);
    store.setState({ connected: true, loading: true });
    expect(await store.getState().command("open_table")).toBe(false);
    store.setState({ loading: false, pending: { session_uuid: "session-1", action: { operation_uuid: "unknown", expected_version: 7, type: "pay", payload: {} } } });
    expect(await store.getState().command("open_table")).toBe(false);
    expect(api.runSimulatorAction).not.toHaveBeenCalled();
  });

  it("leaves bills and sales unchanged on a failed online payment and retains its original operation key", async () => {
    const original = session({ orders: [order()] });
    activate(original);
    vi.mocked(api.runSimulatorAction).mockRejectedValue(new ServiceError("Connection interrupted", 0));
    expect(await store.getState().command("pay", { order_uuid: "order-1", amount: 10000 })).toBe(false);
    expect(store.getState().session).toBe(original);
    expect(store.getState()).toMatchObject({ connected: false, saving: false, error: "Connection interrupted" });
    expect(store.getState().pending?.action).toBe(vi.mocked(api.runSimulatorAction).mock.calls[0][1]);
  });

  it("restores server state before replaying an interrupted operation with exactly the same key and payload", async () => {
    activate();
    vi.mocked(api.runSimulatorAction).mockRejectedValueOnce(new ServiceError("Connection timed out", 408));
    await store.getState().command("pay", { order_uuid: "order-1", amount: 10000 });
    const pending = store.getState().pending;
    const loaded = deferred<SimulatorSession>();
    vi.mocked(api.getSimulatorSession).mockReturnValueOnce(loaded.promise);
    vi.mocked(api.runSimulatorAction).mockResolvedValueOnce(session({ version: 8 }));
    const recovery = store.getState().reconnect();
    expect(store.getState().connected).toBe(false);
    expect(api.runSimulatorAction).toHaveBeenCalledTimes(1);
    loaded.resolve(session({ version: 8 }));
    await recovery;
    expect(api.runSimulatorAction).toHaveBeenNthCalledWith(2, pending?.session_uuid, pending?.action);
    expect(vi.mocked(api.runSimulatorAction).mock.calls[1][1]).toBe(pending?.action);
    expect(store.getState()).toMatchObject({ connected: true, pending: null, loading: false, session: { version: 8 } });
  });

  it("retains the unresolved operation and blocks new commands when reconnect cannot obtain server state", async () => {
    const original = session({ orders: [order()] });
    activate(original);
    vi.mocked(api.runSimulatorAction).mockRejectedValueOnce(new ServiceError("Interrupted", 0));
    await store.getState().command("pay", { order_uuid: "order-1", amount: 10000 });
    const pending = store.getState().pending;
    vi.mocked(api.getSimulatorSession).mockRejectedValueOnce(new ServiceError("Backend unavailable", 503));
    await store.getState().reconnect();
    expect(store.getState().session).toBe(original);
    expect(store.getState().pending).toBe(pending);
    expect(store.getState()).toMatchObject({ connected: false, loading: false, error: "Backend unavailable" });
    expect(api.runSimulatorAction).toHaveBeenCalledOnce();
    expect(await store.getState().command("pay", {})).toBe(false);
    expect(api.runSimulatorAction).toHaveBeenCalledOnce();
  });

  it("surfaces a permission rejection without queuing it for replay or fabricating state", async () => {
    const original = session();
    activate(original);
    vi.mocked(api.runSimulatorAction).mockRejectedValueOnce(new ServiceError("Not permitted", 403));
    expect(await store.getState().command("discount", { value: 10 })).toBe(false);
    expect(store.getState()).toMatchObject({ connected: true, pending: null, error: "Not permitted" });
    expect(store.getState().session).toBe(original);
  });

  it("refreshes a conflicting version from the server without retrying the conflicting transaction", async () => {
    activate();
    vi.mocked(api.runSimulatorAction).mockRejectedValueOnce(new ServiceError("State changed", 409));
    vi.mocked(api.getSimulatorSession).mockResolvedValueOnce(session({ version: 9 }));
    expect(await store.getState().command("transfer", { target_table_uuid: "table-2" })).toBe(false);
    expect(api.runSimulatorAction).toHaveBeenCalledOnce();
    expect(api.getSimulatorSession).toHaveBeenCalledWith("session-1");
    expect(store.getState()).toMatchObject({ session: { version: 9 }, connected: true, pending: null });
  });

  it("does not let a delayed conflict refresh overwrite a later successful command", async () => {
    activate();
    const oldSnapshot = deferred<SimulatorSession>();
    vi.mocked(api.runSimulatorAction).mockRejectedValueOnce(new ServiceError("State changed", 409));
    vi.mocked(api.getSimulatorSession).mockReturnValueOnce(oldSnapshot.promise);
    const conflicting = store.getState().command("transfer", { target_table_uuid: "table-2" });
    await vi.waitFor(() => expect(api.getSimulatorSession).toHaveBeenCalledOnce());
    vi.mocked(api.runSimulatorAction).mockResolvedValueOnce(session({ version: 11 }));
    expect(await store.getState().command("pause")).toBe(true);
    oldSnapshot.resolve(session({ version: 9 }));
    await conflicting;
    expect(store.getState().session?.version).toBe(11);
  });

  it("passes abort to long polling and ignores cancellation when the window closes", async () => {
    const result = deferred<SimulatorSession>();
    activate();
    vi.mocked(api.watchSimulatorSession).mockReturnValueOnce(result.promise);
    const controller = new AbortController();
    const request = store.getState().watch(controller.signal);
    expect(api.watchSimulatorSession).toHaveBeenCalledWith("session-1", 7, controller.signal);
    controller.abort();
    result.reject(new ServiceError("Request aborted", 0));
    await request;
    expect(store.getState()).toMatchObject({ connected: true, error: null, session: { version: 7 } });
  });

  it("halts transactions on an actual long-poll connection failure", async () => {
    activate();
    vi.mocked(api.watchSimulatorSession).mockRejectedValueOnce(new ServiceError("Backend disconnected", 0));
    await store.getState().watch(new AbortController().signal);
    expect(store.getState()).toMatchObject({ connected: false, error: "Backend disconnected" });
    expect(await store.getState().command("tick")).toBe(false);
    expect(api.runSimulatorAction).not.toHaveBeenCalled();
  });

  it("ignores stale event versions and responses received after branch switching", async () => {
    activate(session({ version: 12 }));
    vi.mocked(api.watchSimulatorSession).mockResolvedValueOnce(session({ version: 8 }));
    await store.getState().watch(new AbortController().signal);
    expect(store.getState().session?.version).toBe(12);
    const old = deferred<SimulatorSession>();
    vi.mocked(api.watchSimulatorSession).mockReturnValueOnce(old.promise);
    const request = store.getState().watch(new AbortController().signal);
    vi.mocked(api.getSimulatorBootstrap).mockResolvedValueOnce(bootstrap("branch-2"));
    await store.getState().initialize("branch-2");
    old.resolve(session({ version: 13 }));
    await request;
    expect(store.getState().bootstrap?.branch.branch_uuid).toBe("branch-2");
    expect(store.getState().session).toBeNull();
  });

  it.each(["refresh", "watch"] as const)("does not let %s overwrite a newer committed action with an older snapshot", async (source) => {
    activate();
    const response = deferred<SimulatorSession>();
    if (source === "refresh") vi.mocked(api.getSimulatorSession).mockReturnValueOnce(response.promise);
    else vi.mocked(api.watchSimulatorSession).mockReturnValueOnce(response.promise);
    const pending = source === "refresh" ? store.getState().refresh() : store.getState().watch(new AbortController().signal);
    vi.mocked(api.runSimulatorAction).mockResolvedValueOnce(session({ version: 12 }));
    expect(await store.getState().command("pause")).toBe(true);
    response.resolve(session({ version: 9 }));
    await pending;
    expect(store.getState().session?.version).toBe(12);
  });

  it("clears simulation state on logout and ignores an in-flight command result", async () => {
    const result = deferred<SimulatorSession>();
    activate();
    vi.mocked(api.runSimulatorAction).mockReturnValueOnce(result.promise);
    const command = store.getState().command("pay", { amount: 10000 });
    resetSessionStores();
    result.resolve(session({ version: 8 }));
    expect(await command).toBe(false);
    expect(store.getState()).toMatchObject({ session: null, bootstrap: null, pending: null, connected: false, saving: false });
  });

  it("does not replay an interrupted payment after logout while reconnect is awaiting authentication", async () => {
    activate();
    vi.mocked(api.runSimulatorAction).mockRejectedValueOnce(new ServiceError("Interrupted", 0));
    await store.getState().command("pay", { amount: 10000 });
    const recoveryState = deferred<SimulatorSession>();
    vi.mocked(api.getSimulatorSession).mockReturnValueOnce(recoveryState.promise);
    const recovery = store.getState().reconnect();
    resetSessionStores();
    recoveryState.resolve(session({ version: 8 }));
    await recovery;
    expect(api.runSimulatorAction).toHaveBeenCalledOnce();
    expect(store.getState()).toMatchObject({ session: null, pending: null, connected: false });
  });

  it("selects a newly split counter bill and releases the selection when it is paid", async () => {
    activate(session({ orders: [order()] }));
    const split = order({ order_uuid: "counter-bill", table_uuid: null });
    vi.mocked(api.runSimulatorAction).mockResolvedValueOnce(session({ version: 8, orders: [order(), split] }));
    expect(await store.getState().command("split", {})).toBe(true);
    expect(store.getState()).toMatchObject({ selectedOrderId: "counter-bill", selectedTableId: null });
    vi.mocked(api.runSimulatorAction).mockResolvedValueOnce(session({ version: 9, orders: [order(), { ...split, status: "paid" }] }));
    expect(await store.getState().command("pay", {})).toBe(true);
    expect(store.getState()).toMatchObject({ selectedOrderId: null, selectedTableId: null });
  });

  it.each([0, 408, 500, 503])("treats status %s as an unknown online outcome", (status) => {
    expect(isSimulatorConnectionError(new ServiceError("Unavailable", status))).toBe(true);
  });
  it.each([400, 401, 403, 404, 409, 422])("does not queue a definite status %s rejection as a network outage", (status) => {
    expect(isSimulatorConnectionError(new ServiceError("Rejected", status))).toBe(false);
  });
});
