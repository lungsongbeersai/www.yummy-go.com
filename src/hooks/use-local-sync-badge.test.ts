import { describe, expect, it } from "vitest";
import { localSyncBadgeState } from "@/hooks/use-local-sync-badge";

describe("what the till badge says", () => {
  it("says nothing when everything has reached the server", () => {
    expect(localSyncBadgeState({ pending: 0, failed: 0, blocked: 0 })).toBeNull();
    expect(localSyncBadgeState(undefined)).toBeNull();
    // PROCESSING is in flight and settles itself, so it is not worth a warning.
    expect(localSyncBadgeState({ pending: 0, failed: 0, blocked: 0 })).toBeNull();
  });

  it("shows work that is still on its way", () => {
    expect(localSyncBadgeState({ pending: 3 })).toEqual({ tone: "pending", count: 3 });
  });

  it("prefers blocked over everything else, because only it needs a person", () => {
    expect(localSyncBadgeState({ pending: 9, failed: 4, blocked: 2 }))
      .toEqual({ tone: "blocked", count: 2 });
  });

  it("names the printer when a kitchen ticket is what is holding the order", () => {
    // Proof of print is required before a kitchen confirmation may sync, and a
    // failed ticket never retries on its own — calling this "syncing" would be a
    // lie, and it is the cashier who can fix it.
    expect(localSyncBadgeState({ pending: 6, waiting_on_print: 6 }))
      .toEqual({ tone: "print", count: 6 });
  });

  it("still puts blocked ahead of a printer problem", () => {
    expect(localSyncBadgeState({ pending: 6, waiting_on_print: 6, blocked: 1 }))
      .toEqual({ tone: "blocked", count: 1 });
  });

  it("prefers failed over pending, since a retry loop is worse than a queue", () => {
    expect(localSyncBadgeState({ pending: 9, failed: 4, blocked: 0 }))
      .toEqual({ tone: "failed", count: 4 });
  });
});
