import { Capacitor } from "@capacitor/core";
import { ServiceError } from "@/lib/api";
import { getPrinterDeliveryState } from "@/services/printer/helpers";
import { printerSelfTestCommandBase64 } from "@/services/printer/self-test-profile";
import type { PrinterSelfTestCommandProfile } from "@/services/printer/types";

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
// A confirmed ticket must not keep the UI or printer queue waiting for a
// stalled native cleanup callback. The close is still requested every time.
const MOBILE_TCP_DISCONNECT_TIMEOUT_MS = 1000;
// Keep each native bridge call bounded, but keep every segment of one receipt
// on the same TCP connection. Reconnecting between segments introduced visible
// pauses and could leave a long receipt half-delivered before its final cut.
const MOBILE_TCP_SEGMENT_MAX_BYTES = 160 * 1024;
const ESC_POS_PAPER_STATUS_COMMAND = new Uint8Array([0x1d, 0x72, 0x01]);
const mobileTcpQueues = new Map<string, Promise<void>>();
const mobileTcpSelfTests = new Set<string>();
const mobileTcpMaintenance = new Set<string>();
const MOBILE_TCP_MAINTENANCE_KEY = "yummy_printer_self_test_maintenance";
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

function splitEscposBytesForTransport(
    bytes: Uint8Array,
    maxSegmentBytes = MOBILE_TCP_SEGMENT_MAX_BYTES,
) {
    const safeMaxBytes = Math.max(8, Math.floor(maxSegmentBytes));
    if (bytes.length <= safeMaxBytes) return [bytes];

    const commandLengths: number[] = [];
    for (let offset = 0; offset < bytes.length;) {
        const commandLength = escposCommandLength(bytes, offset);

        // แบ่งเฉพาะ payload ที่ renderer ของระบบสร้างและตรวจโครงสร้างได้ครบ
        // ถ้าเป็น ESC/POS รูปแบบอื่นให้คงก้อนเดิมเพื่อไม่ตัดคำสั่งโดยเดา
        if (!commandLength) return [bytes];

        commandLengths.push(commandLength);
        offset += commandLength;
    }

    const segments: Uint8Array[] = [];
    let segmentStart = 0;
    let segmentLength = 0;
    let cursor = 0;

    for (const commandLength of commandLengths) {
        if (segmentLength > 0 && segmentLength + commandLength > safeMaxBytes) {
            segments.push(bytes.subarray(segmentStart, cursor));
            segmentStart = cursor;
            segmentLength = 0;
        }

        cursor += commandLength;
        segmentLength += commandLength;
    }

    if (segmentLength > 0) {
        segments.push(bytes.subarray(segmentStart, cursor));
    }

    return segments;
}

