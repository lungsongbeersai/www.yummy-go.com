"use client";

import { create } from "zustand";
import type { BrowserOfflineScope, BrowserSyncQueueEntry } from "@/services/offline-db";
import {
  discardBlockedBrowserSyncEvent,
  getLocalSyncStatus,
  listBlockedBrowserSyncEvents,
  retryBlockedBrowserSyncEvent,
} from "@/services/offline-sync";
import { requestImmediateReconcile } from "@/stores/offline-transport-monitor";
import { createSessionGuard, registerSessionStoreReset } from "@/stores/session-store-registry";
import { errorMessage } from "@/stores/store-utils";

interface OfflineSyncReviewState {
  entries: BrowserSyncQueueEntry[];
  loading: boolean;
  actioningEventUuid: string | null;
  bulkDiscarding: boolean;
  error: string | null;
  agentBlockedCount: number | null;
  load: (scope: BrowserOfflineScope) => Promise<void>;
  loadAgentBlockedCount: () => Promise<void>;
  retry: (eventUuid: string, scope: BrowserOfflineScope) => Promise<void>;
  discard: (eventUuid: string, scope: BrowserOfflineScope) => Promise<void>;
  discardMany: (eventUuids: string[], scope: BrowserOfflineScope) => Promise<void>;
  reset: () => void;
}

const initialState = {
  entries: [] as BrowserSyncQueueEntry[],
  loading: false,
  actioningEventUuid: null as string | null,
  bulkDiscarding: false,
  error: null as string | null,
  agentBlockedCount: null as number | null,
};

export const useOfflineSyncReviewStore = create<OfflineSyncReviewState>((set, get) => ({
  ...initialState,
  load: async (scope) => {
    const isCurrentSession = createSessionGuard();
    set({ loading: true, error: null });
    try {
      const entries = await listBlockedBrowserSyncEvents(scope);
      if (isCurrentSession()) set({ entries, loading: false });
    } catch (error) {
      if (isCurrentSession()) set({ error: errorMessage(error), loading: false });
    }
    void get().loadAgentBlockedCount();
  },
  loadAgentBlockedCount: async () => {
    const isCurrentSession = createSessionGuard();
    try {
      const status = await getLocalSyncStatus({ force: true, timeoutMs: 1500 });
      if (isCurrentSession()) set({ agentBlockedCount: status ? Number(status.pending?.blocked || 0) : null });
    } catch {
      if (isCurrentSession()) set({ agentBlockedCount: null });
    }
  },
  retry: async (eventUuid, scope) => {
    set({ actioningEventUuid: eventUuid, error: null });
    try {
      await retryBlockedBrowserSyncEvent(eventUuid);
      requestImmediateReconcile();
      await get().load(scope);
    } catch (error) {
      set({ error: errorMessage(error) });
    } finally {
      set({ actioningEventUuid: null });
    }
  },
  discard: async (eventUuid, scope) => {
    set({ actioningEventUuid: eventUuid, error: null });
    try {
      await discardBlockedBrowserSyncEvent(eventUuid);
      await get().load(scope);
    } catch (error) {
      set({ error: errorMessage(error) });
    } finally {
      set({ actioningEventUuid: null });
    }
  },
  discardMany: async (eventUuids, scope) => {
    set({ bulkDiscarding: true, error: null });
    try {
      await Promise.all(eventUuids.map((eventUuid) => discardBlockedBrowserSyncEvent(eventUuid)));
      await get().load(scope);
    } catch (error) {
      set({ error: errorMessage(error) });
    } finally {
      set({ bulkDiscarding: false });
    }
  },
  reset: () => set(initialState),
}));

registerSessionStoreReset("offline-sync-review", () => useOfflineSyncReviewStore.getState().reset());
