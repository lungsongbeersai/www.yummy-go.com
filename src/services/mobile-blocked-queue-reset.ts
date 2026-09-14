"use client";

import type { BrowserOfflineScope, BrowserOfflineStore } from "@/services/offline-db";
import {
  discardStuckBrowserSyncEvents,
  listBlockedBrowserSyncEvents,
} from "@/services/offline-sync";

const APPLIED_RESET_PREFIX = "yummy-go:blocked-queue-reset:";

interface ResetMarkerStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

interface BlockedQueueResetCommand {
  version: number;
  branchUuid: string;
  requestedAt: number;
}

export interface MobileBlockedQueueResetResult {
  applied: boolean;
  discarded: number;
  skippedFinancial: number;
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function mobileBlockedQueueResetCommand(
  response: unknown,
): BlockedQueueResetCommand | null {
  const wrapper = record(response);
  const data = record(wrapper.data ?? response);
  const mobile = record(data.mobile);
  const rollout = record(data.rollout);
  const reset = record(mobile.blocked_queue_reset);
  const version = Number(reset.version);
  const branchUuid = String(rollout.branch_uuid ?? "").trim();
  const requestedAt = Date.parse(String(reset.requested_at ?? ""));
  if (
    !Number.isSafeInteger(version) ||
    version <= 0 ||
    !branchUuid ||
    !Number.isFinite(requestedAt)
  ) return null;
  // The server contract deliberately has no financial override. A malformed
  // response asking for one is ignored rather than widening a remote delete.
  if (reset.include_financial === true) return null;
  return { version, branchUuid, requestedAt };
}

function markerStorage(override?: ResetMarkerStorage) {
  if (override) return override;
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function markerKey(scope: BrowserOfflineScope) {
  return `${APPLIED_RESET_PREFIX}${scope.storeUuid}:${scope.branchUuid}`;
}

/**
 * Applies a server-issued branch reset once on this physical browser/device.
 * Only terminal BLOCKED rows are considered and PAYMENT is always retained.
 * The server timestamp is also a hard cutoff: even if a user clears only this
 * localStorage marker while leaving Dexie intact, an old command cannot erase
 * a rejection created after the incident it was issued for.
 */
export async function applyMobileBlockedQueueReset(
  scope: BrowserOfflineScope,
  response: unknown,
  browserStore?: BrowserOfflineStore,
  storageOverride?: ResetMarkerStorage,
): Promise<MobileBlockedQueueResetResult> {
  const command = mobileBlockedQueueResetCommand(response);
  const storage = markerStorage(storageOverride);
  if (!command || !storage || command.branchUuid !== scope.branchUuid) {
    return { applied: false, discarded: 0, skippedFinancial: 0 };
  }

  const key = markerKey(scope);
  let appliedVersion = 0;
  try {
    appliedVersion = Number(storage.getItem(key) || 0);
  } catch {
    return { applied: false, discarded: 0, skippedFinancial: 0 };
  }
  if (Number.isFinite(appliedVersion) && appliedVersion >= command.version) {
    return { applied: false, discarded: 0, skippedFinancial: 0 };
  }

  const blocked = await listBlockedBrowserSyncEvents(scope, browserStore);
  const eligible = blocked
    .filter((entry) => entry.createdAt <= command.requestedAt)
    .map((entry) => entry.eventUuid);
  const result = await discardStuckBrowserSyncEvents(
    scope,
    eligible,
    { includeFinancial: false },
    browserStore,
  );
  storage.setItem(key, String(command.version));
  return {
    applied: true,
    discarded: result.discarded.length,
    skippedFinancial: result.skipped.length,
  };
}