function splitEscposBase64ForTransport(
    base64: string,
    maxSegmentBytes = MOBILE_TCP_SEGMENT_MAX_BYTES,
) {
    const cleanBase64 = normalizeBase64(base64);
    if (!cleanBase64) return [];

    const segments = splitEscposBytesForTransport(
        base64ToBytes(cleanBase64),
        maxSegmentBytes,
    );

    return segments.length === 1 ? [cleanBase64] : segments.map(bytesToBase64);
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

function prepareEscposCompletion(base64: string) {
    const cleanBase64 = normalizeBase64(base64);
    const bytes = base64ToBytes(cleanBase64);
    const parts: Uint8Array[] = [];
    const acknowledgementEnds: number[] = [];
    let acknowledgementTotal = 0;
    let byteLength = 0;

    for (let offset = 0; offset < bytes.length;) {
        const commandLength = escposCommandLength(bytes, offset);
        if (!commandLength) {
            const fallback = new Uint8Array(
                bytes.length + ESC_POS_PAPER_STATUS_COMMAND.length,
            );
            fallback.set(bytes);
            fallback.set(ESC_POS_PAPER_STATUS_COMMAND, bytes.length);
            return {
                bytes: fallback,
                acknowledgementTotal: 1,
                acknowledgementEnds: [fallback.length],
            };
        }

        const command = bytes.subarray(offset, offset + commandLength);
        parts.push(command);
        byteLength += command.length;
        if (bytes[offset] === 0x1d && bytes[offset + 1] === 0x56) {
            parts.push(ESC_POS_PAPER_STATUS_COMMAND);
            byteLength += ESC_POS_PAPER_STATUS_COMMAND.length;
            acknowledgementTotal += 1;
            acknowledgementEnds.push(byteLength);
        }
        offset += commandLength;
    }

    if (acknowledgementTotal === 0) {
        parts.push(ESC_POS_PAPER_STATUS_COMMAND);
        byteLength += ESC_POS_PAPER_STATUS_COMMAND.length;
        acknowledgementTotal = 1;
        acknowledgementEnds.push(byteLength);
    } else {
        // Keep any renderer epilogue after the final cut in the same final
        // delivery group so the byte stream stays exactly as generated.
        acknowledgementEnds[acknowledgementEnds.length - 1] = byteLength;
    }

    const result = new Uint8Array(byteLength);
    let cursor = 0;
    for (const part of parts) {
        result.set(part, cursor);
        cursor += part.length;
    }

    return {
        bytes: result,
        acknowledgementTotal,
        acknowledgementEnds,
    };
}

function completionGroupBytes(plan: ReturnType<typeof prepareEscposCompletion>) {
    let groupStart = 0;
    return plan.acknowledgementEnds.map((groupEnd) => {
        const group = plan.bytes.subarray(groupStart, groupEnd);
        groupStart = groupEnd;
        return group;
    });
}

function addCompletionQueries(base64: string) {
    const plan = prepareEscposCompletion(base64);
    return {
        base64: bytesToBase64(plan.bytes),
        acknowledgementTotal: plan.acknowledgementTotal,
        acknowledgementGroups: completionGroupBytes(plan).map(bytesToBase64),
    };
}

function mobilePrinterQueueKey(queueKey: string) {
    try {
        const { host, port } = parseTcpInterface(queueKey);
        return `tcp://${host.toLowerCase().replace(/\.$/, "")}:${port}`;
    } catch {
        return String(queueKey || "mobile-printer").trim().toLowerCase();
    }
}

function restoreMobilePrinterMaintenance() {
    try {
        if (typeof window === "undefined") return;
        const saved: unknown = JSON.parse(window.localStorage.getItem(MOBILE_TCP_MAINTENANCE_KEY) || "[]");
        if (Array.isArray(saved)) {
            for (const value of saved) {
                if (typeof value === "string") mobileTcpMaintenance.add(value);
            }
        }
    } catch {
        // Keep the in-memory barrier when WebView storage is unavailable.
    }
}

function persistMobilePrinterMaintenance() {
    try {
        if (typeof window === "undefined") return;
        if (mobileTcpMaintenance.size) {
            window.localStorage.setItem(MOBILE_TCP_MAINTENANCE_KEY, JSON.stringify([...mobileTcpMaintenance]));
        } else {
            window.localStorage.removeItem(MOBILE_TCP_MAINTENANCE_KEY);
        }
    } catch {
        // Sending can continue with the in-memory barrier for this session.
    }
}

function printerBusyError(selfTestInProgress = false) {
    return Object.assign(new ServiceError(
        selfTestInProgress
            ? "Printer self-test is in progress. Confirm the printer is ready before printing."
            : "Printer is busy. Wait until printing has finished before running self-test.",
        409,
    ), {
        code: selfTestInProgress ? "PRINTER_SELF_TEST_IN_PROGRESS" : "PRINTER_BUSY",
        delivery_state: "not_sent" as const,
    });
}

function runOnMobileTcpQueue<T>(
    queueKey: string,
    task: () => Promise<T>,
    rejectIfBusy = false,
    allowDuringSelfTest = false,
) {
    // หนึ่งเครื่องพิมพ์ต้องรับงานเรียงลำดับเพื่อไม่ให้ byte ของคนละใบสลับกัน
    // ส่วนคนละเครื่องทำพร้อมกันได้ เพราะ native plugin แยก socket/output stream
    // ตาม client แล้ว (ดู patch-package ของ capacitor-tcp-socket)
    const key = mobilePrinterQueueKey(queueKey);
    restoreMobilePrinterMaintenance();
    if (!allowDuringSelfTest && mobileTcpMaintenance.has(key)) {
        return Promise.reject(printerBusyError(true));
    }
    if (rejectIfBusy && mobileTcpQueues.has(key)) {
        return Promise.reject(printerBusyError());
    }
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

async function withPrinterStatusTimeout<T>(
    operation: Promise<T>,
    timeoutMs = MOBILE_TCP_STATUS_TIMEOUT_MS,
) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([
            operation,
            new Promise<never>((_, reject) => {
                timer = setTimeout(
                    () => reject(new Error("Printer status response timed out")),
                    timeoutMs,
                );
            }),
        ]);
    } finally {
        if (timer) clearTimeout(timer);
    }
}

