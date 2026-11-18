import { describe, expect, it, vi } from "vitest";
import { createProductActionRequest } from "./product-action-request";

describe("product action request ownership", () => {
  it("allows only one pending read for the same product", () => {
    const requests = createProductActionRequest();
    const first = requests.begin("selection", "A");
    expect(first?.isCurrent()).toBe(true);
    expect(requests.begin("selection", "A")).toBeNull();
    expect(first?.finish()).toBe(true);
    expect(requests.begin("selection", "A")?.isCurrent()).toBe(true);
  });

  it("invalidates product A when the user chooses product B", () => {
    const requests = createProductActionRequest();
    const first = requests.begin("selection", "A");
    const second = requests.begin("selection", "B");
    expect(first?.isCurrent()).toBe(false);
    expect(first?.finish()).toBe(false);
    expect(second?.isCurrent()).toBe(true);
  });

  it("does not reopen a selection after closing it", () => {
    const requests = createProductActionRequest();
    const first = requests.begin("selection", "A");
    expect(requests.cancelSelection()).toBe(true);
    expect(first?.isCurrent()).toBe(false);
    expect(first?.finish()).toBe(false);
  });

  it("allows retrying the same product after cancellation", () => {
    const requests = createProductActionRequest();
    const first = requests.begin("selection", "A");
    requests.cancelSelection();
    const retry = requests.begin("selection", "A");
    expect(first?.finish()).toBe(false);
    expect(retry?.isCurrent()).toBe(true);
  });

  it("does not release B's financial send when dismissed A settles later", () => {
    const requests = createProductActionRequest();
    const first = requests.begin("selection", "A");
    requests.cancelSelection();
    const send = requests.begin("order", "B");
    expect(first?.finish()).toBe(false);
    expect(send?.isCurrent()).toBe(true);
    expect(requests.begin("order", "C")).toBeNull();
    expect(requests.begin("selection", "D")).toBeNull();
  });

  it("cannot cancel a financial send by closing a selection", () => {
    const requests = createProductActionRequest();
    const send = requests.begin("order", "A");
    expect(requests.cancelSelection()).toBe(false);
    expect(send?.isCurrent()).toBe(true);
    expect(send?.finish()).toBe(true);
  });

  it("ignores late reads after leaving the owning screen or scope", () => {
    const requests = createProductActionRequest();
    const scope = requests.createScope("bill");
    const leave = scope.activate();
    const first = requests.begin("selection", "A");
    leave();
    expect(first?.isCurrent()).toBe(false);
    expect(first?.finish()).toBe(false);
  });

  it("releases a finished owner only once", () => {
    const requests = createProductActionRequest();
    const first = requests.begin("selection", "A");
    expect(first?.finish()).toBe(true);
    const second = requests.begin("selection", "B");
    expect(first?.finish()).toBe(false);
    expect(second?.isCurrent()).toBe(true);
  });

  it("rejects responses and callbacks from a previous route or account scope", () => {
    const requests = createProductActionRequest();
    const oldScope = requests.createScope("old");
    const leave = oldScope.activate();
    const first = requests.begin("selection", "A", oldScope);
    leave();
    const nextScope = requests.createScope("new");
    nextScope.activate();
    expect(first?.isCurrent()).toBe(false);
    expect(first?.finish()).toBe(false);
    expect(requests.begin("selection", "B", oldScope)).toBeNull();
    expect(requests.begin("selection", "B", nextScope)?.isCurrent()).toBe(true);
  });

  it("preserves a financial send's lock across a scope change until it settles", () => {
    const requests = createProductActionRequest();
    const oldScope = requests.createScope("old");
    const leave = oldScope.activate();
    const send = requests.begin("order", "A", oldScope);
    leave();
    const nextScope = requests.createScope("new");
    nextScope.activate();
    expect(send?.isCurrent()).toBe(false);
    expect(requests.begin("order", "B", nextScope)).toBeNull();
    expect(send?.finish()).toBe(true);
    expect(requests.begin("order", "B", nextScope)?.isCurrent()).toBe(true);
  });

  it("does not revive an old owner after leaving and reopening the same scope key", () => {
    const requests = createProductActionRequest();
    const oldScope = requests.createScope("same bill");
    const leave = oldScope.activate();
    const send = requests.begin("order", "A", oldScope);
    leave();
    const reopenedScope = requests.createScope("same bill");
    reopenedScope.activate();
    expect(send?.isCurrent()).toBe(false);
    expect(requests.begin("selection", "B", oldScope)).toBeNull();
    expect(requests.begin("selection", "B", reopenedScope)).toBeNull();
    expect(send?.finish()).toBe(true);
    expect(requests.begin("selection", "B", reopenedScope)?.isCurrent()).toBe(true);
  });

  it("keeps an old lease invalid when the same scope owner reactivates", () => {
    const requests = createProductActionRequest();
    const scope = requests.createScope("same bill");
    const leave = scope.activate();
    const send = requests.begin("order", "A", scope);
    leave();
    scope.activate();
    expect(send?.isCurrent()).toBe(false);
    expect(requests.begin("order", "B", scope)).toBeNull();
    expect(send?.finish()).toBe(true);
  });

  it("permits the initiating view's background refresh after releasing the send lock", () => {
    const requests = createProductActionRequest();
    const scope = requests.createScope("bill");
    const leave = scope.activate();
    const send = requests.begin("order", "A", scope);
    expect(send?.finish()).toBe(true);
    expect(send?.isCurrent()).toBe(false);
    expect(send?.isScopeCurrent()).toBe(true);
    leave();
    expect(send?.isScopeCurrent()).toBe(false);
    requests.createScope("bill").activate();
    expect(send?.isScopeCurrent()).toBe(false);
  });

  it("does not apply a late send completion to a reopened same-key view", async () => {
    const requests = createProductActionRequest();
    const scope = requests.createScope("bill");
    const leave = scope.activate();
    const owner = requests.begin("order", "A", scope)!;
    let resolve!: (value: string) => void;
    const result = new Promise<string>(done => { resolve = done; });
    const applyCompletion = vi.fn();
    const completion = result.then(value => {
      if (owner.isScopeCurrent()) applyCompletion(value);
    }).finally(owner.finish);
    leave();
    const reopenedScope = requests.createScope("bill");
    reopenedScope.activate();
    expect(requests.begin("order", "B", reopenedScope)).toBeNull();
    resolve("authoritative response for the old view");
    await completion;
    expect(applyCompletion).not.toHaveBeenCalled();
    expect(requests.begin("order", "B", reopenedScope)?.isCurrent()).toBe(true);
  });
});
