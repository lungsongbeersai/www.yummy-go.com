import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/simulator", () => ({ getSimulatorBootstrap: vi.fn(), getSimulatorLive: vi.fn() }));
vi.mock("@/lib/api", () => ({
  ServiceError: class ServiceError extends Error {
    constructor(message: string, public statusCode = 500) { super(message); }
  },
}));

import { ServiceError } from "@/lib/api";
import * as api from "@/services/simulator";
import type { SimulatorBootstrap, SimulatorLiveOrder, SimulatorLiveSnapshot, SimulatorLiveTable } from "@/services/simulator";
import { resetSessionStores } from "@/stores/session-store-registry";
import { useSimulatorLiveStore as store } from "./simulator-live-store";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function bootstrap(branch = "branch-1"): SimulatorBootstrap {
  return {
    branch: { branch_uuid: branch, branch_name: branch, store_uuid: "store-1" },
    branches: [{ branch_uuid: branch, branch_name: branch, store_uuid: "store-1" }],
    actor: { login_uuid: "actor-1", name: "Employee", role_id: 1 }, catalog: [], tables: [],
    permissions: { operate: true, confirm: true, pay: true, discount: true, cancel: true, transfer: true, split: true },
  };
}

function table(order: string | null = "order-1"): SimulatorLiveTable {
  return { table_uuid: "table-1", name: "A1", zone_uuid: "zone-1", zone_name: "Dining", seats: 4,
    charge_status: 2, status: order ? 2 : 1, order_uuid: order, guests: null, customer_order_state: false };
}

function order(id = "order-1"): SimulatorLiveOrder {
  return { order_uuid: id, table_uuid: "table-1", status: "open", guests: null, created_at: "2026-10-29T10:00:00Z", items: [],
    totals: { subtotal: 10000, item_discount: 0, bill_discount: 0, service: 0, vat: 0, total: 10000 } };
}

function snapshot(branch = "branch-1"): SimulatorLiveSnapshot {
  return { mode: "live", read_only: true, fetched_at: "2026-10-29T10:00:00Z", branch: bootstrap(branch).branch,
    tables: [table()], orders: [order()], summary: { open_bills: 1, guests: null, pending_items: 0, preparing_items: 0, served_items: 0 },
    limits: { tables: 400, orders: 400, items: 4000 }, truncated: false };
}

beforeEach(() => {
  vi.resetAllMocks();
  store.getState().reset();
  vi.mocked(api.getSimulatorBootstrap).mockResolvedValue(bootstrap());
  vi.mocked(api.getSimulatorLive).mockResolvedValue(snapshot());
});

