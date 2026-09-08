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

// 1,364 base64 characters decode to 1,023 bytes. Keeping the wire rate near
// 15 KB/s prevents small Wi-Fi print servers from acknowledging data faster
// than the printer can remove it from their limited input buffer.
const MOBILE_TCP_CHUNK_SIZE = 1364;
const MOBILE_TCP_CHUNK_DELAY_MS = 60;
const MOBILE_TCP_SEND_TIMEOUT_MS = 15000;
const MOBILE_TCP_STATUS_TIMEOUT_MS = 4000;
const MOBILE_TCP_COOLDOWN_EVERY_BYTES = 16 * 1024;
const MOBILE_TCP_COOLDOWN_MS = 180;
// เครื่องพิมพ์ราคาประหยัดบางรุ่นปิด TCP session ที่รับ raster ต่อเนื่องนาน
// ประมาณ 10 วินาที แบ่งก้อนให้เวลาส่งและระบาย raster ของแต่ละ session อยู่
// ต่ำกว่าขีดจำกัด โดยแบ่งเฉพาะที่ขอบคำสั่ง GS v 0 เท่านั้น
const MOBILE_TCP_SEGMENT_MAX_BYTES = 48 * 1024;
const MOBILE_TCP_RECONNECT_DELAY_MS = 300;
// Use a deliberately conservative 31 mm/s (250 rows/s at 203 dpi) when
// estimating how long raster output may still be moving. The send promise and
// GS r reply only prove that the socket/adapter accepted bytes; neither proves
// the thermal head or cutter has physically finished.
const MOBILE_TCP_RASTER_ROWS_PER_SECOND = 250;
const MOBILE_TCP_MIN_DRAIN_MS = 1500;
const MOBILE_TCP_MAX_DRAIN_MS = 6000;
const MOBILE_TCP_DRAIN_SETTLE_MS = 400;
const MOBILE_TCP_CUT_SETTLE_MS = 1500;
const ESC_POS_PAPER_STATUS_COMMAND = new Uint8Array([0x1d, 0x72, 0x01]);
const mobileTcpQueues = new Map<string, Promise<void>>();

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
        if (second === 0x61 || second === 0x33) return 3; // align / line spacing
        if (second === 0x70) return 5; // cash drawer pulse
        return null;
    }

    if (first !== 0x1d) return null;
    if (second === 0x4c) return 4; // left margin

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

function splitTrailingEscposCutCommand(base64: string) {
    const cleanBase64 = normalizeBase64(base64);
    if (!cleanBase64) return { bodyBase64: "", cutBase64: "" };

    const bytes = base64ToBytes(cleanBase64);
    const threeByteCut =
        bytes.length >= 3 &&
        bytes[bytes.length - 3] === 0x1d &&
        bytes[bytes.length - 2] === 0x56 &&
        (bytes[bytes.length - 1] === 0x00 || bytes[bytes.length - 1] === 0x01);
    const fourByteCut =
        bytes.length >= 4 &&
        bytes[bytes.length - 4] === 0x1d &&
        bytes[bytes.length - 3] === 0x56 &&
        (bytes[bytes.length - 2] === 0x41 || bytes[bytes.length - 2] === 0x42);
    const cutLength = fourByteCut ? 4 : threeByteCut ? 3 : 0;

    if (!cutLength) return { bodyBase64: cleanBase64, cutBase64: "" };

    return {
        bodyBase64: bytesToBase64(bytes.subarray(0, bytes.length - cutLength)),
        cutBase64: bytesToBase64(bytes.subarray(bytes.length - cutLength)),
    };
}