function printerStatusBytes(result?: string) {
    const value = typeof result === "string" ? result : "";
    if (!value) return new Uint8Array();

    // Android and iOS return the native read bytes as base64 after the plugin
    // patch. Keep the raw-byte fallback for Android builds installed before it.
    if (/^[A-Za-z0-9+/]+={0,2}$/.test(value) && value.length % 4 === 0) {
        try {
            return base64ToBytes(value);
        } catch {
            // Fall through to the legacy raw string result.
        }
    }

    return Uint8Array.from(value, (character) => character.charCodeAt(0) & 0xff);
}

function printerStatusByte(result?: string) {
    return printerStatusBytes(result)[0] ?? null;
}

interface PrinterStatusStream {
    asbBytesRemaining: number;
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

        await readMobilePrinterPaperStatus({ TcpSocket, client });
    } catch (error) {
        throw deliveryError(error, "unknown");
    }
}

async function readMobilePrinterPaperStatus({
    TcpSocket,
    client,
    stream = { asbBytesRemaining: 0 },
}: {
    TcpSocket: TcpSocketApi;
    client: TcpClient;
    stream?: PrinterStatusStream;
}) {
    try {
        const deadline = Date.now() + MOBILE_TCP_STATUS_TIMEOUT_MS;
        while (true) {
            const remainingMs = deadline - Date.now();
            if (remainingMs <= 0) throw new Error("Printer status response timed out");
            const response = await withPrinterStatusTimeout(
                TcpSocket.read({
                    client,
                    expectLen: 1,
                    timeout: Math.ceil(remainingMs / 1000),
                }),
                remainingMs,
            );
            const bytes = printerStatusBytes(response.result);
            if (!bytes.length) {
                throw new Error("Printer returned an empty completion status");
            }

            let paperStatus: number | undefined;
            for (const status of bytes) {
                // ASB is a four-byte unsolicited frame, not the response to
                // this ticket. Its paper/error bytes can otherwise falsely
                // complete a ticket or stop the rest of a batch.
                // https://download4.epson.biz/sec_pubs/pos/reference_en/escpos/gs_la.html
                if (stream.asbBytesRemaining) {
                    if (status !== 0x11 && status !== 0x13) stream.asbBytesRemaining -= 1;
                    continue;
                }
                if ((status & 0x93) === 0x10) {
                    stream.asbBytesRemaining = 3;
                    continue;
                }
                // GS r fixes bits 4/7 at zero. Reserved bits 5/6 remain
                // allowed, including compatible printers returning 0x60.
                // https://download4.epson.biz/sec_pubs/pos/reference_en/escpos/gs_lr.html
                if ((status & 0x90) !== 0 || paperStatus !== undefined) continue;
                if ((status & 0x0c) === 0x0c) {
                    throw new Error("Printer reported paper out before completion");
                }
                paperStatus = status;
            }

            if (paperStatus !== undefined) {
                mobileTcpDebug("[mobile-tcp] printer paper status received", { status: paperStatus });
                return;
            }
        }
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
    requireCompletionConfirmation = true,
}: {
    TcpSocket: TcpSocketApi;
    client: TcpClient;
    escposBase64: string;
    onTicketDelivered?: (completed: number, total: number) => void;
    requireCompletionConfirmation?: boolean;
}) {
    const cleanBase64 = normalizeBase64(escposBase64);
    if (!requireCompletionConfirmation) {
        // Self-test resets the printer in software, so appending GS r or
        // awaiting a status reply can turn a successful send into an error.
        await sendBase64InChunks({
            TcpSocket,
            client,
            base64: cleanBase64,
            ...mobileTcpSendProfile(),
        });
        return;
    }
    const completionPlan = prepareEscposCompletion(cleanBase64);
    const sendProfile = mobileTcpSendProfile();
    // Keep acknowledged groups as byte views until their final transport
    // segments are ready. Encoding a second full batch and decoding every
    // group again delays the first write on a mobile WebView.
    const deliveryGroups = completionGroupBytes(completionPlan).map((group) =>
        splitEscposBytesForTransport(group).map(bytesToBase64)
    );
    const segmentTotal = deliveryGroups.reduce(
        (total, segments) => total + segments.length,
        0,
    );

    // Diagnostics decode and scan the complete raster. Keep that work out of
    // normal mobile printing, especially for long multi-ticket batches.
    if (MOBILE_TCP_DEBUG) {
        const analysis = analyzeEscposPayload(cleanBase64);
        mobileTcpDebug("[mobile-tcp] transport plan", {
            segments: segmentTotal,
            byteEstimate: analysis.byteLength,
            cutCommands: analysis.cutCommands,
            profile: sendProfile.profile,
        });
    }

    let sentSegments = 0;
    const statusStream: PrinterStatusStream = { asbBytesRemaining: 0 };
    for (let groupIndex = 0; groupIndex < deliveryGroups.length; groupIndex++) {
        const segments = deliveryGroups[groupIndex];
        for (const segment of segments) {
            sentSegments += 1;
            mobileTcpDebug("[mobile-tcp] send segment", {
                segment: sentSegments,
                segments: segmentTotal,
                ticket: groupIndex + 1,
                tickets: completionPlan.acknowledgementTotal,
                byteEstimate: Math.floor((segment.length * 3) / 4),
            });

            // Await the native flush for every complete renderer segment. No
            // timer gap or overlapping write is used to control the order.
            await sendBase64InChunks({
                TcpSocket,
                client,
                base64: segment,
                ...sendProfile,
            });
        }

        // The GS r 1 query is the final command in this delivery group. Wait
        // for the printer response before releasing the next ticket so a slow
        // printer cannot lose the tail of a large mobile batch.
        await readMobilePrinterPaperStatus({ TcpSocket, client, stream: statusStream });
        onTicketDelivered?.(groupIndex + 1, completionPlan.acknowledgementTotal);
    }
}