describe("read-only live restaurant state", () => {
  it("verifies branch access before loading actual data without creating a simulation session", async () => {
    await store.getState().initialize(" BRANCH-1 ", "en");
    expect(api.getSimulatorBootstrap).toHaveBeenCalledWith("branch-1", expect.any(AbortSignal));
    expect(api.getSimulatorLive).toHaveBeenCalledWith("branch-1", "en", expect.any(AbortSignal));
    expect(store.getState()).toMatchObject({ connected: true, loading: false, snapshot: snapshot(), bootstrap: bootstrap() });
  });

  it("deduplicates initialization for the same branch and cancels an older branch load", async () => {
    const old = deferred<SimulatorBootstrap>();
    vi.mocked(api.getSimulatorBootstrap).mockReturnValueOnce(old.promise).mockResolvedValueOnce(bootstrap("branch-2"));
    vi.mocked(api.getSimulatorLive).mockResolvedValueOnce(snapshot("branch-2"));
    const first = store.getState().initialize("branch-1", "en");
    const oldSignal = vi.mocked(api.getSimulatorBootstrap).mock.calls[0][1];
    await store.getState().initialize("branch-1", "en");
    expect(api.getSimulatorBootstrap).toHaveBeenCalledOnce();
    await store.getState().initialize("branch-2", "en");
    expect(oldSignal?.aborted).toBe(true);
    old.resolve(bootstrap());
    await first;
    expect(api.getSimulatorLive).toHaveBeenCalledOnce();
    expect(store.getState().snapshot?.branch.branch_uuid).toBe("branch-2");
  });

  it("discards an older language request even if its transport ignores cancellation", async () => {
    const old = deferred<SimulatorLiveSnapshot>();
    vi.mocked(api.getSimulatorLive).mockReturnValueOnce(old.promise).mockResolvedValueOnce(snapshot());
    const first = store.getState().initialize("branch-1", "en");
    await vi.waitFor(() => expect(api.getSimulatorLive).toHaveBeenCalledOnce());
    const oldSignal = vi.mocked(api.getSimulatorLive).mock.calls[0][2];
    await store.getState().initialize("branch-1", "la");
    old.resolve({ ...snapshot(), fetched_at: "old-language" });
    await first;
    expect(oldSignal?.aborted).toBe(true);
    expect(store.getState().snapshot?.fetched_at).not.toBe("old-language");
  });

  it("rejects bootstrap for a different branch before fetching orders", async () => {
    vi.mocked(api.getSimulatorBootstrap).mockResolvedValueOnce(bootstrap("branch-2"));
    await store.getState().initialize("branch-1", "en");
    expect(api.getSimulatorLive).not.toHaveBeenCalled();
    expect(store.getState()).toMatchObject({ bootstrap: null, snapshot: null, connected: false, loading: false });
    expect(store.getState().error).toContain("authorized branch");
  });

  it.each(["branch", "store", "read-only"])("discards a snapshot whose %s contract is outside the authorized view", async (mismatch) => {
    const invalid = snapshot(mismatch === "branch" ? "branch-2" : "branch-1");
    if (mismatch === "store") invalid.branch.store_uuid = "other-store";
    if (mismatch === "read-only") Object.assign(invalid, { read_only: false });
    vi.mocked(api.getSimulatorLive).mockResolvedValueOnce(invalid);
    await store.getState().initialize("branch-1", "en");
    expect(store.getState()).toMatchObject({ connected: false, snapshot: null, bootstrap: null });
    expect(store.getState().error).toContain("authorized restaurant branch");
  });

  it("allows one refresh at a time and reconciles selection when a bill closes", async () => {
    await store.getState().initialize("branch-1", "en");
    store.getState().selectTable("table-1");
    expect(store.getState().selectedOrderId).toBe("order-1");
    const next = deferred<SimulatorLiveSnapshot>();
    vi.mocked(api.getSimulatorLive).mockReturnValueOnce(next.promise);
    const refresh = store.getState().refresh("en");
    await store.getState().refresh("en");
    expect(api.getSimulatorLive).toHaveBeenCalledTimes(2);
    next.resolve({ ...snapshot(), tables: [table("order-2")], orders: [order("order-2")] });
    await refresh;
    expect(store.getState()).toMatchObject({ selectedTableId: "table-1", selectedOrderId: "order-2", connected: true, refreshing: false });
  });

  it("keeps an explicitly selected split bill and supports a counter order", async () => {
    const value = { ...snapshot(), orders: [order(), order("order-2"), { ...order("counter"), table_uuid: null }] };
    vi.mocked(api.getSimulatorLive).mockResolvedValue(value);
    await store.getState().initialize("branch-1", "en");
    store.getState().selectOrder("order-2");
    await store.getState().refresh("en");
    expect(store.getState()).toMatchObject({ selectedOrderId: "order-2", selectedTableId: "table-1" });
    store.getState().selectOrder("counter");
    await store.getState().refresh("en");
    expect(store.getState()).toMatchObject({ selectedOrderId: "counter", selectedTableId: null });
  });

  it("marks an old snapshot stale on a connection error and replaces it only after a successful GET", async () => {
    await store.getState().initialize("branch-1", "en");
    vi.mocked(api.getSimulatorLive).mockRejectedValueOnce(new ServiceError("Server unavailable", 503));
    await store.getState().refresh("en");
    expect(store.getState()).toMatchObject({ connected: false, refreshing: false, snapshot: snapshot(), error: "Server unavailable" });
    vi.mocked(api.getSimulatorLive).mockResolvedValueOnce({ ...snapshot(), orders: [], tables: [table(null)] });
    await store.getState().refresh("en");
    expect(store.getState()).toMatchObject({ connected: true, error: null, snapshot: { orders: [] } });
  });

  it.each([401, 403])("clears visible orders immediately when access is revoked with HTTP%s", async (status) => {
    await store.getState().initialize("branch-1", "en");
    store.getState().selectTable("table-1");
    vi.mocked(api.getSimulatorLive).mockRejectedValueOnce(new ServiceError("Permission revoked", status));
    await store.getState().refresh("en");
    expect(store.getState()).toMatchObject({ connected: false, bootstrap: null, snapshot: null, selectedTableId: null, selectedOrderId: null, error: "Permission revoked" });
  });

  it("aborts an inactive window's initial load without accepting its late response", async () => {
    const pending = deferred<SimulatorBootstrap>();
    vi.mocked(api.getSimulatorBootstrap).mockReturnValueOnce(pending.promise);
    const first = store.getState().initialize("branch-1", "en");
    const signal = vi.mocked(api.getSimulatorBootstrap).mock.calls[0][1];
    store.getState().suspend();
    pending.resolve(bootstrap());
    await first;
    expect(signal?.aborted).toBe(true);
    expect(api.getSimulatorLive).not.toHaveBeenCalled();
    expect(store.getState()).toMatchObject({ loading: false, refreshing: false, snapshot: null });
  });

  it("aborts a refresh on blur and ignores a late update until the next foreground read", async () => {
    await store.getState().initialize("branch-1", "en");
    const pending = deferred<SimulatorLiveSnapshot>();
    vi.mocked(api.getSimulatorLive).mockReturnValueOnce(pending.promise);
    const first = store.getState().refresh("en");
    const signal = vi.mocked(api.getSimulatorLive).mock.calls[1][2];
    store.getState().suspend();
    pending.resolve({ ...snapshot(), orders: [], fetched_at: "late" });
    await first;
    expect(signal?.aborted).toBe(true);
    expect(store.getState().snapshot?.fetched_at).not.toBe("late");
    expect(store.getState().refreshing).toBe(false);
  });

  it("replaces an in-flight language read without clearing the authorized snapshot or table selection", async () => {
    await store.getState().initialize("branch-1", "en");
    store.getState().selectTable("table-1");
    const old = deferred<SimulatorLiveSnapshot>();
    vi.mocked(api.getSimulatorLive).mockReturnValueOnce(old.promise);
    const first = store.getState().refresh("en");
    const oldSignal = vi.mocked(api.getSimulatorLive).mock.calls[1][2];
    store.getState().suspend();
    expect(store.getState()).toMatchObject({ bootstrap: bootstrap(), snapshot: snapshot(), selectedTableId: "table-1", selectedOrderId: "order-1" });
    const translated = snapshot();
    translated.tables[0].name = "ໂຕະ A1";
    vi.mocked(api.getSimulatorLive).mockResolvedValueOnce(translated);
    await store.getState().refresh("la");
    expect(api.getSimulatorBootstrap).toHaveBeenCalledOnce();
    expect(api.getSimulatorLive).toHaveBeenLastCalledWith("branch-1", "la", expect.any(AbortSignal));
    old.resolve(snapshot());
    await first;
    expect(oldSignal?.aborted).toBe(true);
    expect(store.getState()).toMatchObject({ snapshot: translated, selectedTableId: "table-1", selectedOrderId: "order-1", connected: true, refreshing: false });
  });

  it("clears restaurant data and cancels in-flight reads when authentication resets", async () => {
    await store.getState().initialize("branch-1", "en");
    const pending = deferred<SimulatorLiveSnapshot>();
    vi.mocked(api.getSimulatorLive).mockReturnValueOnce(pending.promise);
    const first = store.getState().refresh("en");
    const signal = vi.mocked(api.getSimulatorLive).mock.calls[1][2];
    resetSessionStores();
    pending.resolve(snapshot());
    await first;
    expect(signal?.aborted).toBe(true);
    expect(store.getState()).toMatchObject({ bootstrap: null, snapshot: null, connected: false, selectedTableId: null, selectedOrderId: null });
  });
});
