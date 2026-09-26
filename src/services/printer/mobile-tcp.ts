import { Capacitor } from "@capacitor/core";
import { ServiceError } from "@/lib/api";

type TcpClient = string | number;

type TcpSocketConnectPayload = {
    ipAddress: string;
    port: number;
    timeout?: number;
};

type TcpSocketConnectResult = {
    client: TcpClient;
};

type TcpSocketSendPayload = {
    client: TcpClient;
    data: string;
    encoding?: "utf8" | "base64";
};

type TcpSocketReadPayload = {
    client: TcpClient;
    expectLen: number;
    timeout?: number;
};

type TcpSocketReadResult = {
    result?: string;
};

type TcpSocketDisconnectPayload = {
    client: TcpClient;
};

type TcpSocketApi = {
    connect: (payload: TcpSocketConnectPayload) => Promise<TcpSocketConnectResult>;
    send: (payload: TcpSocketSendPayload) => Promise<unknown>;
    read: (payload: TcpSocketReadPayload) => Promise<TcpSocketReadResult>;
    disconnect: (payload: TcpSocketDisconnectPayload) => Promise<unknown>;
};

// A rendered transport segment is at most 160 KB raw / ~214 KB base64, so this
// limit sends it through the native bridge in one write. TCP backpressure then
// controls the actual network rate without JS timer gaps between raster bands.
const MOBILE_TCP_CHUNK_SIZE = 256 * 1024;
// Failure watchdogs only: progress is driven by printer responses, never by
// these durations. Long raster receipts can legitimately take tens of seconds.
const MOBILE_TCP_SEND_TIMEOUT_MS = 60000;
const MOBILE_TCP_STATUS_TIMEOUT_MS = 60000;
// Keep each native bridge call bounded, but keep every segment of one receipt
// on the same TCP connection. Reconnecting between segments introduced visible
// pauses and could leave a long receipt half-delivered before its final cut.
const MOBILE_TCP_SEGMENT_MAX_BYTES = 160 * 1024;
const ESC_POS_PAPER_STATUS_COMMAND = new Uint8Array([0x1d, 0x72, 0x01]);
const mobileTcpQueues = new Map<string, Promise<void>>();
const MOBILE_TCP_DEBUG = process.env.NEXT_PUBLIC_MOBILE_TCP_DEBUG === "true";

function mobileTcpDebug(message: string, details?: unknown) {
    if (!MOBILE_TCP_DEBUG) return;
    if (details === undefined) console.log(message);
    else console.log(message, details);
}

function deliveryError(error: unknown, deliveryState: "not_sent" | "unknown") {
    const wrapped = error instanceof Error
        ? error
        : new Error(String(error || "Unknown printer error"));

    try {
        return Object.assign(wrapped, { delivery_state: deliveryState });
    } catch {
        return Object.assign(new Error(wrapped.message), {
            cause: wrapped,
            delivery_state: deliveryState,
        });
    }
}

function parseTcpInterface(interfaceValue?: string) {
    const value = String(interfaceValue ?? "").trim();

    const match = value.match(/^tcp:\/\/([^:/]+):(\d+)$/i);
    if (!match) {
        throw new ServiceError(
            "Mobile printer requires tcp://host:port interface_value",
            400,
        );
    }

    const host = match[1];
    const port = Number(match[2]);

    if (!host || !Number.isFinite(port) || port <= 0) {
        throw new ServiceError("Invalid TCP printer interface_value", 400);
    }

    return { host, port };
}

function normalizeBase64(value: string) {
    return String(value || "")
        .replace(/^data:[^;]+;base64,/i, "")
        .replace(/\s+/g, "")
        .trim();
}

function base64ToBytes(base64: string) {
    const binary = globalThis.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) {
        bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
}

function bytesToBase64(bytes: Uint8Array) {
    let binary = "";
    const browserChunkSize = 32 * 1024;

    for (let offset = 0; offset < bytes.length; offset += browserChunkSize) {
        binary += String.fromCharCode(
            ...bytes.subarray(offset, offset + browserChunkSize),
        );
    }

    return globalThis.btoa(binary);
}

