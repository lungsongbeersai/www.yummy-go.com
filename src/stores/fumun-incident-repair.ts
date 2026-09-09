import type { AuthUser } from "@/stores/auth-store";
import type { AgentInfo } from "@/services/printer/types";
import type {
  LocalServerClosedRecoveryResult,
  LocalSyncStatus,
} from "@/services/offline-sync";
import { getLocalAgentInfo } from "@/services/printer/agent-transport";
import {
  getLocalSyncStatus,
  reconcileServerClosedLocalOrders,
} from "@/services/offline-sync";
import { requestOfflineDataRefresh } from "@/lib/offline-data-refresh";
import {
  FUMUN_INCIDENT,
  FUMUN_INCIDENT_COMPLETED_KEY,
  isFumunIncidentScope,
} from "@/lib/fumun-incident";

// One-time production recovery for the Fumun incident reported on 2026-09-09.
// Store, branch and device must all match before the Agent can change a row.
export type FumunRepairResult =
  | "NOT_TARGET"
  | "ALREADY_REPAIRED"
  | "AGENT_SCOPE_MISMATCH"
  | "SYNC_INCOMPLETE"
  | "REPAIRED";

interface FumunRepairDependencies {
  getAgentInfo: () => Promise<AgentInfo>;
  getSyncStatus: () => Promise<LocalSyncStatus | null>;
  reconcileClosedOrders: (scope: {
    storeUuid: string;
    branchUuid: string;
    deviceCode: string;
  }) => Promise<LocalServerClosedRecoveryResult>;
  refreshUi: () => void;
  isCompleted: () => boolean;
  markCompleted: () => void;
}

const defaultDependencies: FumunRepairDependencies = {
  getAgentInfo: () => getLocalAgentInfo(),
  getSyncStatus: () => getLocalSyncStatus({ force: true, timeoutMs: 3000 }),
  reconcileClosedOrders: reconcileServerClosedLocalOrders,
  refreshUi: requestOfflineDataRefresh,
  isCompleted: () => typeof window !== "undefined" &&
    window.localStorage.getItem(FUMUN_INCIDENT_COMPLETED_KEY) === "1",
  markCompleted: () => window.localStorage.setItem(FUMUN_INCIDENT_COMPLETED_KEY, "1"),
};

export function isFumunIncidentUser(user: Pick<AuthUser, "store_uuid" | "branch_uuid"> | null) {
  return isFumunIncidentScope({
    storeUuid: user?.store_uuid,
    branchUuid: user?.branch_uuid,
  });
}

export { FUMUN_INCIDENT } from "@/lib/fumun-incident";

function matchesIncidentAgent(agent: AgentInfo, status: LocalSyncStatus | null) {
  return agent.device_code === FUMUN_INCIDENT.deviceCode &&
    status?.device_code === FUMUN_INCIDENT.deviceCode &&
    status.store_uuid === FUMUN_INCIDENT.storeUuid &&
    status.branch_uuid === FUMUN_INCIDENT.branchUuid;
}

function recoveryCompleted(result: LocalServerClosedRecoveryResult) {
  const pending = result.status?.pending;
  return result.deferred_processing_orders.length === 0 &&
    result.status?.bootstrap_complete === true &&
    result.status.store_uuid === FUMUN_INCIDENT.storeUuid &&
    result.status.branch_uuid === FUMUN_INCIDENT.branchUuid &&
    result.status.device_code === FUMUN_INCIDENT.deviceCode &&
    Number(pending?.pending || 0) === 0 &&
    Number(pending?.processing || 0) === 0 &&
    Number(pending?.failed || 0) === 0 &&
    Number(pending?.blocked || 0) === 0;
}

/**
 * Reconciles every local Fumun order that Backend proves was already paid.
 * The Agent owns the transaction and suppresses old queued tickets; this
 * browser code has deliberately no print or broad discard operation.
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
  if (!matchesIncidentAgent(agent, syncStatus)) return "AGENT_SCOPE_MISMATCH";

  const recovery = await dependencies.reconcileClosedOrders({
    storeUuid: FUMUN_INCIDENT.storeUuid,
    branchUuid: FUMUN_INCIDENT.branchUuid,
    deviceCode: FUMUN_INCIDENT.deviceCode,
  });
  dependencies.refreshUi();
  if (!recoveryCompleted(recovery)) return "SYNC_INCOMPLETE";

  dependencies.markCompleted();
  return "REPAIRED";
}
