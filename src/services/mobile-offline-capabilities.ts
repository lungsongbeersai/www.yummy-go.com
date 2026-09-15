"use client";

import {
  listBrowserApiCacheEntries,
  type BrowserOfflineScope,
  type BrowserOfflineStore,
} from "@/services/offline-db";

export const MOBILE_OFFLINE_CONTRACT_VERSION = "offline-first-v2";
export const MOBILE_OFFLINE_CAPABILITY_PATH = "/api/v1/sync/runtime-capabilities";
const CAPABILITY_MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface MobileOfflineCapabilityData {
  contract_version?: string;
  server_time?: string;
  mobile?: {
    offline_checkout_enabled?: boolean;
    durable_print_queue_enabled?: boolean;
  };
  rollout?: {
    branch_uuid?: string | null;
    kill_switch_active?: boolean;
  };
}

interface MobileOfflineCapabilityResponse {
  data?: MobileOfflineCapabilityData;
}

function capabilityData(response: unknown): MobileOfflineCapabilityData | null {
  if (!response || typeof response !== "object" || Array.isArray(response)) return null;
  const wrapper = response as MobileOfflineCapabilityResponse;
  const candidate = wrapper.data ?? response as MobileOfflineCapabilityData;
  return candidate && typeof candidate === "object" ? candidate : null;
}

export function acceptsMobileOfflineCapability(
  response: unknown,
  scope: BrowserOfflineScope,
  cachedAt: number,
  now = Date.now(),
) {
  const capability = capabilityData(response);
  if (!capability || now - cachedAt > CAPABILITY_MAX_AGE_MS) return false;
  return capability.contract_version === MOBILE_OFFLINE_CONTRACT_VERSION &&
    capability.rollout?.branch_uuid === scope.branchUuid &&
    capability.rollout.kill_switch_active !== true &&
    capability.mobile?.offline_checkout_enabled === true &&
    capability.mobile.durable_print_queue_enabled === true;
}

export async function mobileOfflineCheckoutEnabled(
  scope: BrowserOfflineScope,
  store?: BrowserOfflineStore,
) {
  const entries = await listBrowserApiCacheEntries(
    scope,
    MOBILE_OFFLINE_CAPABILITY_PATH,
    store,
  );
  const latest = entries.at(-1);
  return latest ? acceptsMobileOfflineCapability(latest.response, scope, latest.cachedAt) : false;
}

/** Refreshing is best effort; the cached, scoped contract remains the authority. */
export async function refreshMobileOfflineCapabilities() {
  const { apiRequest } = await import("@/lib/api");
  return apiRequest<MobileOfflineCapabilityResponse>("get", MOBILE_OFFLINE_CAPABILITY_PATH);
}
