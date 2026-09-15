import { describe, expect, it } from "vitest";
import type { BrowserOfflineStore, BrowserSyncQueueEntry } from "@/services/offline-db";
import {
  applyMobileBlockedQueueReset,
  mobileBlockedQueueResetCommand,
} from "@/services/mobile-blocked-queue-reset";

class MemoryStore implements BrowserOfflineStore {
  readonly queue = new Map<string, BrowserSyncQueueEntry>();
  async getApiCache() { return undefined; }
  async putApiCache() { /* unused */ }
  async pruneApiCache() { /* unused */ }
  async listApiCacheByPath() { return []; }
  async getSyncQueue(id: string) { return this.queue.get(id); }
  async putSyncQueue(entry: BrowserSyncQueueEntry) { this.queue.set(entry.eventUuid, entry); }
  async deleteSyncQueue(id: string) { this.queue.delete(id); }
  async listSyncQueue(scope: { storeUuid: string; branchUuid: string }) {
    return [...this.queue.values()].filter(
      (entry) => entry.storeUuid === scope.storeUuid && entry.branchUuid === scope.branchUuid,
    );
  }
  async getSyncStatus() { return undefined; }
  async putSyncStatus() { /* unused */ }
  async pruneSyncedQueue() { /* unused */ }
}

class MemoryStorage {
  readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const SCOPE = { storeUuid: "store-1", branchUuid: "branch-1" };

function response(version = 1, branchUuid = SCOPE.branchUuid) {
  return {
    data: {
      rollout: { branch_uuid: branchUuid },
      mobile: {
        blocked_queue_reset: {
          version,
          requested_at: "2026-09-14T06:45:00.000Z",
          include_financial: false,
        },
      },
    },
  };
}

function entry(
  eventUuid: string,
  path: string,
  status: BrowserSyncQueueEntry["status"] = "BLOCKED",
  createdAt = 1,
): BrowserSyncQueueEntry {
  return {
    storeUuid: SCOPE.storeUuid,
    branchUuid: SCOPE.branchUuid,
    actorLoginUuid: "login-1",
    eventUuid,
    method: path.endsWith("/payment") ? "POST" : "PATCH",
    path,
    params: {},
    data: {},
    requestFingerprint: "",
    dependencies: [],
    status,
    lastError: status === "BLOCKED" ? "Backend rejected" : null,
    createdAt,
    updatedAt: createdAt,
  };
}

describe("mobile blocked-queue reset", () => {
  it("accepts only a non-financial, positive, branch-scoped command", () => {
    expect(mobileBlockedQueueResetCommand(response())).toEqual({
      version: 1,
      branchUuid: SCOPE.branchUuid,
      requestedAt: Date.parse("2026-09-14T06:45:00.000Z"),
    });
    expect(mobileBlockedQueueResetCommand(response(0))).toBeNull();
    const financial = response();
    financial.data.mobile.blocked_queue_reset.include_financial = true;
    expect(mobileBlockedQueueResetCommand(financial)).toBeNull();
    const missingTimestamp = response();
    missingTimestamp.data.mobile.blocked_queue_reset.requested_at = "";
    expect(mobileBlockedQueueResetCommand(missingTimestamp)).toBeNull();
  });

  it("clears current blocked non-payment rows once and never clears later rows", async () => {
    const store = new MemoryStore();
    const storage = new MemoryStorage();
    await store.putSyncQueue(entry("order", "/api/v1/posAll/create_order"));
    await store.putSyncQueue(entry("payment", "/api/v1/posAll/payment"));
    await store.putSyncQueue(entry("retrying", "/api/v1/posAll/update_note", "FAILED"));

    const first = await applyMobileBlockedQueueReset(SCOPE, response(), store, storage);
    expect(first).toEqual({ applied: true, discarded: 1, skippedFinancial: 1 });
    expect(await store.getSyncQueue("order")).toBeUndefined();
    expect(await store.getSyncQueue("payment")).toBeDefined();
    expect(await store.getSyncQueue("retrying")).toBeDefined();

    await store.putSyncQueue(entry("later", "/api/v1/posAll/create_order"));
    const repeated = await applyMobileBlockedQueueReset(SCOPE, response(), store, storage);
    expect(repeated).toEqual({ applied: false, discarded: 0, skippedFinancial: 0 });
    expect(await store.getSyncQueue("later")).toBeDefined();
  });

  it("does not apply another branch's command", async () => {
    const store = new MemoryStore();
    await store.putSyncQueue(entry("order", "/api/v1/posAll/create_order"));
    const result = await applyMobileBlockedQueueReset(
      SCOPE,
      response(1, "branch-2"),
      store,
      new MemoryStorage(),
    );
    expect(result.applied).toBe(false);
    expect(await store.getSyncQueue("order")).toBeDefined();
  });

  it("cannot clear a later rejection even if its local version marker is lost", async () => {
    const store = new MemoryStore();
    const issuedAt = Date.parse("2026-09-14T06:45:00.000Z");
    await store.putSyncQueue(entry(
      "later",
      "/api/v1/posAll/create_order",
      "BLOCKED",
      issuedAt + 1,
    ));

    const result = await applyMobileBlockedQueueReset(
      SCOPE,
      response(),
      store,
      new MemoryStorage(),
    );
    expect(result).toEqual({ applied: true, discarded: 0, skippedFinancial: 0 });
    expect(await store.getSyncQueue("later")).toBeDefined();
  });
});
