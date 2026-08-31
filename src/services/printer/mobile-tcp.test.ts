import { describe, expect, it, vi } from "vitest";
import { __mobileTcpInternals } from "@/services/printer/mobile-tcp";

describe("mobile TCP printer queue", () => {
  it("serializes jobs sent to the same physical printer", async () => {
    const events: string[] = [];
    let releaseFirst: (() => void) | undefined;

    const first = __mobileTcpInternals.runOnMobileTcpQueue(
      "tcp://192.168.1.20:9100",
      () => new Promise<void>((resolve) => {
        events.push("kitchen-start");
        releaseFirst = () => {
          events.push("kitchen-end");
          resolve();
        };
      }),
    );
    const second = __mobileTcpInternals.runOnMobileTcpQueue("tcp://192.168.1.20:9100", async () => {
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
    const failed = __mobileTcpInternals.runOnMobileTcpQueue("tcp://192.168.1.20:9100", async () => {
      events.push("failed-printer");
      throw new Error("offline");
    });
    const next = __mobileTcpInternals.runOnMobileTcpQueue("tcp://192.168.1.20:9100", async () => {
      events.push("next-printer");
    });

    await expect(failed).rejects.toThrow("offline");
    await next;
    expect(events).toEqual(["failed-printer", "next-printer"]);
  });

  it("runs different physical printers concurrently", async () => {
    const events: string[] = [];
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const kitchen = __mobileTcpInternals.runOnMobileTcpQueue(
      "tcp://192.168.1.20:9100",
      async () => {
        events.push("kitchen-start");
        await gate;
      },
    );
    const bar = __mobileTcpInternals.runOnMobileTcpQueue(
      "tcp://192.168.1.21:9100",
      async () => {
        events.push("bar-start");
        await gate;
      },
    );

    await Promise.resolve();
    expect(new Set(events)).toEqual(new Set(["kitchen-start", "bar-start"]));
    release?.();
    await Promise.all([kitchen, bar]);
  });

  it("keeps a longer final drain for large receipts", () => {
    expect(__mobileTcpInternals.mobileTcpFinalDrainMs(4096)).toBe(500);
    expect(__mobileTcpInternals.mobileTcpFinalDrainMs(1024 * 1024)).toBe(1500);
    expect(__mobileTcpInternals.mobileTcpFinalDrainMs(2 * 1024 * 1024)).toBe(3000);
  });

  it("slows and periodically cools only medium and long raster receipts", () => {
    expect(__mobileTcpInternals.mobileTcpSendProfile(128 * 1024).profile).toBe("short");
    expect(__mobileTcpInternals.mobileTcpSendProfile(512 * 1024)).toMatchObject({
      cooldownEveryBytes: 128 * 1024,
      cooldownMs: 200,
      delayMs: 50,
      profile: "medium",
    });
    expect(__mobileTcpInternals.mobileTcpSendProfile(2 * 1024 * 1024)).toMatchObject({
      cooldownEveryBytes: 64 * 1024,
      cooldownMs: 250,
      delayMs: 60,
      profile: "long",
    });
  });

  it("sends every byte of a long payload in order before completing", async () => {
    const source = Buffer.from(Array.from({ length: 256 * 1024 }, (_, index) => index % 251));
    const sent: Buffer[] = [];
    const TcpSocket = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      read: vi.fn(),
      send: vi.fn(async ({ data }: { data: string }) => {
        sent.push(Buffer.from(data, "base64"));
      }),
    };

    await __mobileTcpInternals.sendBase64InChunks({
      TcpSocket,
      client: "test-client",
      base64: source.toString("base64"),
      chunkSize: 2732,
      cooldownEveryBytes: 0,
      cooldownMs: 0,
      delayMs: 0,
    });

    expect(Buffer.concat(sent)).toEqual(source);
    expect(TcpSocket.send).toHaveBeenCalledTimes(Math.ceil(source.toString("base64").length / 2732));
  });

  it("splits long renderer payloads only between complete raster commands", () => {
    const header = Buffer.from([
      0x1b, 0x40,
      0x1b, 0x61, 0x00,
      0x1d, 0x4c, 0x00, 0x00,
      0x1b, 0x33, 24,
    ]);
    const rasterBand = (seed: number) => Buffer.concat([
      Buffer.from([0x1d, 0x76, 0x30, 0x00, 72, 0x00, 64, 0x00]),
      Buffer.alloc(72 * 64, seed),
    ]);
    const source = Buffer.concat([
      header,
      ...Array.from({ length: 30 }, (_, index) => rasterBand(index)),
      Buffer.from([0x1d, 0x56, 0x01]),
    ]);

    const segments = __mobileTcpInternals.splitEscposBase64ForTransport(
      source.toString("base64"),
      24 * 1024,
    );
    const decoded = segments.map((segment) => Buffer.from(segment, "base64"));

    expect(segments.length).toBeGreaterThan(1);
    expect(Buffer.concat(decoded)).toEqual(source);
    expect(decoded.every((segment) => segment.length <= 24 * 1024)).toBe(true);
    for (const continuation of decoded.slice(1)) {
      expect([...continuation.subarray(0, 4)]).toEqual([0x1d, 0x76, 0x30, 0x00]);
    }
  });

  it("keeps unknown ESC/POS payloads intact instead of guessing a split point", () => {
    const source = Buffer.alloc(
      __mobileTcpInternals.MOBILE_TCP_SEGMENT_MAX_BYTES + 1,
      0x41,
    );

    const segments = __mobileTcpInternals.splitEscposBase64ForTransport(
      source.toString("base64"),
    );

    expect(segments).toEqual([source.toString("base64")]);
  });

  it("decodes native printer status bytes consistently", () => {
    expect(__mobileTcpInternals.printerStatusByte("AA==")).toBe(0);
    expect(__mobileTcpInternals.printerStatusByte("YA==")).toBe(0x60);
    expect(__mobileTcpInternals.printerStatusByte(String.fromCharCode(8))).toBe(8);
    expect(__mobileTcpInternals.printerStatusByte("")).toBeNull();
  });

  it("confirms completion only after the printer answers the paper-status command", async () => {
    const TcpSocket = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      read: vi.fn().mockResolvedValue({ result: "AA==" }),
      send: vi.fn().mockResolvedValue(undefined),
    };

    await expect(
      __mobileTcpInternals.confirmMobilePrinterCompleted({
        TcpSocket,
        client: "printer-client",
      }),
    ).resolves.toBeUndefined();

    expect(TcpSocket.send).toHaveBeenCalledWith({
      client: "printer-client",
      data: Buffer.from([0x1d, 0x72, 0x01]).toString("base64"),
      encoding: "base64",
    });
    expect(TcpSocket.read).toHaveBeenCalledWith({
      client: "printer-client",
      expectLen: 1,
      timeout: 4,
    });
  });

  it("keeps delivery unknown when the printer reports paper out", async () => {
    const TcpSocket = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      read: vi.fn().mockResolvedValue({ result: "YA==" }),
      send: vi.fn().mockResolvedValue(undefined),
    };

    await expect(
      __mobileTcpInternals.confirmMobilePrinterCompleted({
        TcpSocket,
        client: "printer-client",
      }),
    ).rejects.toMatchObject({
      delivery_state: "unknown",
      message: "Printer reported paper out before completion",
    });
  });
});
