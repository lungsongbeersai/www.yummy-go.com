import { describe, expect, it, vi } from "vitest";
import { finishCommittedCartItemAction } from "./committed-cart-item-action";

describe("committed cancellation effects", () => {
  it("invalidates and reloads the bill before waiting for the printer", async () => {
    const events: string[] = [];
    let finishPrint!: () => void;
    const printing = new Promise<void>((resolve) => { finishPrint = resolve; });
    const result = finishCommittedCartItemAction({
      invalidate: () => { events.push("invalidate"); },
      refresh: async () => { events.push("refresh"); },
      print: async () => { events.push("print"); await printing; },
    });
    await vi.waitFor(() => expect(events).toEqual(["invalidate", "refresh", "print"]));
    finishPrint();
    expect((await result).refreshError).toBeUndefined();
  });
  it("keeps a committed cancellation distinct from a printer failure", async () => {
    const failure = new Error("printer disconnected");
    const refresh = vi.fn(async () => {});
    const result = await finishCommittedCartItemAction({ invalidate: () => {}, refresh, print: async () => { throw failure; } });
    expect(refresh).toHaveBeenCalledOnce();
    expect(result.refreshError).toBeUndefined();
    expect(result.printError).toBe(failure);
  });
  it("invalidates old data even when reloading fails, without treating it as a mutation failure", async () => {
    const failure = new Error("read failed");
    const invalidate = vi.fn();
    const print = vi.fn(async () => "printed");
    const result = await finishCommittedCartItemAction({ invalidate, refresh: async () => { throw failure; }, print });
    expect(invalidate).toHaveBeenCalledOnce();
    expect(result.refreshError).toBe(failure);
    expect(result.printResult).toBe("printed");
  });
});
