export const FUMUN_INCIDENT = Object.freeze({
  storeUuid: "14fa3632-dc9b-4539-a992-54741768bc99",
  branchUuid: "f562e6be-132e-4fb2-9914-c61d6b9904fd",
  deviceCode: "SERVERPOS3",
});

export const FUMUN_INCIDENT_COMPLETED_KEY =
  "yummy-go:incident-repaired:fumun-server-closed-orders-v2";

export function isFumunIncidentScope(scope: { storeUuid?: string; branchUuid?: string }) {
  return scope.storeUuid === FUMUN_INCIDENT.storeUuid &&
    scope.branchUuid === FUMUN_INCIDENT.branchUuid;
}

export function isFumunIncidentRecoveryPending(
  scope: { storeUuid?: string; branchUuid?: string },
  storage: Pick<Storage, "getItem"> | null = typeof window === "undefined" ? null : window.localStorage,
) {
  if (!isFumunIncidentScope(scope)) return false;
  try {
    return storage?.getItem(FUMUN_INCIDENT_COMPLETED_KEY) !== "1";
  } catch {
    // A browser that denies localStorage must keep the safer incident routing
    // until the Agent-side authoritative recovery can be confirmed.
    return true;
  }
}
