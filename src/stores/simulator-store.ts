"use client";

import { create } from "zustand";
import { ServiceError } from "@/lib/api";
import * as simulator from "@/services/simulator";
import type { SimulatorAction, SimulatorActionType, SimulatorBootstrap, SimulatorSession, SimulatorSessionSummary } from "@/services/simulator";
import { createSessionGuard, registerSessionStoreReset } from "@/stores/session-store-registry";
import { errorMessage } from "@/stores/store-utils";

interface PendingOperation { session_uuid: string; action: SimulatorAction; }
interface SimulatorState {
  bootstrap: SimulatorBootstrap | null;
  session: SimulatorSession | null;
  sessions: SimulatorSessionSummary[];
  loading: boolean;
  saving: boolean;
  connected: boolean;
  error: string | null;
  notice: string | null;
  selectedTableId: string | null;
  selectedOrderId: string | null;
  pending: PendingOperation | null;
  initialize: (branch: string) => Promise<void>;
  startSession: (name?: string) => Promise<void>;
  loadSession: (id: string) => Promise<void>;
  command: (type: SimulatorActionType, payload?: Record<string, unknown>) => Promise<boolean>;
  refresh: () => Promise<void>;
  watch: (signal: AbortSignal) => Promise<void>;
  reconnect: () => Promise<void>;
  disconnect: () => void;
  selectTable: (id: string) => void;
  selectOrder: (id: string) => void;
  reset: () => void;
}

let generation = 0;
const initial = {
  bootstrap: null, session: null, sessions: [], loading: false, saving: false,
  connected: false, error: null, notice: null, selectedTableId: null,
  selectedOrderId: null, pending: null,
};

export function isSimulatorConnectionError(error: unknown) {
  return !(error instanceof ServiceError) || error.statusCode === 0 || error.statusCode === 408 || error.statusCode >= 500;
}

function selectionAfter(session: SimulatorSession, tableId: string | null, orderId: string | null) {
  const order = session.orders.find((entry) => entry.order_uuid === orderId && entry.status === "open");
  if (order) return { selectedOrderId: order.order_uuid, selectedTableId: order.table_uuid };
  const table = session.tables.find((entry) => entry.table_uuid === tableId);
  return { selectedTableId: table?.table_uuid ?? null, selectedOrderId: table?.order_uuid ?? null };
}

