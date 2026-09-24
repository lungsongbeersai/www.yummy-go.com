import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { __mobileTcpInternals } from "@/services/printer/mobile-tcp";

function productionSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return productionSourceFiles(path);
    if (!/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) return [];
    return [path];
  });
}

describe("mobile TCP printer queue", () => {
  it("keeps the native socket patch free of generated build artifacts", () => {
    const patch = readFileSync(
      join(
        process.cwd(),
        "patches",
        "@deedarb+capacitor-tcp-socket+7.2.1.patch",
      ),
      "utf8",
    );

    expect(patch).not.toContain("/android/build/");
    expect(patch).not.toMatch(/\/(?:Users|home)\//);
  });

  it("keeps every native TCP print path behind the shared transport", () => {
    const sourceRoot = join(process.cwd(), "src");
    const sources = productionSourceFiles(sourceRoot);
    const relativeFilesContaining = (value: string) => sources
      .filter((path) => readFileSync(path, "utf8").includes(value))
      .map((path) => relative(sourceRoot, path))
      .sort();

    expect(
      relativeFilesContaining("@deedarb/capacitor-tcp-socket"),
    ).toEqual(["services/printer/mobile-tcp.ts"]);
    expect(relativeFilesContaining("printMobileEscposOverTcp")).toEqual([
      "services/printer/agent-transport.ts",
      "services/printer/mobile-tcp.ts",
      "services/printer/print-jobs.ts",
      "stores/printer-store.ts",
    ]);
  });

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

  it("uses one native write and TCP backpressure for renderer segments", () => {
    expect(__mobileTcpInternals.mobileTcpSendProfile()).toMatchObject({
      chunkSize: 256 * 1024,
      profile: "tcp_backpressure",
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
    });

    expect(Buffer.concat(sent)).toEqual(source);
    expect(TcpSocket.send).toHaveBeenCalledTimes(Math.ceil(source.toString("base64").length / 2732));
  });

  it("sends a maximum renderer segment across the native bridge once", async () => {
    const source = Buffer.alloc(160 * 1024, 0x55);
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
      ...__mobileTcpInternals.mobileTcpSendProfile(),
    });

    expect(TcpSocket.send).toHaveBeenCalledTimes(1);
    expect(Buffer.concat(sent)).toEqual(source);
  });

  it("flushes every segment of a very long receipt on one client before the final cut", async () => {
    const rasterBand = (seed: number) => Buffer.concat([
      Buffer.from([0x1d, 0x76, 0x30, 0x00, 72, 0x00, 24, 0x00]),
      Buffer.alloc(72 * 24, seed),
    ]);
    const cut = Buffer.from([0x1d, 0x56, 0x01]);
    const source = Buffer.concat([
      Buffer.from([0x1b, 0x40]),
      ...Array.from({ length: 220 }, (_, index) => rasterBand(index)),
      cut,
    ]);
    const sent: Buffer[] = [];
    const statusCommand = Buffer.from([0x1d, 0x72, 0x01]);
    const TcpSocket = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      read: vi.fn().mockResolvedValue({ result: "AA==" }),
      send: vi.fn(async ({ client, data }: { client: string | number; data: string }) => {
        expect(client).toBe("one-receipt-client");
        sent.push(Buffer.from(data, "base64"));
      }),
    };

    expect(source.length).toBeGreaterThan(
      __mobileTcpInternals.MOBILE_TCP_SEGMENT_MAX_BYTES,
    );

    await __mobileTcpInternals.sendEscposOnConnectedClient({
      TcpSocket,
      client: "one-receipt-client",
      escposBase64: source.toString("base64"),
    });

    const transport = Buffer.concat(sent);
    const delivered = transport.subarray(0, -statusCommand.length);
    expect(TcpSocket.send).toHaveBeenCalledTimes(3);
    expect(delivered).toEqual(source);
    expect(delivered.subarray(delivered.length - cut.length)).toEqual(cut);
    expect(transport.subarray(-statusCommand.length)).toEqual(statusCommand);
    expect(TcpSocket.read).toHaveBeenCalledTimes(1);
  });

  it("queues every ticket continuously and reports printer replies in cut order", async () => {
    const statusCommand = Buffer.from([0x1d, 0x72, 0x01]);
    const cut = Buffer.from([0x1d, 0x56, 0x01]);
    const raster = (seed: number) => Buffer.concat([
      Buffer.from([0x1d, 0x76, 0x30, 0x00, 2, 0x00, 8, 0x00]),
      Buffer.alloc(2 * 8, seed),
    ]);
    const source = Buffer.concat([
      Buffer.from([0x1b, 0x40]),
      raster(1),
      cut,
      raster(2),
      cut,
    ]);
    const sent: Buffer[] = [];
    const progress: number[] = [];
    const TcpSocket = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      read: vi.fn().mockResolvedValue({ result: "AA==" }),
      send: vi.fn(async ({ data }: { data: string }) => {
        sent.push(Buffer.from(data, "base64"));
      }),
    };

    await __mobileTcpInternals.sendEscposOnConnectedClient({
      TcpSocket,
      client: "batch-client",
      escposBase64: source.toString("base64"),
      onTicketDelivered: (completed) => progress.push(completed),
    });

    expect(Buffer.concat(sent)).toEqual(Buffer.concat([
      Buffer.from([0x1b, 0x40]),
      raster(1),
      cut,
      statusCommand,
      raster(2),
      cut,
      statusCommand,
    ]));
    expect(TcpSocket.read).toHaveBeenCalledTimes(2);
    expect(progress).toEqual([1, 2]);
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

  it("splits sparse renderer payloads without cutting ESC J feed commands", () => {
    const header = Buffer.from([
      0x1b, 0x40,
      0x1d, 0x50, 203, 203,
    ]);
    const dotFeed = Buffer.from([0x1b, 0x4a, 0xff]);
    const rasterBand = Buffer.concat([
      Buffer.from([0x1d, 0x76, 0x30, 0x00, 72, 0x00, 24, 0x00]),
      Buffer.alloc(72 * 24, 0x55),
    ]);
    const source = Buffer.concat([
      header,
      ...Array.from({ length: 20 }, () => Buffer.concat([dotFeed, rasterBand])),
      Buffer.from([0x1d, 0x56, 0x01]),
    ]);

    const segments = __mobileTcpInternals.splitEscposBase64ForTransport(
      source.toString("base64"),
      12 * 1024,
    );

    expect(segments.length).toBeGreaterThan(1);
    expect(Buffer.concat(segments.map((segment) => Buffer.from(segment, "base64"))))
      .toEqual(source);
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

  it("keeps a normal payment invoice in one continuous TCP session", () => {
    const header = Buffer.from([0x1b, 0x40]);
    const rasterBand = Buffer.concat([
      Buffer.from([0x1d, 0x76, 0x30, 0x00, 72, 0x00, 24, 0x00]),
      Buffer.alloc(72 * 24, 0x55),
    ]);
    const source = Buffer.concat([
      header,
      ...Array.from({ length: 75 }, () => rasterBand),
      Buffer.from([0x1d, 0x56, 0x01]),
    ]);

    expect(source.length).toBeGreaterThan(48 * 1024);
    expect(source.length).toBeLessThan(160 * 1024);
    expect(
      __mobileTcpInternals.splitEscposBase64ForTransport(
        source.toString("base64"),
      ),
    ).toHaveLength(1);
  });

  it("counts raster work and cut commands in renderer payloads", () => {
    const source = Buffer.concat([
      Buffer.from([0x1b, 0x40]),
      Buffer.from([0x1d, 0x76, 0x30, 0x00, 2, 0x00, 24, 0x00]),
      Buffer.alloc(2 * 24),
      Buffer.from([0x1d, 0x76, 0x30, 0x00, 2, 0x00, 8, 0x00]),
      Buffer.alloc(2 * 8),
      Buffer.from([0x1b, 0x4a, 16]),
      Buffer.from([0x1d, 0x56, 0x01]),
    ]);

    expect(
      __mobileTcpInternals.analyzeEscposPayload(source.toString("base64")),
    ).toEqual({
      byteLength: source.length,
      cutCommands: 1,
      fullyParsed: true,
      rasterBands: 2,
      rasterRows: 48,
    });
  });

  it("decodes native printer status bytes consistently", () => {
    expect(__mobileTcpInternals.printerStatusByte("AA==")).toBe(0);
    expect(__mobileTcpInternals.printerStatusByte("YA==")).toBe(0x60);
    expect(__mobileTcpInternals.printerStatusByte(String.fromCharCode(8))).toBe(8);
    expect(__mobileTcpInternals.printerStatusByte("")).toBeNull();
  });

  it("checks paper status directly after the ordered document bytes", async () => {
    const TcpSocket = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      read: vi.fn().mockResolvedValue({ result: "AA==" }),
      send: vi.fn().mockResolvedValue(undefined),
    };

    await expect(
      __mobileTcpInternals.checkMobilePrinterPaperStatus({
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
      timeout: 60,
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
      __mobileTcpInternals.checkMobilePrinterPaperStatus({
        TcpSocket,
        client: "printer-client",
      }),
    ).rejects.toMatchObject({
      delivery_state: "unknown",
      message: "Printer reported paper out before completion",
    });
  });
});
