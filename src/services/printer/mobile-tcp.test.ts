import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __mobileTcpInternals,
  completeMobilePrinterSelfTest,
  printMobileEscposOverTcp,
  printMobilePrinterSelfTestOverTcp,
} from "@/services/printer/mobile-tcp";

const nativeTcpMocks = vi.hoisted(() => ({
  connect: vi.fn(),
  send: vi.fn(),
  read: vi.fn(),
  disconnect: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => true },
}));
vi.mock("@deedarb/capacitor-tcp-socket", () => ({ TcpSocket: nativeTcpMocks }));

beforeEach(() => {
  vi.resetAllMocks();
  nativeTcpMocks.connect.mockResolvedValue({ client: "self-test-client" });
  nativeTcpMocks.send.mockResolvedValue(undefined);
  nativeTcpMocks.read.mockResolvedValue({ result: "AA==" });
  nativeTcpMocks.disconnect.mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllGlobals());

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
    expect(relativeFilesContaining("@/services/printer/mobile-tcp")).toEqual([
      "services/printer/agent-transport.ts",
      "services/printer/print-jobs.ts",
      "services/printer/self-test.ts",
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

  it("rejects self-test while the physical printer has an active job", async () => {
    let release: (() => void) | undefined;
    const active = __mobileTcpInternals.runOnMobileTcpQueue(
      "tcp://busy-printer:9100",
      () => new Promise<void>((resolve) => { release = resolve; }),
    );
    await expect(printMobilePrinterSelfTestOverTcp(
      "tcp://BUSY-PRINTER:09100",
    )).rejects.toMatchObject({ statusCode: 409, code: "PRINTER_BUSY", delivery_state: "not_sent" });
    expect(nativeTcpMocks.connect).not.toHaveBeenCalled();
    await Promise.resolve();
    release?.();
    await active;
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

  it("sends self-test unchanged without a status query or ticket completion callback", async () => {
    const command = Buffer.from([0x1d, 0x28, 0x41, 0x02, 0x00, 0x00, 0x02]);
    const delivered = vi.fn();
    nativeTcpMocks.connect.mockResolvedValue({ client: "self-test-client" });
    nativeTcpMocks.send.mockResolvedValue(undefined);
    nativeTcpMocks.disconnect.mockResolvedValue(undefined);

    await printMobileEscposOverTcp({
      interface_value: "tcp://192.168.1.20:9100",
      escpos_base64: command.toString("base64"),
      require_completion_confirmation: false,
      on_ticket_delivered: delivered,
    });

    expect(nativeTcpMocks.connect).toHaveBeenCalledExactlyOnceWith({
      ipAddress: "192.168.1.20", port: 9100, timeout: 10,
    });
    expect(nativeTcpMocks.send).toHaveBeenCalledExactlyOnceWith({
      client: "self-test-client",
      data: command.toString("base64"),
      encoding: "base64",
    });
    expect(nativeTcpMocks.read).not.toHaveBeenCalled();
    expect(delivered).not.toHaveBeenCalled();
    expect(nativeTcpMocks.disconnect).toHaveBeenCalledExactlyOnceWith({ client: "self-test-client" });
  });

  it("holds the native printer after self-test until the user confirms readiness", async () => {
    const target = "tcp://diagnostic-printer:09100";
    const command = Buffer.from([0x1d, 0x28, 0x41, 0x02, 0x00, 0x00, 0x02]);
    const execution = printMobilePrinterSelfTestOverTcp(target);

    expect(() => completeMobilePrinterSelfTest(target)).toThrow("Printer is busy");
    await execution;
    expect(nativeTcpMocks.send).toHaveBeenCalledExactlyOnceWith({
      client: "self-test-client", data: command.toString("base64"), encoding: "base64",
    });
    expect(nativeTcpMocks.read).not.toHaveBeenCalled();

    const normalJob = {
      interface_value: "tcp://DIAGNOSTIC-PRINTER:9100",
      escpos_base64: Buffer.from([0x1b, 0x40]).toString("base64"),
    };
    await expect(printMobileEscposOverTcp(normalJob)).rejects.toMatchObject({
      statusCode: 409, code: "PRINTER_SELF_TEST_IN_PROGRESS", delivery_state: "not_sent",
    });
    await expect(printMobilePrinterSelfTestOverTcp(target)).rejects.toMatchObject({
      code: "PRINTER_SELF_TEST_IN_PROGRESS",
    });
    expect(nativeTcpMocks.connect).toHaveBeenCalledTimes(1);

    completeMobilePrinterSelfTest(target);
    completeMobilePrinterSelfTest(target);
    await expect(printMobileEscposOverTcp(normalJob)).resolves.toBeUndefined();
    expect(nativeTcpMocks.read).toHaveBeenCalledTimes(1);
  });

  it("clears maintenance after a connection failure before any bytes are sent", async () => {
    const target = "tcp://refused-diagnostic-printer:9100";
    nativeTcpMocks.connect.mockRejectedValueOnce(new Error("Connection refused"));
    await expect(printMobilePrinterSelfTestOverTcp(target)).rejects.toMatchObject({ delivery_state: "not_sent" });
    expect(nativeTcpMocks.send).not.toHaveBeenCalled();
    await expect(printMobileEscposOverTcp({
      interface_value: target,
      escpos_base64: "G0A=",
    })).resolves.toBeUndefined();
  });

  it("keeps maintenance on an uncertain send and never retries the command", async () => {
    const target = "tcp://uncertain-diagnostic-printer:9100";
    nativeTcpMocks.send.mockRejectedValueOnce(new Error("Write failed after flush"));
    await expect(printMobilePrinterSelfTestOverTcp(target)).rejects.toMatchObject({ delivery_state: "unknown" });
    expect(nativeTcpMocks.send).toHaveBeenCalledTimes(1);
    await expect(printMobileEscposOverTcp({
      interface_value: target,
      escpos_base64: "G0A=",
    })).rejects.toMatchObject({ code: "PRINTER_SELF_TEST_IN_PROGRESS" });
    expect(nativeTcpMocks.send).toHaveBeenCalledTimes(1);
    completeMobilePrinterSelfTest(target);
  });

  it("restores the maintenance barrier after a WebView reload", async () => {
    const target = "tcp://restored-diagnostic-printer:9100";
    const stored = new Map([
      ["yummy_printer_self_test_maintenance", JSON.stringify([target])],
    ]);
    vi.stubGlobal("window", { localStorage: {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => stored.set(key, value),
      removeItem: (key: string) => stored.delete(key),
    } });

    await expect(printMobileEscposOverTcp({
      interface_value: target,
      escpos_base64: "G0A=",
    })).rejects.toMatchObject({ code: "PRINTER_SELF_TEST_IN_PROGRESS", delivery_state: "not_sent" });
    expect(nativeTcpMocks.send).not.toHaveBeenCalled();
    completeMobilePrinterSelfTest(target);
    expect(stored.has("yummy_printer_self_test_maintenance")).toBe(false);
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

  it("prepares the receipt without decoding the full payload again for disabled diagnostics", async () => {
    const source = Buffer.concat([
      Buffer.from([0x1b, 0x40, 0x1d, 0x76, 0x30, 0x00, 72, 0, 24, 0]),
      Buffer.alloc(72 * 24, 0x55),
      Buffer.from([0x1d, 0x56, 0x01]),
    ]);
    const base64 = source.toString("base64");
    const decode = vi.spyOn(globalThis, "atob");

    try {
      await __mobileTcpInternals.sendEscposOnConnectedClient({
        TcpSocket: nativeTcpMocks,
        client: "receipt-client",
        escposBase64: base64,
      });

      expect(decode.mock.calls.filter(([value]) => value === base64)).toHaveLength(1);
      expect(nativeTcpMocks.send).toHaveBeenCalledExactlyOnceWith({
        client: "receipt-client",
        data: Buffer.concat([source, Buffer.from([0x1d, 0x72, 0x01])]).toString("base64"),
        encoding: "base64",
      });
      expect(nativeTcpMocks.read).toHaveBeenCalledTimes(1);
    } finally {
      decode.mockRestore();
    }
  });

  it("decodes a long batch once and encodes only the segments sent to the printer", async () => {
    const rasterBand = (seed: number) => Buffer.concat([
      Buffer.from([0x1d, 0x76, 0x30, 0x00, 72, 0, 24, 0]),
      Buffer.alloc(72 * 24, seed),
    ]);
    const cut = Buffer.from([0x1d, 0x56, 0x01]);
    const status = Buffer.from([0x1d, 0x72, 0x01]);
    const firstTicket = Buffer.concat([
      Buffer.from([0x1b, 0x40]),
      ...Array.from({ length: 220 }, (_, index) => rasterBand(index)),
      cut,
    ]);
    const secondTicket = Buffer.concat([
      Buffer.from([0x1b, 0x40]),
      rasterBand(0x55),
      cut,
    ]);
    const epilogue = Buffer.from([0x1b, 0x61, 0x00]);
    const source = Buffer.concat([firstTicket, secondTicket, epilogue]);
    const base64 = source.toString("base64");
    const decode = vi.spyOn(globalThis, "atob");
    const encode = vi.spyOn(globalThis, "btoa");

    try {
      await __mobileTcpInternals.sendEscposOnConnectedClient({
        TcpSocket: nativeTcpMocks,
        client: "long-batch-client",
        escposBase64: base64,
      });

      expect(decode.mock.calls.map(([value]) => value).filter((value) => value !== "AA=="))
        .toEqual([base64]);
      const sent = nativeTcpMocks.send.mock.calls.map(([payload]) => payload.data as string);
      expect(encode.mock.results.map((result) => result.value)).toEqual(sent);
      expect(sent).toHaveLength(4);
      expect(sent.every((segment) => Buffer.from(segment, "base64").length <=
        __mobileTcpInternals.MOBILE_TCP_SEGMENT_MAX_BYTES)).toBe(true);
      expect(Buffer.concat(sent.map((segment) => Buffer.from(segment, "base64"))))
        .toEqual(Buffer.concat([firstTicket, status, secondTicket, status, epilogue]));
      expect(nativeTcpMocks.read).toHaveBeenCalledTimes(2);
    } finally {
      decode.mockRestore();
      encode.mockRestore();
    }
  });

  it("keeps unknown ESC/POS bytes intact and appends one completion query", async () => {
    const source = Buffer.from([0x41, 0x1d, 0x56, 0x01, 0xff]);
    const delivered = vi.fn();

    await __mobileTcpInternals.sendEscposOnConnectedClient({
      TcpSocket: nativeTcpMocks,
      client: "unknown-command-client",
      escposBase64: source.toString("base64"),
      onTicketDelivered: delivered,
    });

    expect(nativeTcpMocks.send).toHaveBeenCalledExactlyOnceWith({
      client: "unknown-command-client",
      data: Buffer.concat([source, Buffer.from([0x1d, 0x72, 0x01])]).toString("base64"),
      encoding: "base64",
    });
    expect(nativeTcpMocks.read).toHaveBeenCalledTimes(1);
    expect(delivered).toHaveBeenCalledExactlyOnceWith(1, 1);
  });

  it("retains uncertain delivery and stops the batch when a printer reply fails", async () => {
    const ticket = Buffer.from([0x1b, 0x40, 0x1d, 0x56, 0x01]);
    const delivered = vi.fn();
    nativeTcpMocks.read.mockRejectedValueOnce(new Error("Connection reset"));

    await expect(printMobileEscposOverTcp({
      interface_value: "tcp://reply-failure-printer:9100",
      escpos_base64: Buffer.concat([ticket, ticket]).toString("base64"),
      on_ticket_delivered: delivered,
    })).rejects.toMatchObject({
      delivery_state: "unknown",
      message: "Connection reset",
    });

    expect(nativeTcpMocks.send).toHaveBeenCalledExactlyOnceWith({
      client: "self-test-client",
      data: Buffer.concat([ticket, Buffer.from([0x1d, 0x72, 0x01])]).toString("base64"),
      encoding: "base64",
    });
    expect(delivered).not.toHaveBeenCalled();
    expect(nativeTcpMocks.disconnect).toHaveBeenCalledOnce();
  });

  it("waits for each printer reply before sending the next ticket", async () => {
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
    const transportEvents: string[] = [];
    const TcpSocket = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      read: vi.fn(async () => {
        transportEvents.push("read");
        return { result: "AA==" };
      }),
      send: vi.fn(async ({ data }: { data: string }) => {
        transportEvents.push("send");
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
    expect(transportEvents).toEqual(["send", "read", "send", "read"]);
    expect(progress).toEqual([1, 2]);
  });

  it("does not send the next ticket when the printer rejects the current one", async () => {
    const statusCommand = Buffer.from([0x1d, 0x72, 0x01]);
    const cut = Buffer.from([0x1d, 0x56, 0x01]);
    const firstTicket = Buffer.concat([Buffer.from([0x1b, 0x40]), cut]);
    const secondTicket = Buffer.concat([Buffer.from([0x1b, 0x40]), cut]);
    const sent: Buffer[] = [];
    const TcpSocket = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      read: vi.fn().mockResolvedValue({ result: "DA==" }),
      send: vi.fn(async ({ data }: { data: string }) => {
        sent.push(Buffer.from(data, "base64"));
      }),
    };

    await expect(
      __mobileTcpInternals.sendEscposOnConnectedClient({
        TcpSocket,
        client: "paper-out-client",
        escposBase64: Buffer.concat([firstTicket, secondTicket]).toString("base64"),
      }),
    ).rejects.toThrow("paper out");

    expect(Buffer.concat(sent)).toEqual(Buffer.concat([firstTicket, statusCommand]));
    expect(TcpSocket.send).toHaveBeenCalledTimes(1);
    expect(TcpSocket.read).toHaveBeenCalledTimes(1);
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
      read: vi.fn().mockResolvedValue({ result: "DA==" }),
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

  it("does not treat reserved GS r bits as paper out", async () => {
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
    ).resolves.toBeUndefined();
  });

  it.each([
    [[0x10, 0, 0x0c, 0], [0x12, 0x80, 0xff]],
    [[0x10], [0, 0x13], [0x0c, 0], [0x11, 0x80]],
  ])("ignores ASB frames and unrelated bytes before the ticket response: %j", async (...packets) => {
    const delivered = vi.fn();
    let respond: ((value: { result: string }) => void) | undefined;
    for (const packet of packets) {
      nativeTcpMocks.read.mockResolvedValueOnce({ result: Buffer.from(packet).toString("base64") });
    }
    nativeTcpMocks.read.mockImplementationOnce(() => new Promise<{ result: string }>((resolve) => {
      respond = resolve;
    }));

    const printing = __mobileTcpInternals.sendEscposOnConnectedClient({
      TcpSocket: nativeTcpMocks,
      client: "asb-client",
      escposBase64: "G0AdVgE=",
      onTicketDelivered: delivered,
    });
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(nativeTcpMocks.read).toHaveBeenCalledTimes(packets.length + 1);
    expect(nativeTcpMocks.send).toHaveBeenCalledTimes(1);
    expect(delivered).not.toHaveBeenCalled();
    expect(respond).toBeTypeOf("function");
    respond?.({ result: "YA==" });
    await printing;
    expect(delivered).toHaveBeenCalledExactlyOnceWith(1, 1);
  });

  it("retains a split ASB frame across ticket responses without false paper-out", async () => {
    nativeTcpMocks.read
      .mockResolvedValueOnce({ result: Buffer.from([0x60, 0x10, 0]).toString("base64") })
      .mockResolvedValueOnce({ result: Buffer.from([0x0c, 0]).toString("base64") })
      .mockResolvedValueOnce({ result: "YA==" });
    const delivered = vi.fn();
    const ticket = Buffer.from([0x1b, 0x40, 0x1d, 0x56, 1]);

    await __mobileTcpInternals.sendEscposOnConnectedClient({
      TcpSocket: nativeTcpMocks,
      client: "split-asb-client",
      escposBase64: Buffer.concat([ticket, ticket]).toString("base64"),
      onTicketDelivered: delivered,
    });

    expect(nativeTcpMocks.read).toHaveBeenCalledTimes(3);
    expect(nativeTcpMocks.send).toHaveBeenCalledTimes(2);
    expect(delivered.mock.calls).toEqual([[1, 2], [2, 2]]);
  });

  it("keeps one completion deadline while ignoring unrelated printer responses", async () => {
    vi.useFakeTimers();
    const delivered = vi.fn();
    nativeTcpMocks.read
      .mockImplementationOnce(() => new Promise<{ result: string }>((resolve) => {
        setTimeout(() => resolve({ result: "gA==" }), 25000);
      }))
      .mockImplementationOnce(() => new Promise<never>(() => {}));
    try {
      const printing = __mobileTcpInternals.sendEscposOnConnectedClient({
        TcpSocket: nativeTcpMocks,
        client: "status-deadline-client",
        escposBase64: "G0AdVgE=",
        onTicketDelivered: delivered,
      });
      const rejected = expect(printing).rejects.toMatchObject({
        delivery_state: "unknown",
        message: "Printer status response timed out",
      });
      await vi.advanceTimersByTimeAsync(25000);
      expect(nativeTcpMocks.read.mock.calls[1]?.[0]).toMatchObject({ timeout: 35 });
      await vi.advanceTimersByTimeAsync(35000);
      await rejected;
      expect(nativeTcpMocks.send).toHaveBeenCalledTimes(1);
      expect(delivered).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([false, true])("releases the printer queue after stalled cleanup, failed delivery=%s", async (failedDelivery) => {
    vi.useFakeTimers();
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const delivered = vi.fn();
    nativeTcpMocks.disconnect.mockImplementationOnce(() => new Promise<never>(() => {}));
    if (failedDelivery) nativeTcpMocks.read.mockRejectedValueOnce(new Error("Connection reset"));
    const input = {
      interface_value: `tcp://stalled-cleanup-${failedDelivery}:9100`,
      escpos_base64: "G0AdVgE=",
      on_ticket_delivered: delivered,
    };
    try {
      const first = printMobileEscposOverTcp(input);
      const firstResult = failedDelivery
        ? expect(first).rejects.toMatchObject({ delivery_state: "unknown", message: "Connection reset" })
        : expect(first).resolves.toBeUndefined();
      const second = printMobileEscposOverTcp(input);
      await vi.advanceTimersByTimeAsync(0);
      expect(nativeTcpMocks.disconnect).toHaveBeenCalledTimes(1);
      expect(nativeTcpMocks.connect).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1000);
      await firstResult;
      await second;

      expect(nativeTcpMocks.disconnect).toHaveBeenCalledTimes(2);
      expect(nativeTcpMocks.connect).toHaveBeenCalledTimes(2);
      expect(nativeTcpMocks.send).toHaveBeenCalledTimes(2);
      expect(delivered).toHaveBeenCalledTimes(failedDelivery ? 1 : 2);
      expect(warning).toHaveBeenCalledWith("[mobile-tcp] disconnect failed:", "Mobile TCP disconnect timed out");
    } finally {
      vi.useRealTimers();
      warning.mockRestore();
    }
  });
});
