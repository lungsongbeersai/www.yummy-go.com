import { describe, expect, it, vi } from "vitest";
import { createExportScope } from "./export-scope";

describe("export view ownership", () => {
  it("invalidates pending native exports when the view ends and notifies each live subscription once", () => {
    const scope = createExportScope("report-a", () => true);
    expect(scope.isCurrent()).toBe(false);
    const end = scope.activate();
    const live = vi.fn();
    const released = vi.fn();
    scope.isCurrent.subscribe(live);
    scope.isCurrent.subscribe(released)();
    expect(scope.isCurrent()).toBe(true);
    end(); end();
    expect(scope.isCurrent()).toBe(false);
    expect(live).toHaveBeenCalledTimes(1);
    expect(released).not.toHaveBeenCalled();
  });

  it("rejects an account or branch change synchronously before React commits the next view", () => {
    let sameOwner = true;
    const scope = createExportScope("report-a", () => sameOwner);
    scope.activate();
    sameOwner = false;
    expect(scope.isCurrent()).toBe(false);
  });
});