async function printMobileEscposOverTcpNow({
    interface_value,
    escpos_base64,
    on_ticket_delivered,
    require_completion_confirmation = true,
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
            requireCompletionConfirmation: require_completion_confirmation,
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
        let disconnectTimer: ReturnType<typeof setTimeout> | undefined;
        await Promise.race([
            Promise.resolve().then(() => TcpSocket.disconnect({ client })),
            new Promise<never>((_, reject) => {
                disconnectTimer = setTimeout(
                    () => reject(new Error("Mobile TCP disconnect timed out")),
                    MOBILE_TCP_DISCONNECT_TIMEOUT_MS,
                );
            }),
        ]).catch((error: unknown) => {
            console.warn(
                "[mobile-tcp] disconnect failed:",
                error instanceof Error ? error.message : String(error),
            );
        }).finally(() => {
            if (disconnectTimer) clearTimeout(disconnectTimer);
        });
        mobileTcpDebug("[mobile-tcp] disconnect done");
    }
}

export function printMobileEscposOverTcp(input: {
    interface_value?: string;
    escpos_base64: string;
    require_completion_confirmation?: boolean;
    reject_if_busy?: boolean;
    on_ticket_delivered?: (completed: number, total: number) => void;
}) {
    return runOnMobileTcpQueue(
        String(input.interface_value || "mobile-printer"),
        () => printMobileEscposOverTcpNow(input),
        input.reject_if_busy,
    );
}

export function printMobilePrinterSelfTestOverTcp(
    interfaceValue: string,
    commandProfile?: PrinterSelfTestCommandProfile,
) {
    // Validate before reserving the physical queue or persisting maintenance.
    let commandBase64: string;
    try {
        commandBase64 = printerSelfTestCommandBase64(commandProfile);
    } catch (error) {
        return Promise.reject(error);
    }
    const key = mobilePrinterQueueKey(interfaceValue);
    restoreMobilePrinterMaintenance();
    if (mobileTcpMaintenance.has(key)) return Promise.reject(printerBusyError(true));
    if (mobileTcpQueues.has(key)) return Promise.reject(printerBusyError());

    mobileTcpMaintenance.add(key);
    mobileTcpSelfTests.add(key);
    persistMobilePrinterMaintenance();
    const execution = runOnMobileTcpQueue(
        key,
        () => printMobileEscposOverTcpNow({
            interface_value: interfaceValue,
            escpos_base64: commandBase64,
            require_completion_confirmation: false,
        }),
        true,
        true,
    );
    void execution.then(
        () => { mobileTcpSelfTests.delete(key); },
        (error: unknown) => {
            mobileTcpSelfTests.delete(key);
            if (getPrinterDeliveryState(error) === "not_sent") {
                mobileTcpMaintenance.delete(key);
                persistMobilePrinterMaintenance();
            }
        },
    );
    return execution;
}

export function completeMobilePrinterSelfTest(interfaceValue: string) {
    const key = mobilePrinterQueueKey(interfaceValue);
    restoreMobilePrinterMaintenance();
    if (mobileTcpSelfTests.has(key)) throw printerBusyError();
    mobileTcpMaintenance.delete(key);
    persistMobilePrinterMaintenance();
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
