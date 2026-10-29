"use client";

import { create } from "zustand";
import { ServiceError } from "@/lib/api";
import * as simulator from "@/services/simulator";
import type { SimulatorBootstrap, SimulatorLiveSnapshot } from "@/services/simulator";
import { createSessionGuard, registerSessionStoreReset } from "@/stores/session-store-registry";
import { errorMessage } from "@/stores/store-utils";

interface SimulatorLiveState {
  bootstrap: SimulatorBootstrap | null;
  snapshot: SimulatorLiveSnapshot | null;
  loading: boolean;
  refreshing: boolean;
  connected: boolean;
  error: string | null;
  selectedTableId: string | null;
  selectedOrderId: string | null;
  initialize: (branch: string, lang: string) => Promise<void>;
  refresh: (lang: string) => Promise<void>;
  selectTable: (id: string) => void;
  selectOrder: (id: string) => void;
  suspend: () => void;
  disconnect: () => void;
  reset: () => void;
}

let generation = 0;
let controller: AbortController | null = null;
let initializingKey: string | null = null;
const initial = {
  bootstrap: null, snapshot: null, loading: false, refreshing: false,
  connected: false, error: null, selectedTableId: null, selectedOrderId: null,
};

function stopRequest() {
  generation += 1;
  controller?.abort();
  controller = null;
  initializingKey = null;
}

function assertScope(snapshot: SimulatorLiveSnapshot, bootstrap: SimulatorBootstrap) {
  if (snapshot.mode !== "live" || snapshot.read_only !== true ||
    snapshot.branch.branch_uuid !== bootstrap.branch.branch_uuid || snapshot.branch.store_uuid !== bootstrap.branch.store_uuid) {
    throw new ServiceError("The live snapshot does not match the authorized restaurant branch", 403);
  }
}

function isDenied(error: unknown) {
  return error instanceof ServiceError && [401, 403].includes(error.statusCode);
}

export const useSimulatorLiveStore = create<SimulatorLiveState>((set, get) => ({
  ...initial,
  initialize: async (branch, lang) => {
    branch = branch.trim().toLowerCase();
    const key = `${branch}:${lang}`;
    if (get().loading && initializingKey === key) return;
    stopRequest();
    initializingKey = key;
    const request = generation;
    const validAuth = createSessionGuard();
    const current = new AbortController();
    controller = current;
    set({ ...initial, loading: true });
    try {
      const bootstrap = await simulator.getSimulatorBootstrap(branch, current.signal);
      if (request !== generation || !validAuth() || current.signal.aborted) return;
      if (bootstrap.branch.branch_uuid !== branch) throw new ServiceError("The authorized branch does not match the requested branch", 403);
      const snapshot = await simulator.getSimulatorLive(branch, lang, current.signal);
      if (request !== generation || !validAuth() || current.signal.aborted) return;
      assertScope(snapshot, bootstrap);
      set({ bootstrap, snapshot, loading: false, connected: true });
    } catch (error) {
      if (request === generation && validAuth() && !current.signal.aborted) {
        set({ ...initial, error: errorMessage(error) });
      }
    } finally {
      if (controller === current) { controller = null; initializingKey = null; }
    }
  },
  refresh: async (lang) => {
    const { bootstrap, loading, refreshing } = get();
    if (!bootstrap || loading || refreshing) return;
    const request = generation;
    const validAuth = createSessionGuard();
    const current = new AbortController();
    controller = current;
    set({ refreshing: true });
    try {
      const snapshot = await simulator.getSimulatorLive(bootstrap.branch.branch_uuid, lang, current.signal);
      if (request !== generation || !validAuth() || current.signal.aborted) return;
      assertScope(snapshot, bootstrap);
      const selectedOrder = snapshot.orders.find((order) => order.order_uuid === get().selectedOrderId);
      const selectedTable = snapshot.tables.find((table) => table.table_uuid === get().selectedTableId);
      set({ snapshot, connected: true, refreshing: false, error: null,
        selectedTableId: selectedOrder?.table_uuid ?? selectedTable?.table_uuid ?? null,
        selectedOrderId: selectedOrder?.order_uuid ?? selectedTable?.order_uuid ?? null });
    } catch (error) {
      if (request === generation && validAuth() && !current.signal.aborted) {
        set({ connected: false, refreshing: false, error: errorMessage(error),
          ...(isDenied(error) ? { bootstrap: null, snapshot: null, selectedTableId: null, selectedOrderId: null } : {}) });
      }
    } finally {
      if (controller === current) controller = null;
    }
  },
  selectTable: (id) => set({ selectedTableId: id,
    selectedOrderId: get().snapshot?.tables.find((table) => table.table_uuid === id)?.order_uuid ?? null }),
  selectOrder: (id) => set({ selectedOrderId: id,
    selectedTableId: get().snapshot?.orders.find((order) => order.order_uuid === id)?.table_uuid ?? null }),
  suspend: () => { stopRequest(); set({ loading: false, refreshing: false }); },
  disconnect: () => { stopRequest(); set({ loading: false, refreshing: false, connected: false }); },
  reset: () => { stopRequest(); set(initial); },
}));

registerSessionStoreReset("simulator-live", () => useSimulatorLiveStore.getState().reset());