function escposCommandLength(bytes: Uint8Array, offset: number) {
    const first = bytes[offset];
    const second = bytes[offset + 1];

    if (first === 0x1b) {
        if (second === 0x40) return 2; // ESC @
        if (second === 0x61 || second === 0x33 || second === 0x4a) return 3; // align / line spacing / dot feed
        if (second === 0x70) return 5; // cash drawer pulse
        return null;
    }

    if (first !== 0x1d) return null;
    if (second === 0x4c || second === 0x50) return 4; // left margin / motion units
    if (second === 0x72) return 3; // paper sensor status

    if (second === 0x56) {
        const mode = bytes[offset + 2];
        return mode === 0x41 || mode === 0x42 ? 4 : 3; // paper cut
    }

    if (second !== 0x76 || bytes[offset + 2] !== 0x30) return null;
    if (offset + 8 > bytes.length) return null;

    const bytesPerRow = bytes[offset + 4] | (bytes[offset + 5] << 8);
    const rows = bytes[offset + 6] | (bytes[offset + 7] << 8);
    const commandLength = 8 + (bytesPerRow * rows);

    return offset + commandLength <= bytes.length ? commandLength : null;
}

function splitEscposBase64ForTransport(
    base64: string,
    maxSegmentBytes = MOBILE_TCP_SEGMENT_MAX_BYTES,
) {
    const cleanBase64 = normalizeBase64(base64);
    if (!cleanBase64) return [];

    const bytes = base64ToBytes(cleanBase64);
    const safeMaxBytes = Math.max(8, Math.floor(maxSegmentBytes));
    if (bytes.length <= safeMaxBytes) return [cleanBase64];

    const commandLengths: number[] = [];
    for (let offset = 0; offset < bytes.length;) {
        const commandLength = escposCommandLength(bytes, offset);

        // แบ่งเฉพาะ payload ที่ renderer ของระบบสร้างและตรวจโครงสร้างได้ครบ
        // ถ้าเป็น ESC/POS รูปแบบอื่นให้คงก้อนเดิมเพื่อไม่ตัดคำสั่งโดยเดา
        if (!commandLength) return [cleanBase64];

        commandLengths.push(commandLength);
        offset += commandLength;
    }

    const segments: string[] = [];
    let segmentStart = 0;
    let segmentLength = 0;
    let cursor = 0;

    for (const commandLength of commandLengths) {
        if (segmentLength > 0 && segmentLength + commandLength > safeMaxBytes) {
            segments.push(bytesToBase64(bytes.subarray(segmentStart, cursor)));
            segmentStart = cursor;
            segmentLength = 0;
        }

        cursor += commandLength;
        segmentLength += commandLength;
    }

    if (segmentLength > 0) {
        segments.push(bytesToBase64(bytes.subarray(segmentStart, cursor)));
    }

    return segments;
}

interface EscposPayloadAnalysis {
    byteLength: number;
    cutCommands: number;
    fullyParsed: boolean;
    rasterBands: number;
    rasterRows: number;
}

function analyzeEscposPayload(base64: string): EscposPayloadAnalysis {
    const cleanBase64 = normalizeBase64(base64);
    if (!cleanBase64) {
        return {
            byteLength: 0,
            cutCommands: 0,
            fullyParsed: true,
            rasterBands: 0,
            rasterRows: 0,
        };
    }

    const bytes = base64ToBytes(cleanBase64);
    let cutCommands = 0;
    let rasterBands = 0;
    let rasterRows = 0;

    for (let offset = 0; offset < bytes.length;) {
        const commandLength = escposCommandLength(bytes, offset);
        if (!commandLength) {
            return {
                byteLength: bytes.length,
                cutCommands,
                fullyParsed: false,
                rasterBands,
                rasterRows,
            };
        }

        if (
            bytes[offset] === 0x1d &&
            bytes[offset + 1] === 0x76 &&
            bytes[offset + 2] === 0x30
        ) {
            rasterBands += 1;
            rasterRows += bytes[offset + 6] | (bytes[offset + 7] << 8);
        } else if (bytes[offset] === 0x1b && bytes[offset + 1] === 0x4a) {
            // ESC J advances by vertical motion units. Count it as physical
            // work for transport diagnostics on sparse bills.
            rasterRows += bytes[offset + 2];
        } else if (bytes[offset] === 0x1d && bytes[offset + 1] === 0x56) {
            cutCommands += 1;
        }

        offset += commandLength;
    }

    return {
        byteLength: bytes.length,
        cutCommands,
        fullyParsed: true,
        rasterBands,
        rasterRows,
    };
}

