import { describe, expect, it, vi } from "vitest";
import type { AuthUser } from "@/stores/auth-store";
import type { LocalSyncStatus, StuckSyncEvent } from "@/services/offline-sync";
import {
  FUMUN_INCIDENT,
  repairFumunIncident,
} from "@/stores/fumun-incident-repair";

function user(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    uuid: "34a82304-460a-4b74-8051-8dff9ed77833",
    email: "cashier@example.com",
    status: 1,
    profile: "",
    branch_uuid: FUMUN_INCIDENT.branchUuid,
    branch_name: "Fumun",
    branch_tel: "",
    branch_address: "",
    store_uuid: FUMUN_INCIDENT.storeUuid,
    store_name: "Fumun",
    store_logo: "",
    store_table_status: 2,
    ...overrides,
  };
}

function status(overrides: Partial<LocalSyncStatus> = {}): LocalSyncStatus {
  return {
    bootstrap_complete: true,
    store_uuid: FUMUN_INCIDENT.storeUuid,
    branch_uuid: FUMUN_INCIDENT.branchUuid,
    device_code: FUMUN_INCIDENT.deviceCode,
    pending: { pending: 0, processing: 0, failed: 0, blocked: 0 },
    ...overrides,
  };
}

function event(overrides: Partial<StuckSyncEvent> = {}): StuckSyncEvent {
  return {
    event_uuid: FUMUN_INCIDENT.eventUuid,
    operation: "ORDER_ITEM_DELETE",
    entity_type: "ORDER_ITEM",
    entity_uuid: FUMUN_INCIDENT.itemUuid,
    sync_status: "BLOCKED",
    retry_count: 0,
    sequence_no: 1,
    dependencies: [],
    last_error: "SYNC_TARGET_REJECTED",
    created_at: 1,
    updated_at: 1,
    next_attempt_at: 1,
    stuck_for_ms: 1,
    waiting_on_print: false,
    waiting_on_dependency: false,
    is_financial: false,
    order: {
      order_uuid: FUMUN_INCIDENT.orderUuid,
      order_invoice: FUMUN_INCIDENT.invoice,
      table_uuid: "table-8",
      table_name: "Table 8",
    },
    ...overrides,
  };
}

function dependencies(events: StuckSyncEvent[] = [event()]) {
  return {
    getAgentInfo: vi.fn().mockResolvedValue({
      agent_id: "agent-1",
      agent_name: "SERVERPOS3",
      device_code: FUMUN_INCIDENT.deviceCode,
    }),
    getSyncStatus: vi.fn().mockResolvedValue(status()),
    listStuckEvents: vi.fn().mockResolvedValue(events),
    discardEvent: vi.fn().mockResolvedValue({
      discarded: [FUMUN_INCIDENT.eventUuid],
      cascaded: [],
      skipped: [],
    }),
    rebuildMaster: vi.fn().mockResolvedValue(status()),
    refreshUi: vi.fn(),
    isCompleted: vi.fn().mockReturnValue(false),
    markCompleted: vi.fn(),
  };
}

describe("Fumun incident repair", () => {
  it("is completely inert for another store or branch", async () => {
    for (const auth of [user({ store_uuid: "another-store" }), user({ branch_uuid: "another-branch" })]) {
      const deps = dependencies();
      await expect(repairFumunIncident(auth, deps)).resolves.toBe("NOT_TARGET");
      expect(deps.getAgentInfo).not.toHaveBeenCalled();
      expect(deps.discardEvent).not.toHaveBeenCalled();
      expect(deps.rebuildMaster).not.toHaveBeenCalled();
    }
  });

  it("refuses to touch an Agent configured for any other scope or device", async () => {
    const deps = dependencies();
    deps.getSyncStatus.mockResolvedValue(status({ branch_uuid: "another-branch" }));
    await expect(repairFumunIncident(user(), deps)).resolves.toBe("AGENT_SCOPE_MISMATCH");
    expect(deps.listStuckEvents).not.toHaveBeenCalled();
    expect(deps.discardEvent).not.toHaveBeenCalled();
  });

  it("discards only the exact non-financial event and rebuilds without a print call", async () => {
    const deps = dependencies();
    await expect(repairFumunIncident(user(), deps)).resolves.toBe("REPAIRED");
    expect(deps.discardEvent).toHaveBeenCalledWith([FUMUN_INCIDENT.eventUuid], {
      includeFinancial: false,
      reason: "SYSTEM_RECOVERY_FUMUN_PAID_TABLE_STALE_DELETE_2026-09-09",
      actor: "34a82304-460a-4b74-8051-8dff9ed77833",
    });
    expect(deps.rebuildMaster).toHaveBeenCalledOnce();
    expect(deps.markCompleted).toHaveBeenCalledOnce();
    expect(deps.refreshUi).toHaveBeenCalledOnce();
    expect(Object.keys(deps).some((key) => key.toLowerCase().includes("print"))).toBe(false);
  });

  it("refuses a UUID match whose bill or operation does not match the incident", async () => {
    const deps = dependencies([event({ operation: "PAYMENT", is_financial: true })]);
    await expect(repairFumunIncident(user(), deps)).resolves.toBe("EVENT_MISMATCH");
    expect(deps.discardEvent).not.toHaveBeenCalled();
    expect(deps.rebuildMaster).not.toHaveBeenCalled();
  });

  it("rebuilds once when the exact event was already removed", async () => {
    const deps = dependencies([]);
    await expect(repairFumunIncident(user(), deps)).resolves.toBe("REPAIRED");
    expect(deps.discardEvent).not.toHaveBeenCalled();
    expect(deps.rebuildMaster).toHaveBeenCalledOnce();
  });
});
