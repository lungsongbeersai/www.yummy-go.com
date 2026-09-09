import type { AuthUser } from "@/stores/auth-store";
import type { AgentInfo } from "@/services/printer/types";
import type { LocalSyncStatus, StuckSyncDiscardResult, StuckSyncEvent } from "@/services/offline-sync";
import { getLocalAgentInfo } from "@/services/printer/agent-transport";
import {
  discardStuckLocalSyncEvents,
  getLocalSyncStatus,
  listStuckLocalSyncEvents,
  rebuildLocalMaster,
} from "@/services/offline-sync";
import { requestOfflineDataRefresh } from "@/lib/offline-data-refresh";

// One-time production recovery for the Fumun incident reported on 2026-09-09.
// Every identifier is fixed so this code is inert for all other stores,
// branches, devices, bills, orders, items and outbox events.
export const FUMUN_INCIDENT = Object.freeze({
  storeUuid: "14fa3632-dc9b-4539-a992-54741768bc99",
  branchUuid: "f562e6be-132e-4fb2-9914-c61d6b9904fd",
  deviceCode: "SERVERPOS3",
  eventUuid: "1b147820-1374-49e3-a5f9-f670a1261935",
  orderUuid: "3211d573-4326-4766-8c3e-5e70ac716315",
  itemUuid: "395f4bb1-84e1-4426-aef5-d1080120b513",
  invoice: "080926-0016",
});

const COMPLETED_KEY = `yummy-go:incident-repaired:${FUMUN_INCIDENT.eventUuid}`;

export type FumunRepairResult =
  | "NOT_TARGET"
  | "ALREADY_REPAIRED"
  | "AGENT_SCOPE_MISMATCH"
  | "EVENT_MISMATCH"
  | "UNSAFE_DEPENDENT"
  | "SYNC_INCOMPLETE"
  | "REPAIRED";

interface FumunRepairDependencies {
  getAgentInfo: () => Promise<AgentInfo>;
  getSyncStatus: () => Promise<LocalSyncStatus | null>;
  listStuckEvents: () => Promise<StuckSyncEvent[]>;
  discardEvent: (
    eventUuids: string[],
    options: { includeFinancial: boolean; reason: string; actor: string },
  ) => Promise<StuckSyncDiscardResult>;
  rebuildMaster: () => Promise<LocalSyncStatus | null>;
  refreshUi: () => void;
  isCompleted: () => boolean;
  markCompleted: () => void;
}

const defaultDependencies: FumunRepairDependencies = {
  getAgentInfo: () => getLocalAgentInfo(),
  getSyncStatus: () => getLocalSyncStatus({ force: true, timeoutMs: 3000 }),
  listStuckEvents: listStuckLocalSyncEvents,
  discardEvent: discardStuckLocalSyncEvents,
  rebuildMaster: rebuildLocalMaster,
  refreshUi: requestOfflineDataRefresh,
  isCompleted: () => typeof window !== "undefined" && window.localStorage.getItem(COMPLETED_KEY) === "1",
  markCompleted: () => window.localStorage.setItem(COMPLETED_KEY, "1"),
};

export function isFumunIncidentUser(user: Pick<AuthUser, "store_uuid" | "branch_uuid"> | null) {
  return user?.store_uuid === FUMUN_INCIDENT.storeUuid &&
    user.branch_uuid === FUMUN_INCIDENT.branchUuid;
}

function isExactIncidentEvent(event: StuckSyncEvent) {
  return event.event_uuid === FUMUN_INCIDENT.eventUuid &&
    event.operation === "ORDER_ITEM_DELETE" &&
    event.entity_type === "ORDER_ITEM" &&
    event.entity_uuid === FUMUN_INCIDENT.itemUuid &&
    event.sync_status === "BLOCKED" &&
    event.is_financial === false &&
    event.waiting_on_print === false &&
    event.order?.order_uuid === FUMUN_INCIDENT.orderUuid &&
    event.order.order_invoice === FUMUN_INCIDENT.invoice;
}

/**
 * Discards one rejected delete, then rebuilds this Agent's Fumun-only snapshot.
 * There is deliberately no print API and no "discard all" path here.
 */
export async function repairFumunIncident(
  user: Pick<AuthUser, "uuid" | "store_uuid" | "branch_uuid"> | null,
  dependencies: FumunRepairDependencies = defaultDependencies,
): Promise<FumunRepairResult> {
  if (!isFumunIncidentUser(user)) return "NOT_TARGET";
  if (dependencies.isCompleted()) return "ALREADY_REPAIRED";

  const [agent, syncStatus] = await Promise.all([
    dependencies.getAgentInfo(),
    dependencies.getSyncStatus(),
  ]);
  if (agent.device_code !== FUMUN_INCIDENT.deviceCode ||
    syncStatus?.device_code !== FUMUN_INCIDENT.deviceCode ||
    syncStatus.store_uuid !== FUMUN_INCIDENT.storeUuid ||
    syncStatus.branch_uuid !== FUMUN_INCIDENT.branchUuid) {
    return "AGENT_SCOPE_MISMATCH";
  }

  const events = await dependencies.listStuckEvents();
  const incident = events.find((event) => event.event_uuid === FUMUN_INCIDENT.eventUuid);
  if (incident && !isExactIncidentEvent(incident)) return "EVENT_MISMATCH";
  if (events.some((event) => event.dependencies.includes(FUMUN_INCIDENT.eventUuid))) {
    return "UNSAFE_DEPENDENT";
  }

  if (incident) {
    const discarded = await dependencies.discardEvent([FUMUN_INCIDENT.eventUuid], {
      includeFinancial: false,
      reason: "SYSTEM_RECOVERY_FUMUN_PAID_TABLE_STALE_DELETE_2026-09-09",
      actor: user?.uuid || "fumun-incident-repair",
    });
    if (!discarded.discarded.includes(FUMUN_INCIDENT.eventUuid) ||
      discarded.cascaded.length > 0 || discarded.skipped.length > 0) {
      return "EVENT_MISMATCH";
    }
  }

  const rebuilt = await dependencies.rebuildMaster();
  if (!rebuilt?.bootstrap_complete || rebuilt.store_uuid !== FUMUN_INCIDENT.storeUuid ||
    rebuilt.branch_uuid !== FUMUN_INCIDENT.branchUuid ||
    Number(rebuilt.pending?.pending || 0) > 0 ||
    Number(rebuilt.pending?.processing || 0) > 0 ||
    Number(rebuilt.pending?.failed || 0) > 0 ||
    Number(rebuilt.pending?.blocked || 0) > 0) {
    return "SYNC_INCOMPLETE";
  }

  dependencies.markCompleted();
  dependencies.refreshUi();
  return "REPAIRED";
}