function addCompletionQueries(base64: string) {
    const cleanBase64 = normalizeBase64(base64);
    const bytes = base64ToBytes(cleanBase64);
    const parts: Uint8Array[] = [];
    let acknowledgementTotal = 0;

    for (let offset = 0; offset < bytes.length;) {
        const commandLength = escposCommandLength(bytes, offset);
        if (!commandLength) {
            const fallback = new Uint8Array(
                bytes.length + ESC_POS_PAPER_STATUS_COMMAND.length,
            );
            fallback.set(bytes);
            fallback.set(ESC_POS_PAPER_STATUS_COMMAND, bytes.length);
            return {
                base64: bytesToBase64(fallback),
                acknowledgementTotal: 1,
            };
        }

        parts.push(bytes.subarray(offset, offset + commandLength));
        if (bytes[offset] === 0x1d && bytes[offset + 1] === 0x56) {
            parts.push(ESC_POS_PAPER_STATUS_COMMAND);
            acknowledgementTotal += 1;
        }
        offset += commandLength;
    }

    if (acknowledgementTotal === 0) {
        parts.push(ESC_POS_PAPER_STATUS_COMMAND);
        acknowledgementTotal = 1;
    }

    const byteLength = parts.reduce((sum, part) => sum + part.length, 0);
    const result = new Uint8Array(byteLength);
    let cursor = 0;
    for (const part of parts) {
        result.set(part, cursor);
        cursor += part.length;
    }

    return {
        base64: bytesToBase64(result),
        acknowledgementTotal,
    };
}

function runOnMobileTcpQueue<T>(queueKey: string, task: () => Promise<T>) {
    // หนึ่งเครื่องพิมพ์ต้องรับงานเรียงลำดับเพื่อไม่ให้ byte ของคนละใบสลับกัน
    // ส่วนคนละเครื่องทำพร้อมกันได้ เพราะ native plugin แยก socket/output stream
    // ตาม client แล้ว (ดู patch-package ของ capacitor-tcp-socket)
    const key = String(queueKey || "mobile-printer").trim().toLowerCase();
    const previous = mobileTcpQueues.get(key) ?? Promise.resolve();
    const execution = previous.then(task, task);
    const tail = execution.then(
        () => undefined,
        () => undefined,
    );
    mobileTcpQueues.set(key, tail);
    void tail.finally(() => {
        if (mobileTcpQueues.get(key) === tail) mobileTcpQueues.delete(key);
    });
    return execution;
}

function mobileTcpSendProfile() {
    return {
        chunkSize: MOBILE_TCP_CHUNK_SIZE,
        profile: "tcp_backpressure" as const,
    };
}

async function withSendTimeout<T>(operation: Promise<T>) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([
            operation,
            new Promise<never>((_, reject) => {
                timer = setTimeout(
                    () => reject(new Error("Mobile TCP send timed out")),
                    MOBILE_TCP_SEND_TIMEOUT_MS,
                );
            }),
        ]);
    } finally {
        if (timer) clearTimeout(timer);
    }
}

async function withPrinterStatusTimeout<T>(operation: Promise<T>) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([
            operation,
            new Promise<never>((_, reject) => {
                timer = setTimeout(
                    () => reject(new Error("Printer status response timed out")),
                    MOBILE_TCP_STATUS_TIMEOUT_MS,
                );
            }),
        ]);
    } finally {
        if (timer) clearTimeout(timer);
    }
}

function printerStatusByte(result?: string) {
    const value = typeof result === "string" ? result : "";
    if (!value) return null;

    // Android and iOS return the native read bytes as base64 after the plugin
    // patch. Keep the raw-byte fallback for Android builds installed before it.
    if (/^[A-Za-z0-9+/]+={0,2}$/.test(value) && value.length % 4 === 0) {
        try {
            const decoded = base64ToBytes(value);
            if (decoded.length === 1) return decoded[0];
        } catch {
            // Fall through to the legacy raw string result.
        }
    }

    return value.charCodeAt(0) & 0xff;
}

