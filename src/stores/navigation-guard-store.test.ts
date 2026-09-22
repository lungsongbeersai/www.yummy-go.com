import { afterEach, describe, expect, it, vi } from "vitest";
import { useNavigationGuardStore } from "./navigation-guard-store";

describe("navigation guard store", () => {
  afterEach(() => {
    useNavigationGuardStore.getState().setGuard(null);
  });

  it("runs navigation immediately when no page guard is registered", () => {
    const action = vi.fn();

    expect(useNavigationGuardStore.getState().run(action)).toBe(false);
    expect(action).toHaveBeenCalledOnce();
  });

  it("lets the active page defer navigation until the user decides", () => {
    const action = vi.fn();
    const deferred: Array<() => void> = [];
    useNavigationGuardStore.getState().setGuard((nextAction) => {
      deferred.push(nextAction);
    });

    expect(useNavigationGuardStore.getState().run(action)).toBe(true);
    expect(action).not.toHaveBeenCalled();

    deferred[0]?.();
    expect(action).toHaveBeenCalledOnce();
  });
});
