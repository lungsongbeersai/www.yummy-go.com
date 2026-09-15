import { describe, expect, it, vi } from "vitest";
import type { AuthUser } from "@/stores/auth-store";
import type { LocalSyncStatus } from "@/services/offline-sync";
import {
  FUMUN_INCIDENT,
  repairPriorDayServerClosedOrders,
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

function dependencies() {
  return {
    getAgentInfo: vi.fn().mockResolvedValue({
      version: "1.0.7",
      agent_id: "agent-1",
      agent_name: "SERVERPOS3",
      device_code: FUMUN_INCIDENT.deviceCode,
    }),
    getSyncStatus: vi.fn().mockResolvedValue(status()),
    reconcileClosedOrders: vi.fn().mockResolvedValue({
      reconciled_orders: ["0df94d30-fd52-4072-b378-c6a80a3cb0f8"],
      discarded_events: 3,
      suppressed_print_jobs: 2,
      deferred_processing_orders: [],
      status: status(),
    }),
    refreshUi: vi.fn(),
    isCompleted: vi.fn().mockReturnValue(false),
    markCompleted: vi.fn(),
  };
}

describe("Fumun server-closed order recovery", () => {
  it("is completely inert for another store or branch", async () => {
    for (const auth of [user({ store_uuid: "another-store" }), user({ branch_uuid: "another-branch" })]) {
      const deps = dependencies();
      await expect(repairFumunIncident(auth, deps)).resolves.toBe("NOT_TARGET");
      expect(deps.getAgentInfo).not.toHaveBeenCalled();
      expect(deps.reconcileClosedOrders).not.toHaveBeenCalled();
    }
  });

  it("refuses to touch an Agent configured for any other scope or device", async () => {
    const deps = dependencies();
    deps.getSyncStatus.mockResolvedValue(status({ branch_uuid: "another-branch" }));
    await expect(repairFumunIncident(user(), deps)).resolves.toBe("AGENT_SCOPE_MISMATCH");
    expect(deps.reconcileClosedOrders).not.toHaveBeenCalled();
  });

  it("reconciles all server-paid local orders and has no print dependency", async () => {
    const deps = dependencies();
    await expect(repairFumunIncident(user(), deps)).resolves.toBe("REPAIRED");
    expect(deps.reconcileClosedOrders).toHaveBeenCalledWith({
      storeUuid: FUMUN_INCIDENT.storeUuid,
      branchUuid: FUMUN_INCIDENT.branchUuid,
      deviceCode: FUMUN_INCIDENT.deviceCode,
    });
    expect(deps.markCompleted).toHaveBeenCalledOnce();
    expect(deps.refreshUi).toHaveBeenCalledOnce();
    expect(Object.keys(deps).some((key) => key.toLowerCase().includes("print"))).toBe(false);
  });

  it("keeps the online bypass active while recovery still has work", async () => {
    const deps = dependencies();
    deps.reconcileClosedOrders.mockResolvedValue({
      reconciled_orders: [],
      discarded_events: 0,
      suppressed_print_jobs: 0,
      deferred_processing_orders: ["processing-order"],
      status: status({ pending: { pending: 0, processing: 1, failed: 0, blocked: 0 } }),
    });
    await expect(repairFumunIncident(user(), deps)).resolves.toBe("SYNC_INCOMPLETE");
    expect(deps.markCompleted).not.toHaveBeenCalled();
    expect(deps.refreshUi).toHaveBeenCalledOnce();
  });
});

describe("prior-day server-closed order recovery for every store", () => {
  it("uses the authenticated store, branch and matching Agent device dynamically", async () => {
    const deps = dependencies();
    const anotherUser = user({ store_uuid: "another-store", branch_uuid: "another-branch" });
    deps.getSyncStatus.mockResolvedValue(status({
      store_uuid: "another-store",
      branch_uuid: "another-branch",
    }));
    deps.reconcileClosedOrders.mockResolvedValue({
      reconciled_orders: ["old-paid-order"],
      discarded_events: 2,
      suppressed_print_jobs: 1,
      deferred_processing_orders: [],
      status: status({ store_uuid: "another-store", branch_uuid: "another-branch" }),
    });

    await expect(repairPriorDayServerClosedOrders(anotherUser, deps)).resolves.toBe("REPAIRED");
    expect(deps.reconcileClosedOrders).toHaveBeenCalledWith({
      storeUuid: "another-store",
      branchUuid: "another-branch",
      deviceCode: FUMUN_INCIDENT.deviceCode,
    });
    expect(deps.markCompleted).not.toHaveBeenCalled();
  });

  it("will not call broad recovery on an Agent version without today's-work protection", async () => {
    const deps = dependencies();
    deps.getAgentInfo.mockResolvedValue({
      version: "1.0.6",
      agent_id: "agent-1",
      agent_name: "SERVERPOS3",
      device_code: FUMUN_INCIDENT.deviceCode,
    });

    await expect(repairPriorDayServerClosedOrders(user(), deps))
      .resolves.toBe("AGENT_UPDATE_REQUIRED");
    expect(deps.reconcileClosedOrders).not.toHaveBeenCalled();
  });

  it("does not wait for today's unrelated queue before completing prior-day recovery", async () => {
    const deps = dependencies();
    deps.reconcileClosedOrders.mockResolvedValue({
      reconciled_orders: ["old-paid-order"],
      discarded_events: 2,
      suppressed_print_jobs: 1,
      deferred_processing_orders: [],
      status: status({ pending: { pending: 4, processing: 0, failed: 1, blocked: 0 } }),
    });

    await expect(repairPriorDayServerClosedOrders(user(), deps)).resolves.toBe("REPAIRED");
    expect(deps.refreshUi).toHaveBeenCalledOnce();
  });
});