async function checkMobilePrinterPaperStatus({
    TcpSocket,
    client,
}: {
    TcpSocket: TcpSocketApi;
    client: TcpClient;
}) {
    try {
        await withSendTimeout(
            TcpSocket.send({
                client,
                data: bytesToBase64(ESC_POS_PAPER_STATUS_COMMAND),
                encoding: "base64",
            }),
        );

        const response = await withPrinterStatusTimeout(
            TcpSocket.read({
                client,
                expectLen: 1,
                timeout: Math.ceil(MOBILE_TCP_STATUS_TIMEOUT_MS / 1000),
            }),
        );
        const status = printerStatusByte(response.result);

        if (status === null) {
            throw new Error("Printer returned an empty completion status");
        }

        // GS r 1 reports paper-end on bits 2 and 3. Bits 5 and 6 are
        // reserved and may be set by compatible printers without meaning
        // paper-out (0x60 is the mask for the different DLE EOT 4 command).
        if ((status & 0x0c) === 0x0c) {
            throw new Error("Printer reported paper out before completion");
        }

        mobileTcpDebug("[mobile-tcp] printer paper status received", { status });
    } catch (error) {
        throw deliveryError(error, "unknown");
    }
}

async function readMobilePrinterPaperStatus({
    TcpSocket,
    client,
}: {
    TcpSocket: TcpSocketApi;
    client: TcpClient;
}) {
    try {
        const response = await withPrinterStatusTimeout(
            TcpSocket.read({
                client,
                expectLen: 1,
                timeout: Math.ceil(MOBILE_TCP_STATUS_TIMEOUT_MS / 1000),
            }),
        );
        const status = printerStatusByte(response.result);

        if (status === null) {
            throw new Error("Printer returned an empty completion status");
        }
        if ((status & 0x0c) === 0x0c) {
            throw new Error("Printer reported paper out before completion");
        }

        mobileTcpDebug("[mobile-tcp] printer paper status received", { status });
    } catch (error) {
        throw deliveryError(error, "unknown");
    }
}

async function sendBase64InChunks({
    TcpSocket,
    client,
    base64,
    chunkSize = 4096,
}: {
    TcpSocket: TcpSocketApi;
    client: TcpClient;
    base64: string;
    chunkSize?: number;
}) {
    const cleanBase64 = normalizeBase64(base64);

    if (!cleanBase64) {
        throw new ServiceError("Missing ESC/POS base64 data", 400);
    }

    const safeChunkSize = Math.max(4, chunkSize - (chunkSize % 4));
    const totalChunks = Math.ceil(cleanBase64.length / safeChunkSize);

    mobileTcpDebug("[mobile-tcp] chunk send config", {
        base64Length: cleanBase64.length,
        safeChunkSize,
        totalChunks,
        byteEstimate: Math.floor((cleanBase64.length * 3) / 4),
    });

    for (let i = 0; i < cleanBase64.length; i += safeChunkSize) {
        const chunkIndex = Math.floor(i / safeChunkSize) + 1;
        const chunk = cleanBase64.slice(i, i + safeChunkSize);

        // การ log ทุก chunk ทำให้ WebView ของ iOS/Android ช้าหนักเมื่อใบยาว
        // เก็บเฉพาะ progress เป็นช่วง ๆ โดยไม่เปลี่ยนข้อมูลที่ส่งเข้า printer
        if (chunkIndex === 1 || chunkIndex === totalChunks || chunkIndex % 25 === 0) {
            mobileTcpDebug("[mobile-tcp] send progress", {
                chunkIndex,
                totalChunks,
                chunkLength: chunk.length,
            });
        }

        await withSendTimeout(
            TcpSocket.send({
                client,
                data: chunk,
                encoding: "base64",
            }),
        );

    }

    mobileTcpDebug("[mobile-tcp] all chunks sent", {
        totalChunks,
    });
}

async function sendEscposOnConnectedClient({
    TcpSocket,
    client,
    escposBase64,
    onTicketDelivered,
}: {
    TcpSocket: TcpSocketApi;
    client: TcpClient;
    escposBase64: string;
    onTicketDelivered?: (completed: number, total: number) => void;
}) {
    const cleanBase64 = normalizeBase64(escposBase64);
    const completionPlan = addCompletionQueries(cleanBase64);
    const segments = splitEscposBase64ForTransport(completionPlan.base64);
    const analysis = analyzeEscposPayload(cleanBase64);
    const sendProfile = mobileTcpSendProfile();

    mobileTcpDebug("[mobile-tcp] transport plan", {
        segments: segments.length,
        byteEstimate: analysis.byteLength,
        cutCommands: analysis.cutCommands,
        profile: sendProfile.profile,
    });

    for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex++) {
        const segment = segments[segmentIndex];
        mobileTcpDebug("[mobile-tcp] send segment", {
            segment: segmentIndex + 1,
            segments: segments.length,
            byteEstimate: Math.floor((segment.length * 3) / 4),
        });

        // Each send resolves only after the patched native plugin has written
        // and flushed this complete segment. Awaiting it preserves every byte
        // in order without timer gaps or overlapping native writes.
        await sendBase64InChunks({
            TcpSocket,
            client,
            base64: segment,
            ...sendProfile,
        });
    }

    // Every GS r 1 sits directly after a cut in the same ordered byte stream.
    // Read only after all writes have completed: the iOS socket plugin returns
    // an empty result when read starts before the first status query is sent.
    // TCP retains the ordered replies, so this keeps paper continuous while
    // still acknowledging every completed ticket in cut order.
    mobileTcpDebug("[mobile-tcp] document flushed; confirming completion", {
        cutCommands: analysis.cutCommands,
        rasterBands: analysis.rasterBands,
        rasterRows: analysis.rasterRows,
        segments: segments.length,
    });
    for (
        let completed = 1;
        completed <= completionPlan.acknowledgementTotal;
        completed += 1
    ) {
        await readMobilePrinterPaperStatus({ TcpSocket, client });
        onTicketDelivered?.(completed, completionPlan.acknowledgementTotal);
    }
}