async function sleep(ms: number) {
    await new Promise((resolve) => setTimeout(resolve, ms));
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

function mobileTcpRasterDrainMs(base64: string) {
    const analysis = analyzeEscposPayload(base64);
    const workMs = analysis.fullyParsed && analysis.rasterRows > 0
        ? Math.ceil(
            (analysis.rasterRows / MOBILE_TCP_RASTER_ROWS_PER_SECOND) * 1000,
        )
        : Math.ceil(
            (analysis.byteLength / (MOBILE_TCP_CHUNK_SIZE * 16)) * 1000,
        );

    return Math.max(
        MOBILE_TCP_MIN_DRAIN_MS,
        Math.min(MOBILE_TCP_MAX_DRAIN_MS, workMs + MOBILE_TCP_DRAIN_SETTLE_MS),
    );
}

function mobileTcpSendProfile() {
    return {
        chunkSize: MOBILE_TCP_CHUNK_SIZE,
        cooldownEveryBytes: MOBILE_TCP_COOLDOWN_EVERY_BYTES,
        cooldownMs: MOBILE_TCP_COOLDOWN_MS,
        delayMs: MOBILE_TCP_CHUNK_DELAY_MS,
        profile: "buffer_safe" as const,
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

        // GS r 1: bits 5 and 6 indicate that the paper-end sensor sees no paper.
        if ((status & 0x60) !== 0) {
            throw new Error("Printer reported paper out before completion");
        }

        console.log("[mobile-tcp] printer paper status received", { status });
    } catch (error) {
        throw deliveryError(error, "unknown");
    }
}

async function sendBase64InChunks({
    TcpSocket,
    client,
    base64,
    chunkSize = 4096,
    cooldownEveryBytes = 0,
    cooldownMs = 0,
    delayMs = 80,
}: {
    TcpSocket: TcpSocketApi;
    client: TcpClient;
    base64: string;
    chunkSize?: number;
    cooldownEveryBytes?: number;
    cooldownMs?: number;
    delayMs?: number;
}) {
    const cleanBase64 = normalizeBase64(base64);

    if (!cleanBase64) {
        throw new ServiceError("Missing ESC/POS base64 data", 400);
    }

    const safeChunkSize = Math.max(4, chunkSize - (chunkSize % 4));
    const totalChunks = Math.ceil(cleanBase64.length / safeChunkSize);
    let bytesSinceCooldown = 0;

    console.log("[mobile-tcp] chunk send config", {
        base64Length: cleanBase64.length,
        safeChunkSize,
        totalChunks,
        cooldownEveryBytes,
        cooldownMs,
        delayMs,
        byteEstimate: Math.floor((cleanBase64.length * 3) / 4),
    });

    for (let i = 0; i < cleanBase64.length; i += safeChunkSize) {
        const chunkIndex = Math.floor(i / safeChunkSize) + 1;
        const chunk = cleanBase64.slice(i, i + safeChunkSize);

        // การ log ทุก chunk ทำให้ WebView ของ iOS/Android ช้าหนักเมื่อใบยาว
        // เก็บเฉพาะ progress เป็นช่วง ๆ โดยไม่เปลี่ยนข้อมูลที่ส่งเข้า printer
        if (chunkIndex === 1 || chunkIndex === totalChunks || chunkIndex % 25 === 0) {
            console.log("[mobile-tcp] send progress", {
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

        bytesSinceCooldown += Math.floor((chunk.length * 3) / 4);

        if (chunkIndex < totalChunks) {
            const shouldCooldown =
                cooldownEveryBytes > 0 &&
                bytesSinceCooldown >= cooldownEveryBytes;
            const pauseMs = shouldCooldown ? cooldownMs : delayMs;
            if (shouldCooldown) bytesSinceCooldown = 0;
            if (pauseMs > 0) await sleep(pauseMs);
        }
    }

    console.log("[mobile-tcp] all chunks sent", {
        totalChunks,
    });
}

async function printMobileEscposOverTcpNow({
    interface_value,
    escpos_base64,
    require_completion_confirmation = false,
}: {
    interface_value?: string;
    escpos_base64: string;
    require_completion_confirmation?: boolean;
}) {
    const cleanBase64 = normalizeBase64(escpos_base64);

    console.log("[mobile-tcp] start", {
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

    console.log("[mobile-tcp] parsed tcp", { host, port });

    const mod = await import("@deedarb/capacitor-tcp-socket");

    console.log("[mobile-tcp] plugin loaded", Object.keys(mod));

    const TcpSocket = mod.TcpSocket as unknown as TcpSocketApi;

    const segments = splitEscposBase64ForTransport(cleanBase64);
    let completedSegments = 0;

    console.log("[mobile-tcp] transport plan", {
        segments: segments.length,
        byteEstimate: Math.floor((cleanBase64.length * 3) / 4),
    });

    for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex++) {
        const segment = segments[segmentIndex];
        const isFinalSegment = segmentIndex === segments.length - 1;
        const trailing = isFinalSegment
            ? splitTrailingEscposCutCommand(segment)
            : { bodyBase64: segment, cutBase64: "" };
        const sendProfile = mobileTcpSendProfile();
        let connected: TcpSocketConnectResult;

        console.log("[mobile-tcp] connect start", {
            segment: segmentIndex + 1,
            segments: segments.length,
        });

        try {
            connected = await TcpSocket.connect({
                ipAddress: host,
                port,
                timeout: 10,
            });
        } catch (error) {
            throw deliveryError(
                error,
                completedSegments === 0 ? "not_sent" : "unknown",
            );
        }

        console.log("[mobile-tcp] connect success", connected);

        const client = connected.client;
        let sendSucceeded = false;

        try {
            console.log("[mobile-tcp] send start", {
                mode: "base64-chunks",
                segment: segmentIndex + 1,
                segments: segments.length,
                base64Length: trailing.bodyBase64.length,
                byteEstimate: Math.floor((trailing.bodyBase64.length * 3) / 4),
                cutIsolated: Boolean(trailing.cutBase64),
                profile: sendProfile.profile,
            });

            if (trailing.bodyBase64) {
                await sendBase64InChunks({
                    TcpSocket,
                    client,
                    base64: trailing.bodyBase64,
                    ...sendProfile,
                });

                const analysis = analyzeEscposPayload(trailing.bodyBase64);
                const drainMs = mobileTcpRasterDrainMs(trailing.bodyBase64);

                console.log("[mobile-tcp] raster sent; waiting for physical drain", {
                    segment: segmentIndex + 1,
                    segments: segments.length,
                    drainMs,
                    rasterBands: analysis.rasterBands,
                    rasterRows: analysis.rasterRows,
                });

                await sleep(drainMs);
            }

            // Keep the final cut out of the raster burst. Some Wi-Fi adapters
            // ACK the socket while their downstream printer buffer is still
            // full; sending GS V only after the paper has advanced prevents
            // that last command from being discarded with the raster tail.
            if (trailing.cutBase64) {
                await withSendTimeout(
                    TcpSocket.send({
                        client,
                        data: trailing.cutBase64,
                        encoding: "base64",
                    }),
                );
                await sleep(MOBILE_TCP_CUT_SETTLE_MS);
            }

            if (
                require_completion_confirmation &&
                isFinalSegment
            ) {
                await checkMobilePrinterPaperStatus({ TcpSocket, client });
            }

            sendSucceeded = true;
            console.log("[mobile-tcp] send success", {
                segment: segmentIndex + 1,
                segments: segments.length,
            });
        } catch (error) {
            console.warn(
                "[mobile-tcp] send failed:",
                error instanceof Error ? error.message : String(error),
            );
            // หลังเริ่มส่งแล้วไม่ retry ก้อนเดิมอัตโนมัติ เพราะอาจทำให้ส่วนต้น
            // ของใบออกซ้ำเมื่อ native socket รับข้อมูลไปบางส่วนแล้ว
            throw deliveryError(error, "unknown");
        } finally {
            console.log("[mobile-tcp] disconnect start");

            await TcpSocket.disconnect({ client }).catch((error: unknown) => {
                console.warn(
                    "[mobile-tcp] disconnect failed:",
                    error instanceof Error ? error.message : String(error),
                );
            });

            console.log("[mobile-tcp] disconnect done");
        }

        if (!sendSucceeded) break;
        completedSegments += 1;

        if (segmentIndex < segments.length - 1) {
            await sleep(MOBILE_TCP_RECONNECT_DELAY_MS);
        }
    }
}

export function printMobileEscposOverTcp(input: {
    interface_value?: string;
    escpos_base64: string;
    require_completion_confirmation?: boolean;
}) {
    return runOnMobileTcpQueue(
        String(input.interface_value || "mobile-printer"),
        () => printMobileEscposOverTcpNow(input),
    );
}

export const __mobileTcpInternals = {
    MOBILE_TCP_SEGMENT_MAX_BYTES,
    analyzeEscposPayload,
    checkMobilePrinterPaperStatus,
    mobileTcpRasterDrainMs,
    mobileTcpSendProfile,
    printerStatusByte,
    runOnMobileTcpQueue,
    sendBase64InChunks,
    splitEscposBase64ForTransport,
    splitTrailingEscposCutCommand,
};
