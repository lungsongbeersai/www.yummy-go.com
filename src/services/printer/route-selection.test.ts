import { describe, expect, it } from "vitest";
import { shouldDeferSharedPrintToOwner } from "@/services/printer/route-selection";

describe("printer route selection", () => {
  it("keeps requester Direct jobs on the requester", () => {
    expect(shouldDeferSharedPrintToOwner({})).toBe(false);
    expect(
      shouldDeferSharedPrintToOwner({
        pendingRemoteShared: false,
        queuedRemoteShared: false,
      }),
    ).toBe(false);
  });

  it("leaves a Shared job in the Backend queue for its owner Agent", () => {
    expect(
      shouldDeferSharedPrintToOwner({ pendingRemoteShared: true }),
    ).toBe(true);
    expect(
      shouldDeferSharedPrintToOwner({ queuedRemoteShared: true }),
    ).toBe(true);
  });
});
