import { describe, expect, it, vi } from "vitest";
import { createCartRefreshDeduper } from "./cart-refresh-deduper";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("createCartRefreshDeduper", () => {
  it("reuses only an overlapping refresh for the same POS session", async () => {
    const run = createCartRefreshDeduper();
    const first = deferred();
    const refresh = vi.fn(() => first.promise);

    const firstRequest = run("token-1:la", refresh);
    const duplicateRequest = run("token-1:la", refresh);

    expect(duplicateRequest).toBe(firstRequest);
    expect(refresh).toHaveBeenCalledOnce();

    first.resolve();
    await firstRequest;

    const nextRequest = run("token-1:la", () => Promise.resolve());
    expect(nextRequest).not.toBe(firstRequest);
  });

  it("does not reuse an old session request after the token or language changes", async () => {
    const run = createCartRefreshDeduper();
    const oldSession = deferred();
    const currentSession = deferred();

    const oldRequest = run("token-1:la", () => oldSession.promise);
    const currentRequest = run("token-2:en", () => currentSession.promise);

    expect(currentRequest).not.toBe(oldRequest);
    oldSession.resolve();
    await oldRequest;

    expect(run("token-2:en", () => Promise.resolve())).toBe(currentRequest);
    currentSession.resolve();
    await currentRequest;
  });
});
