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
  FUMUN_INCIDENT_COMPLETED_KEY,
  isFumunIncidentScope,
} from "@/lib/fumun-incident";

// Agent 1.0.7 is the first release whose recovery path excludes the current
// restaurant business day at both proof and mutation time.
const SAFE_PRIOR_DAY_RECOVERY_AGENT_VERSION = [1, 0, 7] as const;

export type FumunRepairResult =
  | "NOT_TARGET"
  | "ALREADY_REPAIRED"
  | "AGENT_UPDATE_REQUIRED"
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
  markCompleted: () => {
    try {
      window.localStorage.setItem(FUMUN_INCIDENT_COMPLETED_KEY, "1");
    } catch {
      // Recovery itself is authoritative; storage only controls the temporary
      // Fumun online-read bypass and must not make recovery fail.
    }
  },
};

export function isFumunIncidentUser(user: Pick<AuthUser, "store_uuid" | "branch_uuid"> | null) {
  return isFumunIncidentScope({
    storeUuid: user?.store_uuid,
    branchUuid: user?.branch_uuid,
  });
}

export { FUMUN_INCIDENT } from "@/lib/fumun-incident";

function supportsSafePriorDayRecovery(version?: string) {
  const parts = String(version || "").split(".").slice(0, 3).map((part) => Number.parseInt(part, 10));
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return false;
  for (let index = 0; index < SAFE_PRIOR_DAY_RECOVERY_AGENT_VERSION.length; index += 1) {
    if (parts[index] > SAFE_PRIOR_DAY_RECOVERY_AGENT_VERSION[index]) return true;
    if (parts[index] < SAFE_PRIOR_DAY_RECOVERY_AGENT_VERSION[index]) return false;
  }
  return true;
}

function matchesAgentScope(
  agent: AgentInfo,
  status: LocalSyncStatus | null,
  scope: { storeUuid: string; branchUuid: string },
) {
  const deviceCode = String(agent.device_code || "");
  return Boolean(deviceCode) && status?.device_code === deviceCode &&
    status.store_uuid === scope.storeUuid && status.branch_uuid === scope.branchUuid;
}

function recoveryCompleted(
  result: LocalServerClosedRecoveryResult,
  scope: { storeUuid: string; branchUuid: string; deviceCode: string },
) {
  return result.deferred_processing_orders.length === 0 &&
    result.status?.store_uuid === scope.storeUuid &&
    result.status.branch_uuid === scope.branchUuid &&
    result.status.device_code === scope.deviceCode;
}

/**
 * Reconciles prior-business-day local bills for the signed-in store. Agent
 * 1.0.7+ supplies the age guard and Backend-paid proof; browser code can only
 * request recovery for its exact store, branch and device.
 */
export async function repairPriorDayServerClosedOrders(
  user: Pick<AuthUser, "uuid" | "store_uuid" | "branch_uuid"> | null,
  dependencies: FumunRepairDependencies = defaultDependencies,
): Promise<FumunRepairResult> {
  const storeUuid = String(user?.store_uuid || "");
  const branchUuid = String(user?.branch_uuid || "");
  if (!storeUuid || !branchUuid) return "NOT_TARGET";

  const [agent, syncStatus] = await Promise.all([
    dependencies.getAgentInfo(),
    dependencies.getSyncStatus(),
  ]);
  if (!supportsSafePriorDayRecovery(agent.version)) return "AGENT_UPDATE_REQUIRED";
  if (!matchesAgentScope(agent, syncStatus, { storeUuid, branchUuid })) {
    return "AGENT_SCOPE_MISMATCH";
  }

  const deviceCode = String(agent.device_code);
  const scope = { storeUuid, branchUuid, deviceCode };
  const recovery = await dependencies.reconcileClosedOrders(scope);
  dependencies.refreshUi();
  if (!recoveryCompleted(recovery, scope)) return "SYNC_INCOMPLETE";

  if (isFumunIncidentScope({ storeUuid, branchUuid })) dependencies.markCompleted();
  return "REPAIRED";
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
  return repairPriorDayServerClosedOrders(user, dependencies);
}
