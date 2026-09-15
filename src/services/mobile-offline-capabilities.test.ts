import { describe, expect, it } from "vitest";
import { acceptsMobileOfflineCapability, MOBILE_OFFLINE_CONTRACT_VERSION } from "./mobile-offline-capabilities";

const scope = { storeUuid: "store-1", branchUuid: "branch-1" };
const now = Date.now();

function enabled(branchUuid = scope.branchUuid) {
  return {
    data: {
      contract_version: MOBILE_OFFLINE_CONTRACT_VERSION,
      mobile: { offline_checkout_enabled: true, durable_print_queue_enabled: true },
      rollout: { branch_uuid: branchUuid, kill_switch_active: false },
    },
  };
}

describe("mobile offline checkout capability", () => {
  it("accepts only the exact branch and contract", () => {
    expect(acceptsMobileOfflineCapability(enabled(), scope, now, now)).toBe(true);
    expect(acceptsMobileOfflineCapability(enabled("another-branch"), scope, now, now)).toBe(false);
    expect(acceptsMobileOfflineCapability({ data: { ...enabled().data, contract_version: "old" } }, scope, now, now)).toBe(false);
  });

  it("fails closed for stale data and the emergency kill switch", () => {
    expect(acceptsMobileOfflineCapability(enabled(), scope, now - 25 * 60 * 60 * 1000, now)).toBe(false);
    expect(acceptsMobileOfflineCapability({ data: { ...enabled().data, rollout: { branch_uuid: scope.branchUuid, kill_switch_active: true } } }, scope, now, now)).toBe(false);
  });
});
