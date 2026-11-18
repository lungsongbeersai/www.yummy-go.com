import { describe, expect, it } from "vitest";
import { createPaymentViewScope } from "./payment-view-scope";

describe("payment view completion ownership", () => {
  it("captures the current view before any asynchronous request", () => {
    const scope = createPaymentViewScope("order-A");
    const ownsView = scope.capture();
    expect(ownsView()).toBe(true);
  });

  it("invalidates a response after the originating view closes", () => {
    const scope = createPaymentViewScope("order-A");
    const close = scope.activate();
    const ownsView = scope.capture();
    close();
    expect(ownsView()).toBe(false);
    expect(scope.capture()()).toBe(false);
  });

  it("does not revive an old response after reopening the same order", () => {
    const scope = createPaymentViewScope("order-A");
    const close = scope.activate();
    const oldResponse = scope.capture();
    close();
    scope.activate();
    expect(oldResponse()).toBe(false);
    expect(scope.capture()()).toBe(true);
  });

  it("keeps a newer activation alive when an older cleanup runs late", () => {
    const scope = createPaymentViewScope("order-A");
    const oldCleanup = scope.activate();
    scope.activate();
    const nextResponse = scope.capture();
    oldCleanup();
    expect(nextResponse()).toBe(true);
  });

  it("keeps separate dialogs independent for different orders", () => {
    const first = createPaymentViewScope("order-A");
    const second = createPaymentViewScope("order-B");
    const close = first.activate();
    const ownsSecond = second.capture();
    close();
    expect(ownsSecond()).toBe(true);
  });
});
