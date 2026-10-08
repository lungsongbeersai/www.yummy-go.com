import { describe, expect, it, vi } from "vitest";
import { createCartRefreshQueue } from "./cart-refresh-queue";

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

describe("cart refresh notifications", () => {
  it("performs a trailing read when a mutation is reported during an earlier read", async () => {
    const run = createCartRefreshQueue();
    const oldRead = deferred();
    const latestRead = deferred();
    const read = vi.fn().mockReturnValueOnce(oldRead.promise).mockReturnValueOnce(latestRead.promise);
    const done = run("bill-1", read);
    await vi.waitFor(() => expect(read).toHaveBeenCalledOnce());
    expect(run("bill-1", read)).toBe(done);
    run("bill-1", read);
    oldRead.resolve();
    await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(2));
    latestRead.resolve();
    await done;
    expect(read).toHaveBeenCalledTimes(2);
  });
  it("never schedules another old-bill read after switching bills", async () => {
    const run = createCartRefreshQueue();
    const oldRead = deferred();
    const read = vi.fn(() => oldRead.promise);
    const oldDone = run("old", read);
    await vi.waitFor(() => expect(read).toHaveBeenCalledOnce());
    run("old", read);
    await run("new", async () => {});
    oldRead.resolve();
    await oldDone;
    expect(read).toHaveBeenCalledOnce();
  });
  it("does not issue a trailing read after leaving the POS screen", async () => {
    const run = createCartRefreshQueue();
    const oldRead = deferred();
    const read = vi.fn(() => oldRead.promise);
    const done = run("bill", read);
    await vi.waitFor(() => expect(read).toHaveBeenCalledOnce());
    run("bill", read);
    run.cancel();
    oldRead.resolve();
    await done;
    expect(read).toHaveBeenCalledOnce();
  });
  it("still runs the pending read if the original request failed", async () => {
    const run = createCartRefreshQueue();
    const oldRead = deferred();
    const read = vi.fn().mockReturnValueOnce(oldRead.promise).mockResolvedValue(undefined);
    const done = run("bill", read);
    await vi.waitFor(() => expect(read).toHaveBeenCalledOnce());
    run("bill", read);
    oldRead.reject(new Error("transport"));
    await done;
    expect(read).toHaveBeenCalledTimes(2);
  });
});
