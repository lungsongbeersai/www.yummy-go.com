import { describe, expect, it } from "vitest";
import { __mobileTcpInternals } from "@/services/printer/mobile-tcp";

describe("mobile TCP printer queue", () => {
  it("serializes kitchen and bar sockets because the native plugin owns one active socket", async () => {
    const events: string[] = [];
    let releaseFirst: (() => void) | undefined;

    const first = __mobileTcpInternals.runOnMobileTcpQueue(
      () => new Promise<void>((resolve) => {
        events.push("kitchen-start");
        releaseFirst = () => {
          events.push("kitchen-end");
          resolve();
        };
      }),
    );
    const second = __mobileTcpInternals.runOnMobileTcpQueue(async () => {
      events.push("bar-start");
    });

    await Promise.resolve();
    expect(events).toEqual(["kitchen-start"]);

    releaseFirst?.();
    await Promise.all([first, second]);
    expect(events).toEqual(["kitchen-start", "kitchen-end", "bar-start"]);
  });

  it("continues the queue after one printer fails", async () => {
    const events: string[] = [];
    const failed = __mobileTcpInternals.runOnMobileTcpQueue(async () => {
      events.push("failed-printer");
      throw new Error("offline");
    });
    const next = __mobileTcpInternals.runOnMobileTcpQueue(async () => {
      events.push("next-printer");
    });

    await expect(failed).rejects.toThrow("offline");
    await next;
    expect(events).toEqual(["failed-printer", "next-printer"]);
  });

  it("keeps a longer final drain for large receipts", () => {
    expect(__mobileTcpInternals.mobileTcpFinalDrainMs(4096)).toBe(500);
    expect(__mobileTcpInternals.mobileTcpFinalDrainMs(1024 * 1024)).toBe(1500);
  });
});