export const useSimulatorStore = create<SimulatorState>((set, get) => ({
  ...initial,
  initialize: async (branch) => {
    const request = ++generation;
    const validAuth = createSessionGuard();
    set({ ...initial, loading: true });
    try {
      const bootstrap = await simulator.getSimulatorBootstrap(branch);
      const sessions = await simulator.listSimulatorSessions(bootstrap.branch.branch_uuid);
      if (request !== generation || !validAuth()) return;
      set({ bootstrap, sessions, connected: true, loading: false });
    } catch (error) {
      if (request === generation && validAuth()) set({ error: errorMessage(error), loading: false, connected: false });
    }
  },
  startSession: async (name) => {
    const { bootstrap, loading, saving } = get();
    if (!bootstrap || loading || saving) return;
    const request = generation;
    set({ saving: true, error: null });
    try {
      const session = await simulator.createSimulatorSession(bootstrap.branch.branch_uuid, name);
      if (request !== generation) return;
      set({ session, saving: false, connected: true, pending: null, selectedOrderId: null, selectedTableId: null,
        sessions: [{ session_uuid: session.session_uuid, name: session.name, status: session.status, version: session.version }, ...get().sessions] });
      await get().command("start");
    } catch (error) {
      if (request === generation) set({ saving: false, connected: !isSimulatorConnectionError(error), error: errorMessage(error) });
    }
  },
  loadSession: async (id) => {
    if (get().saving || get().loading) return;
    const request = ++generation;
    set({ loading: true, error: null, pending: null });
    try {
      const session = await simulator.getSimulatorSession(id);
      if (request !== generation) return;
      const branch = get().bootstrap?.branch;
      if (!branch || session.branch_uuid !== branch.branch_uuid || session.store_uuid !== branch.store_uuid) {
        throw new ServiceError("Select the session's authorized branch before restoring it", 403);
      }
      set({ session, loading: false, connected: true, selectedOrderId: null, selectedTableId: null });
    } catch (error) {
      if (request === generation) set({ loading: false, connected: !isSimulatorConnectionError(error), error: errorMessage(error) });
    }
  },
  command: async (type, payload = {}) => {
    const { session, connected, saving, loading, pending } = get();
    if (!session || !connected || saving || loading || pending) return false;
    const request = generation;
    const operation: PendingOperation = { session_uuid: session.session_uuid,
      action: { operation_uuid: crypto.randomUUID(), expected_version: session.version, type, payload } };
    set({ saving: true, error: null, notice: null, pending: operation });
    try {
      const updated = await simulator.runSimulatorAction(operation.session_uuid, operation.action);
      if (request !== generation) return false;
      set({ session: updated, saving: false, pending: null, connected: true,
        ...selectionAfter(updated, get().selectedTableId, get().selectedOrderId) });
      // A newly opened counter bill has no table to select in the scene.
      if (type === "open_table" || type === "split") {
        const created = updated.orders.find((entry) => entry.status === "open" && !session.orders.some((old) => old.order_uuid === entry.order_uuid)) ??
          (type === "open_table" && !updated.config.use_tables ? updated.orders.find((entry) => entry.status === "open" && !entry.table_uuid) : undefined);
        if (created) set({ selectedOrderId: created.order_uuid, selectedTableId: created.table_uuid });
      }
      return true;
    } catch (error) {
      if (request !== generation) return false;
      const connectionError = isSimulatorConnectionError(error);
      set({ saving: false, pending: connectionError ? operation : null, connected: !connectionError, error: errorMessage(error) });
      if (error instanceof ServiceError && error.statusCode === 409) {
        try {
          const current = await simulator.getSimulatorSession(session.session_uuid);
          if (request === generation && !get().saving && current.version >= (get().session?.version ?? 0)) {
            set({ session: current, ...selectionAfter(current, get().selectedTableId, get().selectedOrderId) });
          }
        } catch { if (request === generation) set({ connected: false }); }
      }
      return false;
    }
  },
  refresh: async () => {
    const { session, saving, loading, connected } = get();
    if (!session || saving || loading || !connected) return;
    const request = generation;
    try {
      const current = await simulator.getSimulatorSession(session.session_uuid);
      if (request === generation && !get().saving && current.version >= (get().session?.version ?? 0)) {
        set({ session: current, connected: true, ...selectionAfter(current, get().selectedTableId, get().selectedOrderId) });
      }
    } catch (error) {
      if (request === generation) set({ connected: false, error: errorMessage(error) });
    }
  },
  watch: async (signal) => {
    const { session } = get();
    if (!session || !get().connected) return;
    const request = generation;
    try {
      const current = await simulator.watchSimulatorSession(session.session_uuid, session.version, signal);
      if (!signal.aborted && request === generation && !get().saving && current.version >= (get().session?.version ?? 0)) {
        set({ session: current, ...selectionAfter(current, get().selectedTableId, get().selectedOrderId) });
      }
    } catch (error) {
      if (!signal.aborted && request === generation) set({ connected: false, error: errorMessage(error) });
    }
  },
  reconnect: async () => {
    const { session, bootstrap, pending, saving, loading } = get();
    if (saving || loading) return;
    const request = generation;
    set({ loading: true, connected: false, error: null });
    try {
      if (!session) {
        if (bootstrap) {
          const fresh = await simulator.getSimulatorBootstrap(bootstrap.branch.branch_uuid);
          if (request === generation) set({ bootstrap: fresh, loading: false, connected: true });
        } else set({ loading: false });
        return;
      }
      let current = await simulator.getSimulatorSession(session.session_uuid);
      if (request !== generation) return;
      // An interrupted response can follow a committed operation. Replay the same
      // operation id only after authentication and authoritative state are restored.
      if (pending) current = await simulator.runSimulatorAction(pending.session_uuid, pending.action);
      if (request === generation) set({ session: current, pending: null, loading: false, connected: true,
        ...selectionAfter(current, get().selectedTableId, get().selectedOrderId) });
    } catch (error) {
      if (request !== generation) return;
      const network = isSimulatorConnectionError(error);
      set({ loading: false, connected: false, pending: network ? pending : null, error: errorMessage(error) });
    }
  },
  disconnect: () => set({ connected: false }),
  selectTable: (id) => set({ selectedTableId: id, selectedOrderId: get().session?.tables.find((table) => table.table_uuid === id)?.order_uuid ?? null }),
  selectOrder: (id) => set({ selectedOrderId: id, selectedTableId: get().session?.orders.find((order) => order.order_uuid === id)?.table_uuid ?? null }),
  reset: () => { generation += 1; set(initial); },
}));

registerSessionStoreReset("simulator", () => useSimulatorStore.getState().reset());
