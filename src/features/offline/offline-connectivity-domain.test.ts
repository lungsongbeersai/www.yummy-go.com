import { describe, expect, it } from "vitest";
import {
  applyConnectivityProbeResult,
  applyBackendOfflineChange,
  applyUserDismiss,
  initialOfflineDialogState,
} from "@/features/offline/offline-connectivity-domain";

describe("offline connectivity dialog domain", () => {
  it("opens on a failed probe during a fresh outage", () => {
    const state = applyConnectivityProbeResult(initialOfflineDialogState, false);
    expect(state).toEqual({ open: true, dismissedForThisOutage: false });
  });

  it("does not reopen on a later failed probe after the user dismissed it", () => {
    let state = applyConnectivityProbeResult(initialOfflineDialogState, false);
    state = applyUserDismiss();
    expect(state).toEqual({ open: false, dismissedForThisOutage: true });

    // A later transport probe fails again during the same confirmed outage; another
    // probe runs while still genuinely offline — this must NOT reopen the dialog.
    state = applyConnectivityProbeResult(state, false);
    expect(state).toEqual({ open: false, dismissedForThisOutage: true });

    state = applyConnectivityProbeResult(state, false);
    expect(state).toEqual({ open: false, dismissedForThisOutage: true });
  });

  it("closes immediately when a probe succeeds mid-outage, dismissed or not", () => {
    let state = applyConnectivityProbeResult(initialOfflineDialogState, false);
    state = applyUserDismiss();

    state = applyConnectivityProbeResult(state, true);
    expect(state.open).toBe(false);
  });

  it("resets dismissal once Backend becomes reachable", () => {
    let state = applyConnectivityProbeResult(initialOfflineDialogState, false);
    state = applyUserDismiss();

    state = applyBackendOfflineChange(state, false);
    expect(state).toEqual(initialOfflineDialogState);
  });

  it("re-opens for a brand new outage after a prior one was dismissed and resolved", () => {
    let state = applyConnectivityProbeResult(initialOfflineDialogState, false);
    state = applyUserDismiss();
    state = applyBackendOfflineChange(state, false);

    // Backend NetworkManager confirms a second, unrelated outage.
    state = applyBackendOfflineChange(state, true);
    state = applyConnectivityProbeResult(state, false);
    expect(state.open).toBe(true);
  });

  it("leaves state untouched while Backend stays offline", () => {
    const dismissed = applyUserDismiss();
    const state = applyBackendOfflineChange(dismissed, true);
    expect(state).toBe(dismissed);
  });
});
