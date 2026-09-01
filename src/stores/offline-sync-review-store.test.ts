import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BrowserSyncQueueEntry } from "@/services/offline-db";
import * as offlineSyncService from "@/services/offline-sync";
import { useOfflineSyncReviewStore } from "@/stores/offline-sync-review-store";

vi.mock("@/services/offline-sync", () => ({
  listBlockedBrowserSyncEvents: vi.fn(),
  retryBlockedBrowserSyncEvent: vi.fn(),
  discardBlockedBrowserSyncEvent: vi.fn(),
  getLocalSyncStatus: vi.fn(),
}));

vi.mock("@/stores/offline-transport-monitor", () => ({
  requestImmediateReconcile: vi.fn(),
}));

vi.mock("@/stores/session-store-registry", () => ({
  createSessionGuard: () => () => true,
  registerSessionStoreReset: vi.fn(),
}));

const listBlockedMock = vi.mocked(offlineSyncService.listBlockedBrowserSyncEvents);
const retryMock = vi.mocked(offlineSyncService.retryBlockedBrowserSyncEvent);
const discardMock = vi.mocked(offlineSyncService.discardBlockedBrowserSyncEvent);
const getLocalSyncStatusMock = vi.mocked(offlineSyncService.getLocalSyncStatus);

const scope = { storeUuid: "store-1", branchUuid: "branch-1" };

function blockedEntry(eventUuid: string): BrowserSyncQueueEntry {
  return {
    eventUuid,
    storeUuid: scope.storeUuid,
    branchUuid: scope.branchUuid,
    actorLoginUuid: "login-1",
    method: "POST",
    path: "/api/v1/posAll/payment",
    params: {},
    data: {},
    requestFingerprint: "fp",
    dependencies: [],
    status: "BLOCKED",
    lastError: "conflict",
    createdAt: 1,
    updatedAt: 1,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useOfflineSyncReviewStore.getState().reset();
});

describe("offline sync review store", () => {
  it("loads blocked entries for the current scope", async () => {
    listBlockedMock.mockResolvedValue([blockedEntry("event-1")]);

    await useOfflineSyncReviewStore.getState().load(scope);

    expect(listBlockedMock).toHaveBeenCalledWith(scope);
    expect(useOfflineSyncReviewStore.getState().entries).toHaveLength(1);
    expect(useOfflineSyncReviewStore.getState().loading).toBe(false);
  });

  it("records the load error without throwing", async () => {
    listBlockedMock.mockRejectedValue(new Error("network down"));

    await useOfflineSyncReviewStore.getState().load(scope);

    expect(useOfflineSyncReviewStore.getState().error).toBe("network down");
    expect(useOfflineSyncReviewStore.getState().loading).toBe(false);
  });

  it("surfaces the Agent's own live blocked count alongside the local list", async () => {
    listBlockedMock.mockResolvedValue([]);
    getLocalSyncStatusMock.mockResolvedValue({
      bootstrap_complete: true,
      pending: { blocked: 28 },
    });

    await useOfflineSyncReviewStore.getState().load(scope);
    await useOfflineSyncReviewStore.getState().loadAgentBlockedCount();

    expect(useOfflineSyncReviewStore.getState().agentBlockedCount).toBe(28);
  });

  it("treats an unreachable Agent as an unknown blocked count, not zero", async () => {
    getLocalSyncStatusMock.mockRejectedValue(new Error("agent unreachable"));

    await useOfflineSyncReviewStore.getState().loadAgentBlockedCount();

    expect(useOfflineSyncReviewStore.getState().agentBlockedCount).toBeNull();
  });

  it("retries an event and reloads the list", async () => {
    retryMock.mockResolvedValue(blockedEntry("event-1"));
    listBlockedMock.mockResolvedValue([]);

    await useOfflineSyncReviewStore.getState().retry("event-1", scope);

    expect(retryMock).toHaveBeenCalledWith("event-1");
    expect(listBlockedMock).toHaveBeenCalledWith(scope);
    expect(useOfflineSyncReviewStore.getState().actioningEventUuid).toBeNull();
  });

  it("discards an event and reloads the list", async () => {
    discardMock.mockResolvedValue(true);
    listBlockedMock.mockResolvedValue([]);

    await useOfflineSyncReviewStore.getState().discard("event-1", scope);

    expect(discardMock).toHaveBeenCalledWith("event-1");
    expect(listBlockedMock).toHaveBeenCalledWith(scope);
    expect(useOfflineSyncReviewStore.getState().entries).toHaveLength(0);
  });

  it("surfaces a discard failure and clears the busy flag", async () => {
    discardMock.mockRejectedValue(new Error("delete failed"));

    await useOfflineSyncReviewStore.getState().discard("event-1", scope);

    expect(useOfflineSyncReviewStore.getState().error).toBe("delete failed");
    expect(useOfflineSyncReviewStore.getState().actioningEventUuid).toBeNull();
  });

  it("discards every selected event and reloads the list once", async () => {
    discardMock.mockResolvedValue(true);
    listBlockedMock.mockResolvedValue([]);

    await useOfflineSyncReviewStore.getState().discardMany(["event-1", "event-2"], scope);

    expect(discardMock).toHaveBeenCalledWith("event-1");
    expect(discardMock).toHaveBeenCalledWith("event-2");
    expect(listBlockedMock).toHaveBeenCalledTimes(1);
    expect(useOfflineSyncReviewStore.getState().bulkDiscarding).toBe(false);
  });

  it("surfaces a bulk discard failure and clears the busy flag", async () => {
    discardMock.mockRejectedValue(new Error("delete failed"));

    await useOfflineSyncReviewStore.getState().discardMany(["event-1"], scope);

    expect(useOfflineSyncReviewStore.getState().error).toBe("delete failed");
    expect(useOfflineSyncReviewStore.getState().bulkDiscarding).toBe(false);
  });
});
