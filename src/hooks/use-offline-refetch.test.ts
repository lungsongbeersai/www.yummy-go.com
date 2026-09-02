import { describe, expect, it } from "vitest";
import { BACKEND_NETWORK_STATE } from "@/lib/network-state";
import { shouldRefetchOnTransport } from "@/hooks/use-offline-refetch";

const { CHECKING, ONLINE, OFFLINE } = BACKEND_NETWORK_STATE;

describe("shouldRefetchOnTransport", () => {
  it("does not refetch while the verdict is still CHECKING", () => {
    expect(shouldRefetchOnTransport(ONLINE, null, CHECKING)).toBe(false);
    expect(shouldRefetchOnTransport(CHECKING, "OFFLINE", CHECKING)).toBe(false);
  });

  it("does not refetch when the first verdict matches the mount state", () => {
    // Cold start already OFFLINE (navigator.onLine === false seed): the mount
    // load already went to the Agent.
    expect(shouldRefetchOnTransport(OFFLINE, null, OFFLINE)).toBe(false);
    expect(shouldRefetchOnTransport(ONLINE, null, ONLINE)).toBe(false);
  });

  it("refetches on the first OFFLINE verdict after mounting mid-transition", () => {
    // Screen mounted during CHECKING (net just dropped); its mount load raced the
    // verdict and hit the dead backend before offline routing took over.
    expect(shouldRefetchOnTransport(CHECKING, null, OFFLINE)).toBe(true);
    // Mounted ONLINE, dropped straight to OFFLINE before the hook saw ONLINE.
    expect(shouldRefetchOnTransport(ONLINE, null, OFFLINE)).toBe(true);
  });

  it("does not refetch on a first ONLINE verdict — the happy path is not burdened", () => {
    expect(shouldRefetchOnTransport(CHECKING, null, ONLINE)).toBe(false);
  });

  it("refetches on every settled flip between ONLINE and OFFLINE", () => {
    expect(shouldRefetchOnTransport(ONLINE, "ONLINE", OFFLINE)).toBe(true);
    expect(shouldRefetchOnTransport(ONLINE, "OFFLINE", ONLINE)).toBe(true);
    expect(shouldRefetchOnTransport(CHECKING, "OFFLINE", OFFLINE)).toBe(false);
    expect(shouldRefetchOnTransport(CHECKING, "ONLINE", ONLINE)).toBe(false);
  });
});
