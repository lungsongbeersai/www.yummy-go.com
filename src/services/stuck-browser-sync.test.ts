import { describe, expect, it } from "vitest";
import type { BrowserOfflineStore, BrowserSyncQueueEntry } from "@/services/offline-db";
import {
  discardAllStuckBrowserSyncEvents,
  discardStuckBrowserSyncEvents,
  listStuckBrowserSyncEvents,
} from "@/services/offline-sync";

// Minimal in-memory double covering only what these functions touch
// (listSyncQueue/getSyncQueue/putSyncQueue/deleteSyncQueue) — modeled after
// write-fallback.test.ts's MemoryBrowserOfflineStore, kept local since these
// tests need none of its api-cache/print-job machinery.
class MinimalBrowserOfflineStore implements BrowserOfflineStore {
  readonly syncQueue = new Map<string, BrowserSyncQueueEntry>();

  async getApiCache() { return undefined; }
  async putApiCache() { /* unused */ }
  async pruneApiCache() { /* unused */ }
  async listApiCacheByPath() { return []; }
  async getSyncQueue(eventUuid: string) { return this.syncQueue.get(eventUuid); }
  async putSyncQueue(entry: BrowserSyncQueueEntry) { this.syncQueue.set(entry.eventUuid, entry); }
  async deleteSyncQueue(eventUuid: string) { this.syncQueue.delete(eventUuid); }
  async listSyncQueue(scope: { storeUuid: string; branchUuid: string }) {
    return [...this.syncQueue.values()].filter(
      (entry) => entry.storeUuid === scope.storeUuid && entry.branchUuid === scope.branchUuid,
    );
  }
  async getSyncStatus() { return undefined; }
  async putSyncStatus() { /* unused */ }
  async pruneSyncedQueue() { /* unused */ }
}

const SCOPE = { storeUuid: "store-1", branchUuid: "branch-1" };

function queueEntry(overrides: Partial<BrowserSyncQueueEntry> = {}): BrowserSyncQueueEntry {
  return {
    storeUuid: SCOPE.storeUuid,
    branchUuid: SCOPE.branchUuid,
    actorLoginUuid: "login-1",
    eventUuid: "event-1",
    method: "PATCH",
    path: "/api/v1/posAll/confirm_to_kitchen",
    params: {},
    data: { order_uuid: "order-1" },
    requestFingerprint: "",
    dependencies: [],
    status: "BLOCKED",
    lastError: "some real rejection",
    createdAt: Date.now() - 60_000,
    updatedAt: Date.now() - 30_000,
    ...overrides,
  };
}

describe("stuck browser sync events (mobile's own Dexie queue)", () => {
  it("lists a Capacitor device's own blocked events, not just an Agent's outbox", async () => {
    const store = new MinimalBrowserOfflineStore();
    await store.putSyncQueue(queueEntry());
    await store.putSyncQueue(queueEntry({ eventUuid: "event-2", status: "PENDING" }));

    const events = await listStuckBrowserSyncEvents(SCOPE, store);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      event_uuid: "event-1",
      operation: "KITCHEN_CONFIRM",
      sync_status: "BLOCKED",
      entity_uuid: "order-1",
      is_financial: false,
    });
  });

  it("discards a non-financial blocked event without requiring includeFinancial", async () => {
    const store = new MinimalBrowserOfflineStore();
    await store.putSyncQueue(queueEntry());

    const result = await discardStuckBrowserSyncEvents(SCOPE, ["event-1"], {}, store);

    expect(result.discarded).toEqual(["event-1"]);
    expect(await store.getSyncQueue("event-1")).toBeUndefined();
  });

  it("refuses to discard a PAYMENT event unless includeFinancial is set", async () => {
    const store = new MinimalBrowserOfflineStore();
    await store.putSyncQueue(queueEntry({
      method: "POST",
      path: "/api/v1/posAll/payment",
    }));

    const refused = await discardStuckBrowserSyncEvents(SCOPE, ["event-1"], {}, store);
    expect(refused.discarded).toEqual([]);
    expect(refused.skipped).toEqual([
      { event_uuid: "event-1", reason: "financial event requires includeFinancial" },
    ]);
    expect(await store.getSyncQueue("event-1")).toBeDefined();

    const allowed = await discardStuckBrowserSyncEvents(SCOPE, ["event-1"], { includeFinancial: true }, store);
    expect(allowed.discarded).toEqual(["event-1"]);
    expect(await store.getSyncQueue("event-1")).toBeUndefined();
  });

  it("discardAll clears every blocked event in one call", async () => {
    const store = new MinimalBrowserOfflineStore();
    await store.putSyncQueue(queueEntry({ eventUuid: "event-1" }));
    await store.putSyncQueue(queueEntry({ eventUuid: "event-2", path: "/api/v1/posAll/order_item/update_qty", method: "PATCH" }));

    const result = await discardAllStuckBrowserSyncEvents(SCOPE, {}, store);

    expect(result.discarded.sort()).toEqual(["event-1", "event-2"]);
    expect(await listStuckBrowserSyncEvents(SCOPE, store)).toEqual([]);
  });
});