async function printMobileEscposOverTcpNow({
    interface_value,
    escpos_base64,
    on_ticket_delivered,
}: {
    interface_value?: string;
    escpos_base64: string;
    require_completion_confirmation?: boolean;
    on_ticket_delivered?: (completed: number, total: number) => void;
}) {
    const cleanBase64 = normalizeBase64(escpos_base64);

    mobileTcpDebug("[mobile-tcp] start", {
        interface_value,
        base64Length: cleanBase64.length,
    });

    if (!Capacitor.isNativePlatform()) {
        console.error("[mobile-tcp] not native platform");
        throw new ServiceError(
            "Mobile TCP printing works only inside the Capacitor app.",
            501,
        );
    }

    if (!cleanBase64) {
        throw new ServiceError("Missing ESC/POS base64 data", 400);
    }

    const { host, port } = parseTcpInterface(interface_value);

    mobileTcpDebug("[mobile-tcp] parsed tcp", { host, port });

    const mod = await import("@deedarb/capacitor-tcp-socket");

    mobileTcpDebug("[mobile-tcp] plugin loaded", Object.keys(mod));

    const TcpSocket = mod.TcpSocket as unknown as TcpSocketApi;

    mobileTcpDebug("[mobile-tcp] connect start");

    let connected: TcpSocketConnectResult;
    try {
        connected = await TcpSocket.connect({
            ipAddress: host,
            port,
            timeout: 10,
        });
    } catch (error) {
        throw deliveryError(error, "not_sent");
    }

    mobileTcpDebug("[mobile-tcp] connect success", connected);
    const client = connected.client;

    try {
        await sendEscposOnConnectedClient({
            TcpSocket,
            client,
            escposBase64: cleanBase64,
            onTicketDelivered: on_ticket_delivered,
        });
        mobileTcpDebug("[mobile-tcp] send success");
    } catch (error) {
        console.warn(
            "[mobile-tcp] send failed:",
            error instanceof Error ? error.message : String(error),
        );
        // Never retry after the first write: the printer may already have a
        // prefix, and replaying the receipt would duplicate printed content.
        throw deliveryError(error, "unknown");
    } finally {
        mobileTcpDebug("[mobile-tcp] disconnect start");
        await TcpSocket.disconnect({ client }).catch((error: unknown) => {
            console.warn(
                "[mobile-tcp] disconnect failed:",
                error instanceof Error ? error.message : String(error),
            );
        });
        mobileTcpDebug("[mobile-tcp] disconnect done");
    }
}

export function printMobileEscposOverTcp(input: {
    interface_value?: string;
    escpos_base64: string;
    require_completion_confirmation?: boolean;
    on_ticket_delivered?: (completed: number, total: number) => void;
}) {
    return runOnMobileTcpQueue(
        String(input.interface_value || "mobile-printer"),
        () => printMobileEscposOverTcpNow(input),
    );
}

export const __mobileTcpInternals = {
    MOBILE_TCP_SEGMENT_MAX_BYTES,
    addCompletionQueries,
    analyzeEscposPayload,
    checkMobilePrinterPaperStatus,
    mobileTcpSendProfile,
    printerStatusByte,
    runOnMobileTcpQueue,
    sendBase64InChunks,
    sendEscposOnConnectedClient,
    splitEscposBase64ForTransport,
};
