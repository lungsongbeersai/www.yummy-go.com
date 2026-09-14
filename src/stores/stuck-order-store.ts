"use client";

import { create } from "zustand";
import { isCapacitorMobileApp } from "@/lib/capacitor-platform";
import {
  discardAllStuckBrowserSyncEvents,
  discardAllStuckLocalSyncEvents,
  discardStuckBrowserSyncEvents,
  discardStuckLocalSyncEvents,
  listStuckBrowserSyncEvents,
  listStuckLocalSyncEvents,
  type StuckSyncDiscardResult,
  type StuckSyncEvent,
} from "@/services/offline-sync";
import { createSessionGuard, registerSessionStoreReset } from "@/stores/session-store-registry";
import { useAuthStore } from "@/stores/auth-store";
import { errorMessage } from "@/stores/store-utils";

// The Agent only ever knows its own desktop's SQLite outbox — a Capacitor
// device's stuck events live in that device's own Dexie instead, so this
// page must read/discard from whichever store the device it is actually
// running on can see.
function browserScope() {
  const user = useAuthStore.getState().user;
  return {
    storeUuid: user?.store_uuid || user?.store_uuid_fk || "",
    branchUuid: user?.branch_uuid || "",
  };
}

interface StuckOrderState {
  events: StuckSyncEvent[];
  loading: boolean;
  /** Group key or event uuid currently being cancelled, for the row spinner. */
  discardingKey: string | null;
  discardingAll: boolean;
  error: string | null;
  /** What the last cancel actually did, so the page can report it. */
  lastResult: StuckSyncDiscardResult | null;
  load: () => Promise<void>;
  discard: (key: string, eventUuids: string[], includeFinancial: boolean) => Promise<void>;
  discardAll: (includeFinancial: boolean) => Promise<void>;
  clearResult: () => void;
  reset: () => void;
}

const initialState = {
  events: [] as StuckSyncEvent[],
  loading: false,
  discardingKey: null as string | null,
  discardingAll: false,
  error: null as string | null,
  lastResult: null as StuckSyncDiscardResult | null,
};

export const useStuckOrderStore = create<StuckOrderState>((set, get) => ({
  ...initialState,
  load: async () => {
    const isCurrentSession = createSessionGuard();
    set({ loading: true, error: null });
    try {
      const events = isCapacitorMobileApp()
        ? await listStuckBrowserSyncEvents(browserScope())
        : await listStuckLocalSyncEvents();
      if (isCurrentSession()) set({ events, loading: false });
    } catch (error) {
      if (isCurrentSession()) set({ error: errorMessage(error), loading: false, events: [] });
    }
  },
  discard: async (key, eventUuids, includeFinancial) => {
    set({ discardingKey: key, error: null, lastResult: null });
    try {
      const lastResult = isCapacitorMobileApp()
        ? await discardStuckBrowserSyncEvents(browserScope(), eventUuids, { includeFinancial })
        : await discardStuckLocalSyncEvents(eventUuids, { includeFinancial });
      set({ lastResult });
      await get().load();
    } catch (error) {
      set({ error: errorMessage(error) });
    } finally {
      set({ discardingKey: null });
    }
  },
  discardAll: async (includeFinancial) => {
    set({ discardingAll: true, error: null, lastResult: null });
    try {
      const lastResult = isCapacitorMobileApp()
        ? await discardAllStuckBrowserSyncEvents(browserScope(), { includeFinancial })
        : await discardAllStuckLocalSyncEvents({ includeFinancial });
      set({ lastResult });
      await get().load();
    } catch (error) {
      set({ error: errorMessage(error) });
    } finally {
      set({ discardingAll: false });
    }
  },
  clearResult: () => set({ lastResult: null }),
  reset: () => set(initialState),
}));

registerSessionStoreReset("stuck-orders", () => useStuckOrderStore.getState().reset());
