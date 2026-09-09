"use client";

import { apiRequest } from "@/lib/api";
import type { BrowserOfflineIdentity } from "@/services/offline-db";

const PREPARE_FRESH_MS = 5 * 60 * 1000;
const preparedUntil = new Map<string, number>();
const running = new Map<string, Promise<boolean>>();

/**
 * Small operational snapshot needed to route a ticket without internet.
 * Catalog/image warming remains in offline-menu.ts; this only makes the
 * branch/table/printer decision explicit and scoped to the current device.
 */
export function prepareMobileOfflineOperations(
  scope: BrowserOfflineIdentity,
  deviceCode: string,
) {
  const key = JSON.stringify([scope.storeUuid, scope.branchUuid, scope.actorLoginUuid, deviceCode]);
  if ((preparedUntil.get(key) ?? 0) > Date.now()) return Promise.resolve(true);
  const existing = running.get(key);
  if (existing) return existing;
  const task = Promise.all([
    apiRequest("get", "/api/v1/sync/runtime-capabilities"),
    apiRequest("get", "/api/v1/posAll/fetch_table", {
      params: { branch_uuid_fk: scope.branchUuid },
    }),
    // The Backend derives VAT/service charge from the branch and the selected
    // table at sale time. Keep the same scoped inputs on the device so a new
    // offline bill is priced exactly like an online bill before payment.
    apiRequest("get", "/api/v1/branch/fetch_all", {
      params: { store_uuid_fk: scope.storeUuid },
    }),
    apiRequest("get", "/api/v1/table/fetch_all", {
      params: { branch_uuid_fk: scope.branchUuid },
    }),
    apiRequest("get", "/api/v1/printer/fetch", {
      params: {
        login_uuid_fk: scope.actorLoginUuid,
        device_code: deviceCode,
        agent_id: "browser-mobile",
        print_mode: "mobile_wifi",
      },
    }),
  ]).then(() => {
    preparedUntil.set(key, Date.now() + PREPARE_FRESH_MS);
    return true;
  }).catch(() => false).finally(() => running.delete(key));
  running.set(key, task);
  return task;
}
